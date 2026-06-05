# Required Code Patterns

Every game MUST implement all patterns below. Each section either references a PART (for full API details) or defines a game-building-specific rule not covered by any PART.

**Convention:** "Per PART-NNN" means the full code, constructor options, methods, and verification checklist live in `parts/PART-NNN.md`. This file only adds game-building-specific usage rules.

---

## Standalone fallback pattern (CRITICAL)

Every game listens for `game_init` from a parent window. When running standalone (local server, Playwright tests, preview), there is no parent — `game_init` never arrives — and the game stays on a blank start screen forever.

**Required pattern:** Add a fallback timer that runs **independently of `waitForPackages()`**. The fallback must be able to fire even if CDN packages never load. AND the fallback must re-verify that every required component is defined before booting — partial-component boot is a known fail-open shape.

```javascript
// Inside DOMContentLoaded, AFTER registering the message listener and sending game_ready:

// 1. Start waitForPackages (may take up to 180s if CDN is down)
waitForPackages().then(function(loaded) {
  // ... init CDN components, register the `message` listener, send game_ready ...
  // Do NOT call setupGame() here. After game_ready, WAIT for the host's game_init.
  // setupGame() is reached ONLY via handlePostMessage (host game_init) or the
  // standalone fallback below. An inline call boots on fallbackContent without
  // waiting for the host (broken iframe handshake) — validator GEN-BOOT-WAIT-FOR-INIT.
});

// 2. Standalone fallback — runs INDEPENDENTLY, not nested inside waitForPackages
//    Builds fallback layout if ScreenLayout didn't load, then starts the game.
setTimeout(function() {
  // 2a. Abort if a live preview is mounted (covered case A: waitForPackages succeeded).
  if (previewScreen && previewScreen.isActive && previewScreen.isActive()) return;
  if (gameState.isActive || gameState.gameEnded) return;

  // 2b. Re-verify the readiness gate. If any required class is still undefined,
  //     waitForPackages did NOT succeed — render an attributable error instead
  //     of silently booting with a partial component graph.
  //     Drop rows here only when their spec opt-out flag is set, exactly as in waitForPackages.
  var missing = [];
  if (typeof FeedbackManager === 'undefined') missing.push('FeedbackManager');
  if (typeof TimerComponent === 'undefined') missing.push('TimerComponent');
  if (typeof VisibilityTracker === 'undefined') missing.push('VisibilityTracker');
  if (typeof SignalCollector === 'undefined') missing.push('SignalCollector');
  if (typeof ScreenLayout === 'undefined') missing.push('ScreenLayout');
  if (typeof PreviewScreenComponent === 'undefined') missing.push('PreviewScreenComponent');
  if (typeof TransitionScreenComponent === 'undefined') missing.push('TransitionScreenComponent');
  if (typeof ProgressBarComponent === 'undefined') missing.push('ProgressBarComponent');
  if (typeof FloatingButtonComponent === 'undefined') missing.push('FloatingButtonComponent');
  if (typeof AnswerComponentComponent === 'undefined') missing.push('AnswerComponentComponent');

  if (missing.length > 0) {
    var msg = 'standalone fallback: required class undefined: ' + missing.join(', ');
    console.error('[' + msg + ']');
    if (typeof Sentry !== 'undefined') Sentry.captureMessage(msg);
    var gc = document.getElementById('gameContent') || document.body;
    gc.innerHTML =
      '<div style="padding:24px;text-align:center;font-family:sans-serif;color:#a33;">' +
      'Game failed to load — please refresh.' +
      '</div>';
    return;
  }

  // 2b5. Only self-boot when TRULY standalone (a top-level window with no host).
  //      Inside an iframe, keep waiting for the host's game_init — handlePostMessage
  //      boots setupGame() with the host's real content. This is the standalone half
  //      of the wait-for-host handshake (see GEN-BOOT-WAIT-FOR-INIT / GEN-PM-NO-SELF-INIT).
  if (window.self !== window.top) return;

  // 2c. All classes defined AND standalone → boot.
  if (!document.getElementById('gameContent')) {
    buildFallbackLayout();
    // ... populate slots with innerHTML ...
  }
  gameState.content = fallbackContent;
  gameState.totalRounds = fallbackContent.rounds.length;
  setupGame();
  startGame();
}, 30000);  // 30s, NOT 2s — see "Fallback delay" note below
```

**Fallback delay — use `30000` (30s), never `2000`.** This timer's missing-class branch is what renders the user-visible "Game failed to load — please refresh." error, and it runs in the iframe too (the `window.self !== window.top` gate only blocks the *self-boot* half, not the error half). A 2s deadline declares failure while the shared CDN packages are still legitimately loading — common on slow mobile networks and in fresh Playwright browsers (CDN cold-start is 30–120s; this is the same reason `waitForPackages()` uses a 120s+ timeout). Use 30s so a slow-but-healthy load is not misreported as a failure. Trade-off accepted: in true standalone mode (preview/Playwright with no host `game_init`) the self-boot now waits up to 30s before booting on `fallbackContent` — tests that need an immediate start should send `game_init` rather than rely on the fallback.

**Why CRITICAL:** Without this, the game is untestable locally and unrenderable in standalone preview. This bug appeared in THREE Alfred-built games before being corrected.

**Anti-pattern (CRITICAL):** Never nest the standalone fallback inside `waitForPackages().then(...)`. If CDN packages fail to load, `waitForPackages` blocks for 180s — the standalone fallback never fires, and Playwright tests time out waiting for the game to start. The fallback MUST be a top-level `setTimeout` that runs regardless of CDN availability.

**Anti-pattern (CRITICAL):** Never silently call `setupGame()` from the fallback when one or more required classes are still undefined. That is the fail-open shape — `previewScreen` ends up `null` and the game boots into Round 1 with no preview. The fallback MUST re-check the same set as `waitForPackages` (see [`mandatory-components.md`](./mandatory-components.md)) and surface a visible error if any are missing.

---

---

## Component References (WHAT lives in PARTs)

### gameState
Per PART-007. Game-building rules:
- Every field in data-contract.md Section 1 marked Required MUST be present.
- `window.gameState = gameState;` -- test harness reads this global.
- Lives games add `lives` and `totalLives` fields.
- Every game initializes `tries: 1` (integer counter; see § Session-scoped fields below).
- Multi-set games add a `setIndex: 0` field.
- **Session-scoped fields** (initialized at fresh page load; NOT reset by `resetGameState()` / `restartGame()` — persist across Try Again):
  - `setIndex` — rotates `(setIndex + 1) % sets.length` inside `restartGame()` BEFORE `resetGameState()`.
  - `tries` — incremented by 1 in the wrong-answer / life-decrement branch alongside `gameState.lives -= 1`.
  - `attempts` — populated by `recordAttempt()`; full session history accumulates across replays.
  - See [`alfred/skills/data-contract/SKILL.md` § Session-scoped fields](../../data-contract/SKILL.md). Validator rules: `GEN-RESTART-TRIES-PRESERVED`, `GEN-RESTART-ATTEMPTS-PRESERVED`.
- See `parts/PART-007.md` for full field list and code.

### waitForPackages
Per PART-003. Game-building rules:
- **The package set is derived from [`mandatory-components.md`](./mandatory-components.md)**, not from PART-003's baseline list. Every component the file calls `new X(...)` on AND every slot injected via `ScreenLayout.inject(...)` must be a hard `&&` `typeof X !== 'undefined'` term in the readiness expression.
- **No `||` operators inside the readiness expression.** Validator: `GEN-WAITFORPACKAGES-NO-OR`. The historical fail-open shape `(typeof PreviewScreenComponent !== 'undefined' || typeof ScreenLayout !== 'undefined')` is forbidden — `ScreenLayout` and `PreviewScreenComponent` register on `window` at different points in the same bundle's IIFE, so one being defined does NOT imply the other is.
- **Component instantiations use attributable catches**, never `try { ... } catch (e) {}`. A silent catch on `new XComponent(...)` converts a `ReferenceError` from a missing class into a null reference downstream. Use `console.error('[X ctor failed]', e.message, e); if (typeof Sentry !== 'undefined') Sentry.captureException(e);`.
- Must resolve before any CDN component is used.
- 180s timeout. Reject (don't swallow) on timeout — the standalone fallback re-checks the gate and renders the failure UI.
- See `parts/PART-003.md` for full implementation.

### handlePostMessage
Per PART-008. Game-building rules:
- `gameState.phase = 'playing'` MUST be the FIRST assignment inside `game_init` case. No logic before it.
- The `message` listener MUST be registered BEFORE `game_ready` is sent.
- See `parts/PART-008.md` for full protocol.

### recordAttempt
Per PART-009. Game-building rules:
- All 12 fields from data-contract.md Section 2 must be present in every attempt.
- Track `gameState.roundStartTime = Date.now()` when each round renders so `response_time_ms` is accurate.
- See `parts/PART-009.md` for field list and code.

### trackEvent
Per PART-010. Game-building rules:
- Canonical events that MUST fire: `game_start`, `answer_submitted`, `round_complete`, `attempt_complete`, `game_end`.
- `attempt_complete` and `game_end` bracket the post-submit feedback chain — `attempt_complete` fires right after `recordAttempt(...)` for the terminal answer (BEFORE SFX/TTS), `game_end` fires in `endGame()` (AFTER SFX/TTS). See PART-008 § attempt_complete + PART-010.
- See `parts/PART-010.md` for event schemas.

### endGame
Per PART-011. Game-building rules:
- `gameState.phase` assignment BEFORE `syncDOM()` call (GEN-PHASE-SEQUENCE).
- `game_complete` postMessage fires on BOTH victory and game-over paths (GEN-PM-DUAL-PATH).
- `accuracy` is integer 0-100, not float 0.0-1.0.
- `completedAt` is sibling of `metrics`, not nested inside.
- `gameState.gameEnded` guard prevents double-fire.
- **Takes a `correct: boolean` argument** — `endGame(correct)`. The caller computes the value at the call site:
  - **Standalone evaluating** — Submit handler passes its evaluation: `endGame(true)` on correct, `endGame(false)` on lives-zero.
  - **Multi-round evaluating** — `endGame(gameState.lives > 0 && gameState.stars > 0)` at the final-round path; `endGame(false)` at the lives-zero branch.
  - **Feedback-only (any shape)** — `endGame(true)` hardcoded; every `recordAttempt(...)` uses `correct: true`.
- The `correct` argument is a PASSTHROUGH to `metrics.correct` — never derived from `accuracy` or `attempts[last]`. Validator `GEN-METRICS-CORRECT-PASSTHROUGH` enforces this.
- See `parts/PART-011.md` and `parts/PART-050.md` for full code and metrics fields.

### buildEndPayload + postAttemptComplete + postGameComplete (shared-builder pattern)

Canonical builders for the two end-of-game postMessages. **Source of truth for shape:** [`alfred/skills/data-contract/schemas/game-complete.schema.json`](../../data-contract/schemas/game-complete.schema.json) (and [`attempt-complete.schema.json`](../../data-contract/schemas/attempt-complete.schema.json), which reuses the same `$defs`).

**Rule: both messages MUST be built from one shared `buildEndPayload(correct)` helper** so they cannot drift field-by-field. Inlining two parallel payload objects is forbidden — `attempt_complete.data.metrics` and `game_complete.data.metrics` must match for every field except `time` and `completedAt` (which legitimately differ because each message timestamps itself at its own firing instant).

```javascript
// Shared payload builder — used by BOTH postAttemptComplete and postGameComplete.
// Re-reads gameState at call time so each message captures its own timestamp.
function buildEndPayload(correct) {
  // metrics.time is in SECONDS. The other time fields in the payload are MILLISECONDS — see
  // the unit asymmetry note in postmessage-schema.md and attempt-schema.md.
  var totalTime = gameState.startTime
    ? Math.round((Date.now() - gameState.startTime) / 1000)
    : 0;

  return {
    metrics: {
      accuracy: getAccuracy(),                                              // integer 0-100
      time: totalTime,                                                      // INTEGER SECONDS at this firing instant
      stars: getStars(),                                                    // 0-3
      attempts: gameState.attempts,                                         // session-scoped; survives Try Again
      duration_data: gameState.duration_data,
      totalLives: gameState.totalLives,                                     // INITIAL life budget (count at first render); NOT remaining. Remaining = totalLives - (tries - 1).
      tries: gameState.tries,                                               // INTEGER counter ≥ 1; NOT an array
      correct: correct,                                                     // PASSTHROUGH of endGame(correct) arg
      roundCorrectness: deriveRoundCorrectness(gameState.attempts, gameState.totalRounds)
    },
    completedAt: Date.now(),                                                // EPOCH MILLISECONDS at this firing instant
    previewResult: gameState.previewResult || null
  };
}

// Host preload hook. Fire IMMEDIATELY after recordAttempt(...) for the terminal answer,
// BEFORE the post-submit SFX/TTS chain. See PART-008 § attempt_complete and PART-050
// (standalone Beat 0 / multi-round per-round submit handler) for the firing-point rules.
function postAttemptComplete(correct) {
  var payload = { type: 'attempt_complete', data: buildEndPayload(correct) };
  try { window.parent.postMessage(payload, '*'); } catch (e) {}
  try { window.postMessage(payload, '*'); } catch (e) {}
  try { trackEvent('attempt_complete', {
    correct: !!correct,
    score: gameState.score,
    stars: gameState.stars
  }); } catch (e) {}
}

// End-of-game signal. Fire from endGame() AFTER the feedback chain. Continues to be the
// authoritative carrier of signal_event_count / signal_metadata (sealed by SignalCollector).
function postGameComplete(correct) {
  var payload = { type: 'game_complete', data: buildEndPayload(correct) };
  try { window.parent.postMessage(payload, '*'); } catch (e) {}
  try { window.postMessage(payload, '*'); } catch (e) {}
}

// Canonical per-round correctness helper. Walks the attempts array and takes the LAST attempt
// per round_number — so Try Again replays naturally collapse to the player's most-recent
// correctness for each round. Length of the returned array is totalRounds; missing rounds
// default to false.
function deriveRoundCorrectness(attempts, totalRounds) {
  var byRound = {};
  for (var i = 0; i < attempts.length; i++) {
    byRound[attempts[i].round_number] = attempts[i].correct;
  }
  var out = [];
  for (var r = 1; r <= totalRounds; r++) {
    out.push(byRound[r] === true);
  }
  return out;
}
```

**Time unit asymmetry — explicit table.** The `game_complete` payload mixes units across fields. The validator rule `GEN-METRICS-TIME-UNIT` catches the most common bug (emitting raw `Date.now() - startTime` milliseconds into `metrics.time`).

| Field | Unit |
|---|---|
| `data.metrics.time` | INTEGER SECONDS — `Math.round((Date.now() - gameState.startTime) / 1000)` |
| `data.completedAt` | EPOCH MILLISECONDS — `Date.now()` |
| `data.metrics.attempts[i].attempt_timestamp` | EPOCH MILLISECONDS |
| `data.metrics.attempts[i].time_since_start_of_game` | MILLISECONDS |
| `data.metrics.attempts[i].response_time_ms` | MILLISECONDS |

The JSON Schema's `metrics.time` upper bound (`86400` = 24 hours) is a sanity cap — values above this almost certainly indicate a missing `/1000` conversion.

### ActionBar header (stars-immutable contract)

The ActionBar header `#previewScore` (e.g. `"2/3"`) and `#previewQuestionLabel` (e.g. `"Q1"`) represent **overall game performance**, not running progress. They are locked at boot by `game_init` and updated only by the end-of-game `show_star` celebration.

**`previewScreen.setScore(...)` and `previewScreen.setQuestionLabel(...)` are NOT part of the public API.** Direct DOM access to `#previewScore` / `#previewStar` / `#previewQuestionLabel` is also blocked (validator `5e0-DOM-BOUNDARY`).

**Path 1 — Initial baseline (`game_init`).**

```javascript
// Sent by the host (or constructed in fallbackContent for standalone runs):
{
  type: 'game_init',
  data: {
    content: { /* rounds, totalRounds, ... */ },
    score: { x: 0, y: 3 },        // OR string '0/3' — locks the denominator
    questionLabel: 'Q1',          // must match /^Q\d+$/
    showStar: true                // optional; default true
  }
}
```

**Path 2 — `show_star` numerator increment (end-of-game).**

`show_star` fires the flying-star animation into the header. It is a ONE-TIME celebration triggered at the end of the game — NOT per round. After the 1 s animation, the numerator increments by `count` (clamped at the locked denominator).

Fire `show_star` exactly ONCE per game session, at the end-of-game celebration step:
- **Standalone** (`totalRounds: 1`): inside `endGame` / feedback sequence, after all feedback audio completes.
- **Multi-round** (`totalRounds > 1`): inside the victory / stars-collected TransitionScreen's `onMounted` (or `onDismiss`), after celebration audio — NOT inside the per-round correct handler.

```javascript
// End-of-game — the one place show_star belongs.
window.postMessage({
  type: 'show_star',
  data: {
    count: getStars(),            // 0-3 stars earned overall (numerator increments by this)
    variant: 'yellow'             // or 'blue'
    // Do NOT send `score` / `questionLabel` fields here — the numerator is derived from `count`, and the label is locked at boot.
  }
}, '*');
```

**Stars semantics.** Stars in the ActionBar represent overall game performance, awarded at the end. Stars are NOT correct-round count, NOT current-round number, NOT in-game points, NOT a running counter. The denominator `y` is the maximum achievable stars (typically `3`); the numerator `x` accumulates across `show_star` fires (typically a single fire at end).

**`getStars()` default thresholds** (override in spec):

| Score % | Stars |
|---|---|
| ≥ 90% | 3 |
| ≥ 60% | 2 |
| ≥ 1 correct | 1 |
| 0 correct | 0 |

**Do NOT fire `show_star` per round.** Validator `GEN-SHOW-STAR-ONCE` blocks it. The flying-star animation is a one-time end-of-game celebration; multi-fire stacks the animation N times and over-counts the displayed numerator.

**Do NOT re-post `game_init` from the game** (validator `GEN-PM-NO-SELF-INIT`). `game_init` is inbound only (host → game, PART-008). The game's own `handlePostMessage` listener catches any `game_init` and runs `setupGame()` — a self-post boots `setupGame()` on fallback content and short-circuits the wait for the host's real content. To seed the standalone ActionBar header, rely on the component defaults (`Q1`, `0/3`) or the host's `game_init`.

**Game-internal counters live in `#gameContent`.** If your game needs a running widget (e.g., a fast-tap star meter, a live point counter), render it inside `#gameContent` — never in the platform header. The platform header is reserved for end-of-game performance.

**Validator gates:**
- `GEN-ACTIONBAR-STARS-IMMUTABLE` — fails on any `.setScore(` call.
- `GEN-QUESTION-LABEL-IMMUTABLE` — fails on any `.setQuestionLabel(` call.
- `GEN-QUESTION-LABEL-FORMAT` — fails on any `questionLabel:` literal not matching `/^Q\d+$/`.
- `GEN-SHOW-STAR-ONCE` — fails if `show_star` fires more than once.
- `GEN-SHOW-STAR-REQUIRED` — fails if a PreviewScreen+FloatingButton game has no `show_star` with `count`.
- `5e0-DOM-BOUNDARY` — fails on direct DOM access to header private nodes.

### Star-award animation (`show_star`)
Per PART-040 + PART-050. Intra-frame postMessage that animates a flying star into the ActionBar header, plays an award chime, upgrades the header's static star image to match the awarded tier, and updates the header score text at animation end.

- **Target is `window`, NOT `window.parent`.** ActionBar listens in the same frame as the game. `window.parent.postMessage(...)` goes to the host and ActionBar never sees it.
- **Fire EXACTLY ONCE per game session, at the end-of-game celebration step.** Stars in the ActionBar represent overall game performance. Mid-round `show_star` plays N stacked animations in a multi-round game and over-counts the displayed numerator (regression caught twice in QA). Spec opt-out: `spec.autoShowStar: false` suppresses the generator default.
- **Serial ordering (MANDATORY).** At end-of-game, fire `show_star` ONLY after ALL feedback audio (SFX + dynamic TTS) has finished awaiting. The flying star is a visual follow-on to the spoken feedback, not a parallel effect. User-visible order is SFX → feedback panel → TTS (awaited) → star animation → Next.
  - **Step 1: `await FeedbackManager.sound.play(...)`** — SFX + sticker, min 1500 ms.
  - **Step 2: render feedback panel + `postGameComplete()`** — SYNC; never block on TTS.
  - **Step 3: `await FeedbackManager.playDynamicFeedback({...})`** — dynamic TTS, if the game uses it. AWAIT IT; fire-and-forget here causes the star animation and Next button to overlap with TTS audio.
  - **Step 4: fire `show_star` postMessage** — animation plays ~1 s, score applied at animation end.
  - **Step 5: `setTimeout(function(){ floatingBtn.setMode('next'); }, 1100)`** — Next appears AFTER the animation finishes. Shorten to 300 ms only if `spec.autoShowStar === false`.
- **Claim-Stars button (opt-in).** TransitionScreen has no knowledge of the star protocol — authors fire `show_star` from the button's own `action()`. Fully customizable; pair with `spec.autoShowStar: false` to avoid the generator-emitted default firing as well.
- **Score bump is part of the celebration.** Pass `score: gameState.score + '/' + gameState.totalRounds` in the payload — ActionBar updates `#previewScore` AFTER the 1 s animation finishes, so the celebration visibly precedes the number change (matches mathai-client UX).
- **Dedupe + queue.** ActionBar swallows identical payloads within 500 ms; distinct payloads in flight are queued (max 3). Over-firing identical payloads is safe.

```javascript
// Correct-answer path — MANDATORY includes score so the header count bumps
// after the animation finishes (GEN-HEADER-REFRESH).
window.postMessage({
  type: 'show_star',
  data: {
    count: gameState.stars || 1,
    variant: 'yellow',
    score: gameState.score + '/' + gameState.totalRounds
  }
}, '*');

// Claim-Stars pattern: author fires from the button's own action().
// Remember to set spec.autoShowStar: false so the generator default
// doesn't also emit a show_star in onDismiss.
transitionScreen.show({
  stars: 3,
  buttons: [{
    text: 'Claim Stars',
    type: 'primary',
    action: () => {
      window.postMessage({
        type: 'show_star',
        data: {
          count: 3,
          variant: 'yellow',
          score: gameState.score + '/' + gameState.totalRounds
        }
      }, '*');
      transitionScreen.hide();
      floatingBtn.setMode('next');
    }
  }]
});
```

Payload fields: `count` ∈ {1,2,3} default 1; `variant` ∈ {'yellow','blue'} default 'yellow'; `silent: boolean` default false; `score: string` optional (applied to `#previewScore` at animation end); `questionLabel: string` optional (same timing for `#previewQuestionLabel`). See PART-040's "show_star payload contract" for the full table.

### FeedbackManager Integration
Per PART-017 and `skills/feedback/SKILL.md`. Game-building rules:
- **CDN script:** `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`
- **Init:** `await FeedbackManager.init()` in DOMContentLoaded
- **Preload:** `await FeedbackManager.sound.preload([...])` with exact `(id, url)` pairs from `feedback/reference/feedbackmanager-api.md` § Standard Audio URLs. **The id and URL are coupled — one always points at the same URL.** Do NOT invent ids and do NOT copy a URL from a previous preload row when adding a new id. When the spec declares custom sounds (`spec.creatorSounds`), append those entries with the creator-supplied URLs.

  ```javascript
  // CORRECT — every entry's (id, url) matches feedbackmanager-api.md verbatim
  await FeedbackManager.sound.preload([
    { id: 'correct_sound_effect',     url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3' },
    { id: 'incorrect_sound_effect',   url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3' },
    { id: 'rounds_sound_effect',      url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3' },
    { id: 'sound_bubble_select',      url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1758162403784.mp3' }
  ]);
  ```

  ```javascript
  // WRONG — invented id ('bubble_pop_sfx' is not in the canonical table) registered with a copy-pasted URL
  // (the builder copy-pasted the rounds_sound_effect URL because it had no canonical URL for the invented id).
  // Cell taps would play the round-intro sting instead of a bubble.
  await FeedbackManager.sound.preload([
    { id: 'rounds_sound_effect', url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3' },
    { id: 'bubble_pop_sfx',      url: 'https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3' }  // ← rejected by GEN-SOUND-ID-CANONICAL
  ]);
  ```

  Validator: `GEN-SOUND-ID-CANONICAL` blocks both invented ids and (id, URL) drift at Step 5.
- **Static SFX:** `await FeedbackManager.sound.play(id, {sticker: STICKER_URL})` — sticker is a string URL. Awaited for terminal moments, fire-and-forget for mid-round
- **CRITICAL — Minimum Feedback Duration:** `sound.play()` can resolve BEFORE audio finishes. ALL answer-feedback calls (`sound_life_lost`, `sound_correct`, `wrong_tap`, `correct_tap`, `sound_incorrect`, `all_correct`, `all_incorrect_*`, `partial_correct_*`) MUST use `Promise.all` with a 1500ms floor: `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ]);` — guarantees audio fully plays before round advance / tile reset / game-over. Does NOT apply to VO or transition audio. Validator rule `5e0-FEEDBACK-MIN-DURATION`. See PART-026 Anti-Pattern 34.
- **Dynamic VO:** all VO is dynamic TTS, never preloaded. **Usage depends on context:**
  - **Submit/answer handlers (correct/wrong, single-step) AND round-complete (multi-step):** AWAIT — `try { await FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}); } catch(e){}`. The explanation MUST finish BEFORE the round advances; without await, the TTS subtitle/audio paints on top of the next round's transition. Package already bounds resolution (3 s TTS API / 60 s streaming) so the await can never freeze the game indefinitely. Validator: `GEN-FEEDBACK-TTS-AWAIT`.
  - **Transition screens (level/round/game-over) with CTA:** `await FeedbackManager.playDynamicFeedback(...)` — same reason; CTA can interrupt at any time.
  - **Round-start dynamic TTS (welcome / contextual intro after round mounts):** fire-and-forget — student should be able to interact immediately.
  - **Partial progress / chain audio:** fire-and-forget — ambient acknowledgement, don't pause mid-chain.
- **Sequential audio (transitions, end-game, SFX+TTS):** wrap in `FeedbackManager.runSequence(async () => { ... })`. `sound.stopAll()` / `stream.stopAll()` automatically abort the in-flight `runSequence`, so existing CTA stop calls keep working. Legacy `audioStopped` flag is forbidden. See `feedback/reference/feedbackmanager-api.md` § Sequential Audio. Validator: `GEN-FEEDBACK-RUN-SEQUENCE`.
- **Stop:** `FeedbackManager.sound.stopAll()` + `FeedbackManager.stream.stopAll()` on CTA taps and screen-change handlers (same as before — they now also abort the ambient `runSequence`).
- **Pause/Resume:** `FeedbackManager.sound.pause()/resume()` + `FeedbackManager.stream.pauseAll()/resumeAll()` on visibility change
- Subtitle under 60 chars. Never use "wrong" -- use "Not quite," "Close," "Almost."
- **No `Promise.race` on FeedbackManager calls (CRITICAL).** Package already bounds resolution (`sound.play` → audio-duration + 1.5s guard; `playDynamicFeedback` → 60s streaming / 3s TTS API). A helper like `audioRace(p) => Promise.race([p, setTimeout(r, 800)])` truncates normal TTS (1–3s) and causes phase/round transitions to fire before audio ends. Validator rule `5e0-FEEDBACK-RACE-FORBIDDEN` blocks any such race. "Non-blocking" means `try/catch` around awaited SFX / TTS, or `.catch()` on fire-and-forget round-start / chain TTS — NEVER `Promise.race`. See PART-017 + PART-026 Anti-Pattern 32.
- See `skills/feedback/SKILL.md` for all 17 behavioral cases and `feedback/reference/feedbackmanager-api.md` for CDN URLs.

### ScreenLayout.inject
Per PART-025. Game-building rules:
- MUST be called to create the layout scaffold. Without it, `#gameContent` never exists.
- Use the `slots` API with `previewScreen: true` (default). The `sections` API is NOT valid.
- See `parts/PART-025.md` for full options.

### TransitionScreen
Per PART-024. Game-building rules:
- `transitionScreen.show()` takes ONE argument -- an options object (GEN-TRANSITION-API).
- `icons` array must contain **single-glyph emoji strings only** — never URLs, never SVG markup, never image paths, never multi-word text. The component renders each entry as **text inside a `.mathai-ts-icons` span**, NOT as an `<img src>`. Passing a URL surfaces the URL as giant text in the UI (e.g. passing `icons: [STICKER_ROUNDS]` where `STICKER_ROUNDS` is a `https://cdn...gif` URL renders the full URL at 80px font on the round-intro screen). Image / sticker URLs go on the **separate `sticker` prop of `safePlaySound` / `FeedbackManager.sound.play`**, NEVER on `icons[]`. Validator rules `GEN-TRANSITION-ICONS` (existing — SVG ban) and `TRANSITION-ICONS-NO-URL` (new — URL ban) enforce this.
- ALL `transitionScreen.show()` calls MUST be awaited (returns a Promise).
- **Every transition screen MUST play audio** (SFX ± dynamic VO). No silent transitions. Fire via the `onMounted` callback: `onMounted: () => FeedbackManager.sound.play('<id>', { sticker })`. Approved IDs per PART-024: `vo_game_start`, `sound_game_complete`, `sound_game_over`, `vo_level_start_N`, `vo_motivation`.
- **`stars:` and `icons:` are mutually exclusive.** TransitionScreenComponent renders them into the same `.mathai-ts-icons` DOM element — `stars:` always wins, so any `icons: [...]` emoji silently disappears. Pick one per screen: Victory passes `stars: N`; Game Over / Round Intro / Motivation / Stars Collected pass `icons: ['<emoji>']`. Do NOT pass both. `test/content-match.test.js` fails the build if you do.
- **CRITICAL: `show()` Promise resolves IMMEDIATELY (next rAF after `onMounted` fires) — NOT when a button is tapped, NOT after a `duration`.** `duration` and `persist` are documented in the options table but the CDN component does NOT implement either — `show()` never reads them. Code after `await transitionScreen.show(...)` runs before the student interacts with the screen. ALL game-flow continuation (phase changes, `showRoundIntro()`, `renderRound()`, `startGame()`, `restartGame()`) MUST go inside the button `action` callback, NEVER after `await show()`. If you put continuation code after `await show()`, the screen flashes for one frame then gets replaced. For auto-dismiss screens (round intro), fire audio + `hide()` + continuation inside the `onMounted` IIFE. Validator rule `5e2-TS-PERSIST-FALLTHROUGH` blocks the anti-pattern.
- **Audio + render sequence for Victory / Game Over:** `await transitionScreen.show({ content: metricsHTML, buttons: [...], onMounted: () => FeedbackManager.sound.play(...) })`. The `onMounted` fires the audio after DOM mounts. If a button click should interrupt audio, call `FeedbackManager.sound.stopAll()` in the `action` handler. The button `action` callback MUST contain `transitionScreen.hide()` AND all game-flow continuation (`restartGame()`, `showMotivation()`, etc.).
- Button labels come from `pre-generation/screens.md` verbatim. See "Plan → build contract" in `flow-implementation.md`.
- See `parts/PART-024.md` for full API.

### ProgressBarComponent
Per PART-023. Game-building rules:
- CDN ProgressBarComponent renders round counter + lives. Do NOT render these yourself.
- **CRITICAL: No custom lives/hearts DOM or renderer.** When `totalLives >= 1`, ProgressBar already paints the hearts strip inside `#mathai-progress-slot`. Any game-owned element with `class`/`id` matching `lives-row`, `lives-strip`, `lives-container`, `lives-display`, `hearts-row`, `hearts-strip`, `hearts-container`, `livesRow`, `heartsRow`, or a single-class `heart` — or any function named `renderLivesRow`, `renderLives`, `renderHearts`, `updateLivesDisplay`, `updateLivesRow`, `updateHearts`, `buildLives`, `injectLives` — paints a **second** hearts row on top of the CDN strip (symptom: two rows of hearts visible on-screen). Validator rule `5e0-LIVES-DUP-FORBIDDEN` blocks this. Emit heart glyphs (❤️ 🤍 🩷 ♡ ♥) ONLY through the CDN ProgressBar, never via your own `innerHTML` strings or `<span class="heart">` loops. For a heart-break animation, target the CDN-rendered heart class with a one-shot CSS class — do NOT replicate the hearts in your own DOM. See PART-023 and PART-026 Anti-Pattern 33.
- `totalLives` must be >= 1 (GEN-PROGRESSBAR-LIVES). Passing 0 causes division-by-zero.
- `slotId` must be exactly `'mathai-progress-slot'` (GEN-UX-003). **Do NOT use `'previewProgressBar'`** or `'progress-bar-container'` — those are different things (see ID disambiguation below).
- **ID disambiguation.** `#previewProgressBar` is the audio countdown strip **inside the preview header** (~4px tall, populated by PreviewScreenComponent during preview state — it animates full → empty as preview audio plays). `#mathai-progress-slot` is a **separate** element ScreenLayout creates at the top of `.game-stack` for the round counter + lives bar. Two different elements, two different purposes. If you instantiate ProgressBarComponent with `slotId: 'previewProgressBar'`, the round bar mounts into the countdown strip and crushes the whole header row.
- `ScreenLayout.inject` slots MUST include `progressBar: true` for the slot to be created in preview-wrapper mode (`slots: { previewScreen: true, progressBar: true, transitionScreen: true }`).
- **`update(progress, livesRemaining)` — INVARIANT: `progress` starts at `0` when the game begins, never at `1`.** The first `progressBar.update()` call on the initial flow path (inside `startGame` / `startGameAfterPreview` / the `DOMContentLoaded` init path) MUST be `update(0, totalLives)`. Validator rule `5e0-PROGRESSBAR-START-ONE` blocks any first-call whose first arg is not literal `0` (e.g. `update(currentRound + 1, …)`, `update(1, …)`). On restart (before the first new round): `update(0, totalLives)`.
- **Increment policy is game-specific.** What `progress` counts — rounds completed, correct answers, points earned, section progress, etc. — is defined per game. The skill does NOT prescribe a single policy. Pick the metric that matches your spec and increment it when that metric changes. The canonical "rounds completed, incremented on correct feedback" loop in `flow-implementation.md` is ONE example of the invariant; swap the increment condition to match your progression metric.
- `livesRemaining` MUST be clamped: `progressBar.update(progress, Math.max(0, lives))` (LP-PROGRESSBAR-CLAMP). Passing a negative value (e.g. after the last wrong answer decrements to -1) throws a RangeError inside the CDN component.
- First arg to `update()` is a **progression counter**, never `totalRounds` (GEN-112) — the component computes `progress / totalRounds` internally from the constructor's `totalRounds`.
- Never wrap `destroy()` in `setTimeout` -- synchronous only (GEN-PROGRESSBAR-DESTROY).
- See `parts/PART-023.md` for constructor options and createProgressBar helper.

### FloatingButtonComponent
Per PART-050. Game-building rules:
- **Required when the spec has a Submit CTA.** If the flow evaluates the player's answer on demand (text input, DnD completion, option commit), instantiate `FloatingButtonComponent` and do NOT hand-roll a submit button inside `#gameContent`.
- **Per-game opt-out (`floatingButton: false` in spec.md):** mirrors PART-039's `previewScreen: false` pattern. When the spec declares a top-level `floatingButton: false` (e.g. `**Floating button:** false`), the validator auto-skips all FloatingButton rules and the author hand-rolls Submit / Retry / Next inline per PART-022. Two reasons this flag is set: (1) the flow has no Submit CTA at all (timer-driven auto-advance, drag-to-commit), (2) the spec author deliberately prefers inline buttons for this specific game. **CRITICAL: step 4 (Build) MUST NOT write `floatingButton: false` into `spec.md` to silence a validator error.** Spec mutations during build show up in `git diff` and are a scope violation the user can revert. If you cannot make the game pass with FloatingButton, report the blocker — do not silence the rule by editing the spec.
- **No narrative opt-out. Validator rule `GEN-FLOATING-BUTTON-MISSING` has no escape hatch.** Do NOT reason yourself out of using FloatingButton with any of these (all WRONG):
  - "Standalone totalRounds:1 game, no retry/next lifecycle needed" — FloatingButton works in submit-only mode; retry/next are optional modes, not required.
  - "Submit sits inside the form next to the input, it's an in-form button" — inputs stay in `#gameContent`, only the button moves to the floating slot.
  - "Archetype profile doesn't list PART-050" — the archetype row is a default starting point; the spec's flow (presence of a Submit CTA) overrides it per game-archetypes constraint #8.
  - "Speed Blitz / Lives Challenge / [any archetype] doesn't need it" — if the spec mentions a Submit button, PART-050 applies, period.

  If the spec genuinely has no Submit CTA, do NOT emit any `<button>` whose id / class / data-testid / aria-label / text contains `submit` / `check` / `done` / `commit` — the flow should auto-evaluate on interaction instead.
- **CDN:** include `https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js` OR the bundled `components/index.js` (which loads it automatically). Missing tag → `GEN-FLOATING-BUTTON-CDN`.
- **Slot:** `ScreenLayout.inject(...)` MUST include `slots: { floatingButton: true, ... }`. Missing slot → `GEN-FLOATING-BUTTON-SLOT`.
- **Constructor:** `const floatingBtn = new FloatingButtonComponent({ slotId: 'mathai-floating-button-slot' });` — do NOT pass a different slotId; the slot is fixed-position and lives as a sibling of the layout root.
- **Visibility is game-state-driven, NOT interaction-driven.** Component starts hidden. Define an `isSubmittable()` predicate over `gameState` (e.g. `return gameState.userInput.trim() !== '';`, or `return gameState.placedTiles.length === gameState.expectedTiles;`). Call `floatingBtn.setSubmittable(isSubmittable())` from EVERY handler that can change the predicate's value: `input`, `change`, `keyup` on inputs; `click` on option chips; `drop` / `dragend` on DnD targets; any programmatic state mutation (undo, reset, clear). Never show-once and rely on a single flip — the button must disappear again when the player clears their input. Missing predicate wiring → `GEN-FLOATING-BUTTON-PREDICATE`.
- **Submit hidden by default — predicate must gate on real input.** Empty / no-input submits are prevented by hiding the button, NEVER by counting as a wrong attempt or costing a life. `setSubmittable(true)` as a literal is forbidden; so are predicates that accept empty input (`length >= 0`, `length >= -1`, `length !== -1`, untrimmed string-length checks). Validator: `GEN-FLOATING-BUTTON-SUBMIT-DEFAULT`. PART-050 Lifecycle § 2.

  ```js
  // WRONG — button always visible, penalises empty taps
  floatingBtn.setSubmittable(true);
  floatingBtn.setSubmittable(gameState.selectedIds.length >= 0);
  floatingBtn.setSubmittable(gameState.userInput.length >= 0);

  // RIGHT — predicate gates on real input
  floatingBtn.setSubmittable(gameState.selectedIds.length >= 1);
  floatingBtn.setSubmittable(gameState.placedTiles.length === gameState.expectedTiles);
  floatingBtn.setSubmittable(gameState.userInput.trim().length > 0);
  ```
- **`autoSubmit: true` input listener — no `setSubmittable`, no `setMode('submit')`.** When the spec declares `autoSubmit: true` ([PART-050 § `autoSubmit` spec flag](../../../parts/PART-050.md#top-level-spec-flag--autosubmit)), the entire predicate path above is FORBIDDEN. Input handlers mutate `gameState` only; the game's internal commit handler (timer `onEnd`, drag-drop drop callback, canvas commit) calls `endGame(correct)` directly when the commit condition is met. Validator `GEN-AUTOSUBMIT-NO-SUBMITTABLE` fails any `setSubmittable(<non-false>)`, `setMode('submit')`, or `floatingBtn.show()` call.

  ```js
  // WRONG when autoSubmit:true — re-shows Submit on every keystroke
  inputEl.addEventListener('input', function (e) {
    gameState.userInput = e.target.value;
    floatingBtn.setSubmittable(isSubmittable());   // ❌ GEN-AUTOSUBMIT-NO-SUBMITTABLE
  });
  floatingBtn.setMode('submit');                    // ❌ same rule
  floatingBtn.show();                               // ❌ same rule

  // RIGHT when autoSubmit:true — input mutates state only; commit fires externally
  inputEl.addEventListener('input', function (e) {
    gameState.userInput = e.target.value;
    gameState.hasInteracted = true;
  });

  // Commit handler (timer onEnd / drop / canvas):
  function onCommit() {
    if (gameState.isProcessing) return;
    gameState.isProcessing = true;
    const correct = evaluate(gameState.userInput);
    recordAttempt({ correct, /* ... */ });
    endGame(correct);                               // direct path, no Submit tap
  }
  ```

  `FloatingButtonComponent` stays instantiated under `autoSubmit:true` so it can ship Next at end-of-game — only Submit / Retry are absent. Allowed hide calls (`setSubmittable(false)`, `setMode(null)`, `hide()`) remain usable if the commit path needs to dismiss transient state.

- **`setMode(...)` argument enum.** `setMode` accepts exactly four values: `'submit'`, `'retry'`, `'next'`, `null`. Anything else (`'hidden'`, `''`, `undefined`, `'done'`) is a silent no-op — the component's internal switch falls through and the visible state never changes. Use `setMode(null)` to hide; never `setMode('hidden')`. Validator: `GEN-FLOATING-BUTTON-MODE-STRING`.
- **Submit handler (auto-hide on click):** when the player taps Submit, the component **auto-hides the button immediately** (internal `setMode(null)` before the handler runs). No need to return a Promise or manually call `setDisabled` — the hide is automatic, regardless of whether the handler is sync or async. The handler's job is to evaluate, await feedback, and then re-show the button in the NEXT mode: `setMode('retry')` (when an explicit retry button is the chosen UX — see [PART-050 § Try Again lifecycle](../../../parts/PART-050.md#try-again-lifecycle)), `setMode(null)` (predicate-driven re-show — the next interaction handler decides), or continue to end-game flow. `setMode('retry')` is the canonical mode whenever the wrong-with-lives UX shows an explicit retry button — this applies to standalone games (validator-enforced) AND to multi-round games with `spec.roundRetryButton: true`. Multi-round games without the flag use `setMode(null)` (predicate-driven). Register as `floatingBtn.on('submit', async () => { /* evaluate, await feedback, setMode('retry' | null) */ });`. Sync fire-and-forget is also safe: `floatingBtn.on('submit', () => { handleSubmit(...); })` — the button hides immediately and the async `handleSubmit` flips mode when done. Do NOT directly flip `setMode('next')` from the submit handler — Next appears AFTER the end TransitionScreen dismisses (multi-round) or AFTER the inline-feedback renders (standalone), not as a reaction to submit.
- **Next flow — Next is the LAST thing the player sees.** Every FloatingButton-using game MUST wire the Next button, AND `setMode('next')` MUST happen only AFTER feedback audio has completed. The sequence differs by shape:

  **Standalone (`totalRounds: 1`) — NO TransitionScreen.** The inline feedback panel in `#gameContent` IS the end-of-game display. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks TransitionScreen usage in standalone.
  ```js
  async function endGame(correct) {
    postAttemptComplete(correct);                                     // 0. host preload hook — BEFORE any await
    await FeedbackManager.play(correct ? 'correct' : 'incorrect');   // 1. await feedback
    renderInlineFeedbackPanel(correct);                               // 2. update #gameContent
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');  // 3. post
    floatingBtn.setMode('next');                                      // 4. Next appears
  }

  floatingBtn.on('next', function () {
    window.parent.postMessage({ type: 'next_ended' }, '*');
    floatingBtn.destroy();
  });
  ```
  ScreenLayout.inject() for standalone omits `transitionScreen`: `slots: { floatingButton: true, previewScreen: true }` (no `transitionScreen` key).

  **Multi-round (`totalRounds > 1`) — TransitionScreen with `buttons: []` + onDismiss.**
  ```js
  async function endRound(correct) {
    await FeedbackManager.play(correct ? 'correct' : 'incorrect');   // 1. await feedback
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');  // 2. post
    transitionScreen.show({ stars: correct?3:0, content: resultsHtml, buttons: [] });  // 3. no buttons
    transitionScreen.onDismiss(() => {                                // 4. dismiss callback
      transitionScreen.hide();
      floatingBtn.setMode('next');                                    // 5. Next appears
    });
  }

  floatingBtn.on('next', function () {
    window.parent.postMessage({ type: 'next_ended' }, '*');
    floatingBtn.destroy();
  });
  ```
  **BANNED patterns (validator `GEN-FLOATING-BUTTON-NEXT-TIMING` / `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` / `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` will block these):**
  - ❌ `postGameComplete(...); floatingBtn.setMode('next');` in the body of `endGame()` — Next appears during feedback audio.
  - ❌ `setMode('next')` in the same function as a `game_complete` postMessage without any `await` / `transitionScreen.onDismiss(` / `transitionScreen.hide()` separating them.
  - ❌ Fire-and-forget end-of-game feedback (`FeedbackManager.play(...).catch(...)` without `await`) — end-of-game feedback MUST be awaited so the TransitionScreen and Next button appear AFTER audio completes, not simultaneously.
  - ❌ **`transitionScreen.show({ buttons: [{ text: 'Next', action: function() { floatingBtn.setMode('next'); } }] })` — WRONG.** This produces a confusing double-Next UX (the card has a Next button whose click reveals ANOTHER Next button at the bottom). Victory / game_over TransitionScreens MUST use `buttons: []` (empty array). The player tap-dismisses the card; the FloatingButton Next appears only then. Any `text: 'Next' / 'Continue' / 'Done' / 'Finish' / 'Play Again'` inside a TransitionScreen's `buttons:` array fires `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`. Welcome / round-intro / motivation screens may still have buttons (`I'm ready`, `Let's go`, `Skip`) — those labels are not reserved.
  - ❌ **`transitionScreen.show(...)` OR `new TransitionScreenComponent(...)` in a standalone (`totalRounds: 1`) game — WRONG.** Standalone games have a single question, single submit, single end state — nothing to transition between. The inline feedback panel in `#gameContent` IS the end-of-game display. TransitionScreen in standalone is architecturally redundant AND invites the double-Next regression. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks this. Omit the `transitionScreen: true` slot from `ScreenLayout.inject()` and do NOT instantiate the component.

  Validator rules: `GEN-FLOATING-BUTTON-NEXT-MISSING`, `GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE`, `GEN-FLOATING-BUTTON-NEXT-TIMING`.
- **Try Again flow — wiring depends on game shape.** Detailed re-enable timing per shape lives in [state-and-guards.md § Lifecycle matrix](../../interaction/reference/state-and-guards.md#interaction-lifecycle--canonical-matrix). Three canonical UX patterns; pick exactly one per game:

  1. **Standalone + `totalLives > 1`** — explicit retry button (validator-enforced). Required when `spec.totalRounds: 1` AND `spec.totalLives > 1`. Wired below.
  2. **Multi-round, `roundRetryButton: false` (default)** — predicate-driven. After wrong-with-lives audio, `setMode(null)`; next interaction's predicate re-shows Submit. No retry button. See flow-implementation.md § Round loop pattern (predicate-driven variant).
  3. **Multi-round, `roundRetryButton: true` (opt-in)** — explicit retry button per round. After wrong-with-lives audio, `setMode('retry')`; the retry handler triggers same-round re-render. Wired below.

  **Canonical sequence — Standalone explicit retry (path 1):**
  ```js
  // Inside the wrong-answer branch of on('submit'):
  gameState.lives -= 1;
  gameState.tries += 1;                          // session-scoped counter; paired with every lives decrement
  gameState.attempts.push({
    correct: false,
    is_retry: (gameState.retryCount || 0) > 0,
    /* other required fields */
  });
  await FeedbackManager.play('incorrect');

  if (gameState.lives > 0) {
    gameState.retryCount = (gameState.retryCount || 0) + 1;
    floatingBtn.setMode('retry');              // label: "Try again"
    // DO NOT flip isProcessing / .dnd-disabled / voiceInput here — the on('retry') handler is the source of truth (no renderRound between submit and retry).
  } else {
    endGame(false);                            // out of lives — feeds into Next flow
  }

  floatingBtn.on('retry', function () {
    // Clear input / feedback UI per spec.retryPreservesInput (default: clear)
    if (!RETRY_PRESERVES_INPUT) {
      inputEl.value = '';
      gameState.userInput = '';
    }
    clearFeedbackUI();

    // Re-enable in source order. The handler is the single source of truth for re-enable
    // (per state-and-guards.md § Exception patterns — Standalone Try Again).
    gameState.isProcessing = false;
    if (boardEl) boardEl.classList.remove('dnd-disabled');     // P6 — load-bearing on @dnd-kit/dom
    if (voiceInput) voiceInput.enable();                        // P17
    if (timer) timer.resume();                                  // PART-006 — paused at submit
    floatingBtn.setMode(null);                                  // predicate takes over again
    if (inputEl && !RETRY_PRESERVES_INPUT) inputEl.focus();
  });
  ```

  **Canonical sequence — Multi-round explicit retry (path 3, `roundRetryButton: true`):**
  ```js
  // Inside the wrong-answer branch of on('submit'):
  gameState.lives -= 1;
  gameState.tries += 1;                          // session-scoped counter; paired with every lives decrement
  await FeedbackManager.play('incorrect');

  if (gameState.lives > 0) {
    floatingBtn.setMode('retry');             // label: "Try again"
    // DO NOT flip isProcessing / .dnd-disabled here — renderRound is the source of truth (path delegates to it).
  } else {
    endGame(false);
  }

  floatingBtn.on('retry', function () {
    clearFeedbackUI();
    floatingBtn.setMode(null);
    renderRound(gameState.currentRound);      // re-render SAME round; renderRound's first 3 lines
                                              // flip isProcessing = false and remove .dnd-disabled.
  });
  ```
  Alternative in-handler variant (when same-round re-render is too heavy): mirror the standalone retry handler body. Pick one per game and template consistently.

  `RETRY_PRESERVES_INPUT` is a game-scope const set from `spec.retryPreservesInput` (default `false` = clear input). The retry handler MUST preserve `gameState.lives`, `gameState.attempts`, `gameState.score`, and `gameState.retryCount` — NEVER reset them. Validator rules: `GEN-FLOATING-BUTTON-RETRY-STANDALONE`, `GEN-FLOATING-BUTTON-RETRY-LIVES-RESET`, `GEN-FLOATING-BUTTON-RETRY-NO-SUBMITTABLE`. (Note: existing validators were written assuming standalone-only retry; if multi-round `roundRetryButton: true` ships, validator scope may need expansion. Tracked.)

  **Retry handler must NOT call `setSubmittable(...)` — predicate-driven re-show is owned by the next interaction handler.** When `retryPreservesInput: true`, the predicate is still satisfied by the preserved input; calling `setSubmittable(isSubmittable())` (or `setSubmittable(true)`) inside the retry handler immediately re-shows Submit and lets the player tap-tap through Try Again → Submit with the same wrong answer. The whole point of Try Again is to force at least one edit before re-evaluating. Validator: `GEN-FLOATING-BUTTON-RETRY-NO-SUBMITTABLE`.

  ```js
  // WRONG — re-shows Submit instantly when input is preserved
  floatingBtn.on('retry', function () {
    clearFeedbackUI();
    gameState.isProcessing = false;
    floatingBtn.setMode(null);
    floatingBtn.setSubmittable(isSubmittable()); // ← forbidden
  });

  // RIGHT — predicate fires from the player's next edit
  floatingBtn.on('retry', function () {
    clearFeedbackUI();
    gameState.isProcessing = false;
    if (boardEl) boardEl.classList.remove('dnd-disabled');
    if (voiceInput) voiceInput.enable();
    if (timer) timer.resume();
    floatingBtn.setMode(null);
  });
  ```
- **No duplicate buttons — DELETE, don't rename.** When FloatingButton is instantiated, NO other `<button>` in the source may carry a Submit / Check / Done / Commit / Retry / Next / CTA word in its **id, class, data-testid, aria-label, OR inner text**. Validator `5e0-FLOATING-BUTTON-DUP` scans all 5 attributes. **Known evasion pattern (do NOT attempt):** renaming `id="bbSubmitBtn" class="bb-submit"` to `id="bbGoBtn" class="bb-go"` while keeping `data-testid="bb-submit-btn"` and inner text `Submit` — rule still fires and the build fails. The correct fix is to DELETE the hand-rolled button entirely and wire its handler via `floatingBtn.on('submit', ...)`. If tests reference a `data-testid`, point them at the FloatingButton DOM (`.mathai-fb-btn-primary`), or add a `data-testid` via the FloatingButton API — do not keep a parallel button to satisfy tests. Reset remains inline per PART-022 — FloatingButton does NOT absorb Reset.
- **End-of-game teardown (Next-tap, NOT `endGame()`):** the `on('next', ...)` handler posts `next_ended`, then calls `previewScreen.destroy()` (and `answerComponent.destroy()` if applicable), then `floatingBtn.destroy()` last. `endGame()` MUST NOT call any `.destroy()` — destroys move into the Next handler so the header stays mounted while `show_star` lands.
- **AnswerComponent integration (PART-051) overrides the Next-flow chain shown above.** When the game has not opted out of `answerComponent`, the Next button is gated by AnswerComponent reveal, NOT by a TransitionScreen dismiss. See the AnswerComponent section below for the corrected end-game patterns. The patterns above remain authoritative ONLY for games with `answerComponent: false` in the spec.
- See `alfred/parts/PART-050.md` for the full API, dual-button variant, styling variables, and validator rule list.

### AnswerComponentComponent
Per PART-051. Game-building rules:
- **Required by default — opt-out via `answerComponent: false` in spec.md.** Mirrors PART-039 / PART-050 opt-out trust model. Step 4 (Build) MUST NOT write `answerComponent: false` into spec.md to silence the validator; the spec is the spec author's contract, not a build-time escape hatch.
- **CDN:** include `https://storage.googleapis.com/test-dynamic-assets/packages/components/answer-component/index.js` OR the bundled `components/index.js` (which loads it automatically). Missing tag → `GEN-ANSWER-COMPONENT-CDN`.
- **Slot:** `ScreenLayout.inject(...)` MUST include `slots: { answerComponent: true, ... }`. Missing slot → `GEN-ANSWER-COMPONENT-SLOT`. The slot is the last child of `.game-stack`, so the answer card visually appears below the play area and any inline feedback panel.
- **Constructor:** `const answerComponent = new AnswerComponentComponent({ slotId: 'mathai-answer-slot' });` at DOMContentLoaded, alongside the other slot components.
- **Visibility is game-state-driven, NOT interaction-driven.** Component starts hidden. Reveal is a single `answerComponent.show({ slides })` call inside the end-game path AFTER `await FeedbackManager.play(...)` completes. Never reveal during preview state, never reveal mid-round. Validator `GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW` rejects `.show(...)` inside any `if (previewScreen.isActive())` / `state === 'preview'` true-branch.
- **Slide payload — `render(container)` callbacks ONLY.** Each slide is `{ render(container) { /* mount evaluated answer view */ } }`. Validator `GEN-ANSWER-COMPONENT-SLIDE-SHAPE` rejects `html:` and `element:` keys. The component clears the container before each render — games can construct DOM from `gameState` / round data without leak concerns.
- **Render only the EVALUATED elements.** For drag-drop questions the slide must show the drop-zones in their solved state, NOT the draggable bank. For grid questions, the solved grid. For tables, the rows in their correct state. Anything that is "input affordance" (drag bank, MCQ option chips, text input box) is NOT shown — only the parts that were graded.
- **Use the `.mathai-answer-stack` and `.mathai-answer-row` utility classes** (provided by the component, no game CSS needed) to lay out multi-section answer views. The slide container itself is plain block flow with auto `> * + *` margins, so loose children get a 14 px rhythm by default; for richer layouts wrap content in `<div class="mathai-answer-stack">` (vertical column with `gap`) and use `<div class="mathai-answer-row">` for horizontal chip groups. Avoid emitting tightly-packed sibling `<div>`s with no wrapper — they default to centred block flow but games that need horizontal grouping or richer spacing should use the helpers. See PART-051 § "Layout helpers".
- **End-game multi-round chain (REQUIRED — supersedes the FloatingButton "Multi-round lifecycle" pattern when AnswerComponent is in use):** the [Victory Celebration screen](../../../parts/PART-050.md#canonical-names) (yay + `show_star` animation) plays FIRST, hands off to AnswerComponent via its `onMounted` setTimeout, and the floating Next is single-stage exit. `answerComponent.show(...)` MUST NOT appear inside `endGame()`. **Function-name canon:** `showWinConfirmation()` is the optional button-gated pre-screen with Claim Stars; `showVictoryCelebration()` is the celebration with sound + animation. Legacy code may use `showVictory()` / `showStarsCollected()` — these names still work but new builds emit the canonical names.
  ```js
  async function endGame(correct /* called after the final round resolves */) {
    postAttemptComplete(correct);                                           // 0. host preload hook — BEFORE any await
    await FeedbackManager.play(/* final round */);                          // 1. await feedback
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*'); // 2. post game_complete
    if (gameState.stars > 0) showWinConfirmation(); else showGameOver();    // 3. route to Win Confirmation / Game Over
  }

  // Optional Win Confirmation gate (game-specific button-gated pre-screen).
  // Shows stars + a "Claim Stars" button whose action calls
  // showVictoryCelebration(). NEVER call answerComponent.show(...) from here.
  async function showWinConfirmation() {
    await transitionScreen.show({
      title: 'Victory 🎉',
      stars: gameState.stars,
      buttons: [{
        text: 'Claim Stars',
        primary: true,
        action: function () { transitionScreen.hide(); showVictoryCelebration(); }
      }],
      persist: true,
      onMounted: function () { /* dynamic VO if any */ }
    });
  }

  // Victory Celebration — the celebration step. Plays the yay sound + show_star
  // animation, then HANDS OFF to the answer carousel via setTimeout.
  async function showVictoryCelebration() {
    await transitionScreen.show({
      title: 'Yay! Stars collected!',
      stars: gameState.stars,
      buttons: [],
      persist: true,
      onMounted: function () {
        (async function () {
          await FeedbackManager.sound.play('victory_sound_effect', { sticker: STICKER_CELEBRATE });
          window.postMessage({
            type: 'show_star',
            data: { count: gameState.stars, variant: 'yellow', score: gameState.score + '/' + gameState.totalRounds }
          }, '*');
          // After the star animation lands, reveal the answer carousel.
          // Victory Celebration stays mounted (persist:true, no hide() here per
          // default-transition-screens.md) — it is the celebration backdrop
          // for the answer review. Both surfaces tear down together on Next.
          setTimeout(function () {
            showAnswerCarousel();
          }, 1500);
        })();
      }
    });
  }

  // The ONLY place answerComponent.show is called in a multi-round game.
  function showAnswerCarousel() {
    answerComponent.show({
      slides: rounds.map(function (round) {
        return { render: function (container) { renderAnswerForRound(round, container); } };
      })
    });
    floatingBtn.setMode('next');                                            // Next appears once
  }

  // SINGLE-STAGE Next — by the time it's visible, all celebration screens have played.
  floatingBtn.on('next', function () {
    answerComponent.destroy();
    window.parent.postMessage({ type: 'next_ended' }, '*');
    if (previewScreen) previewScreen.destroy();
    floatingBtn.destroy();
  });
  ```
  Validator rules `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` and `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE` enforce both halves of this pattern. The legacy two-stage Next handler — first click hides AnswerComponent + shows yay + sets mode null, second click posts next_ended — is forbidden because by the time Next is visible the player has already seen the entire celebration sequence.
- **End-game standalone chain:**
  ```js
  async function endGame(correct) {
    postAttemptComplete(correct);                                             // 0. host preload hook — BEFORE any await
    await FeedbackManager.play(correct ? 'correct' : 'incorrect');           // 1. await feedback
    renderInlineFeedbackPanel(correct);                                       // 2. inline panel in #gameContent
    window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');  // 3. post
    answerComponent.show({                                                    // 4. reveal answers
      slides: buildAnswerSlides()  // 1 slide if single answer, N if multiple
    });
    floatingBtn.setMode('next');                                              // 5. Next appears
  }

  floatingBtn.on('next', function () {
    answerComponent.destroy();
    window.parent.postMessage({ type: 'next_ended' }, '*');
    floatingBtn.destroy();
  });
  ```
- **Single-slide path (standalone with one answer).** When `slides.length === 1`, the component disables prev/next nav (opacity 0.3, `aria-disabled="true"`, no pointer events) and the counter shows `1/1`. Build the slide builder so it always returns at least one slide; never call `show({ slides: [] })`.
- **BANNED pattern — `answerComponent.show(...)` inside `endGame()` for multi-round games.** This is the regression `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` catches. The multi-round end-game flow MUST be: `endGame()` posts `game_complete` and routes to `showVictory()` / `showStarsCollected()`. Stars Collected's `onMounted` plays the celebration, then via `setTimeout` calls a `showAnswerCarousel()`-style function. The Stars Collected TS stays mounted (NO `transitionScreen.hide()` in `onMounted` — see default-transition-screens.md). That function is the only place `answerComponent.show(...)` lives. Calling it directly from `endGame()` (or from a Victory `Claim Stars` action that bypasses Stars Collected) skips the celebration AND forces the multi-stage Next handler that `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE` also rejects.
- **Restart safety.** If the game supports restart, call `answerComponent.destroy()` (or `hide()` + `update({ slides: [] })`) inside `restartGame()` so the carousel state from a prior round doesn't leak into the new run.
- See `alfred/parts/PART-051.md` for the full API, lifecycle diagrams, invariants, and validator rule list.

### Debug Functions
Per PART-012. See `parts/PART-012.md`.

### SignalCollector
Per PART-042. Game-building rules:
- `restartGame` must call `signalCollector.reset()` — do NOT seal + re-instantiate (GEN-SIGNAL-RESET).
- See `parts/PART-042.md` for full API.

### PreviewScreen
Per PART-039. Game-building rules:
- **Default ON, opt-out via spec.** Every game includes the preview UNLESS the spec declares top-level `previewScreen: false`. When enabled (the default), `ScreenLayout.inject` must include `slots: { previewScreen: true, ... }` and the rules below apply. When opted out: OMIT the `previewScreen` key from `slots` entirely, do NOT instantiate `PreviewScreenComponent`, do NOT emit any `#mathai-preview-slot` / `.mathai-preview-body` references, and have `DOMContentLoaded` call the first TransitionScreen (level/round intro) directly — no `setupGame()` / `showPreviewScreen()`. Existing pre-PART-039 templates (`make-x`, `estimate-it`, `keep-track`) show the no-preview initial-screen pattern. The rest of this section applies only to the enabled case.
- **Single source of instructions — STRICT.** The how-to-play copy is delivered ONCE via `content.previewInstruction` + `content.previewAudioText`. Gameplay screens (the DOM inside `#gameContent`) MUST NOT render ANY of the following:
  - A static instruction / prompt banner repeating or paraphrasing the preview instruction (e.g. "Find the two tiles...", "Tap two tiles...", "Select the correct answer").
  - Any element with a class/id containing `instruction`, `help-text`, `prompt-text`, `task-text`, `directions`, `how-to-play`.
  - Verbs like "Find", "Tap", "Select", "Choose", "Click", "Drag" as a heading/banner inside `#gameContent`. The preview already said it.
  A per-round *prompt* is allowed ONLY when it carries round-specific information that is NOT in the preview (e.g. "What is 3 × 4?" — the question itself; "Match the shapes below" after a round-type change screen). Generic how-to-play restated in different words is NOT distinct — it duplicates.
  When in doubt: omit the gameplay banner. Players already heard/read the preview. If the round-type change is material, convey it via a Round-N-intro TransitionScreen, not a banner.
- Instantiated in DOMContentLoaded with `{ slotId: 'mathai-preview-slot' }` only. Do NOT pass `autoInject`, `gameContentId`, `previewContent`, `questionLabel`, `score`, or `showStar`.
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview, onComplete })` is called as the LAST step of `setupGame()` — after `#gameContent` has been rendered. The `show()` option list is **exactly** those four keys plus optional `onPreviewInteraction`; no other options are accepted.
- Preview audio URL sourced from `content.previewAudio || fallbackContent.previewAudio || null`. Never hardcode.
- **Audio URL source hierarchy** (PART-039 layer order): `content.previewAudio` → `fallbackContent.previewAudio` → runtime TTS fallback using `previewAudioText` → 5s silent timer. The component handles the TTS fallback internally when `audioUrl` is null; you do NOT need to generate TTS yourself at runtime. Deploy step patches `fallbackContent.previewAudio` with a CDN URL from `previewAudioText` TTS.
- **`previewScreen.isActive()`** returns `true` while the preview overlay is mounted (between `show()` and `switchToGame()`). Use this in any timed fallback (setTimeout, requestIdleCallback, race-guards) that might otherwise fire during a live preview. Preview does NOT mutate `gameState.phase`, so `phase === 'start_screen'` stays true for the entire preview — `isActive()` is the authoritative signal. See `html-template.md` rule 11 (standalone-fallback gate).
- `onComplete` callback receives `previewData` and must call `startGameAfterPreview(previewData)` — see pattern below.
- The FloatingButton `on('next', ...)` handler calls `previewScreen.destroy()` AFTER posting `next_ended`. `endGame()` MUST NOT call `destroy()` — synchronous teardown there kills the async `show_star` animation before it lands.
- `restartGame()` must NOT call `previewScreen.show()` or `setupGame()` — preview is once per session.
- `hide()` does NOT exist. Do not call it.
- VisibilityTracker's `onInactive`/`onResume` must also invoke `previewScreen.pause()`/`previewScreen.resume()`. The pause popup itself is rendered by `VisibilityTracker`'s built-in `PopupComponent` — leave `autoShowPopup` at its default (`true`) and customize copy via `popupProps`. **Never** build a game-local pause overlay. Canonical wiring:
  ```javascript
  visibilityTracker = new VisibilityTracker({
    // autoShowPopup defaults to true — do NOT set to false
    popupProps: {
      // Optional copy overrides; defaults are "Resume Activity" / "Resume"
      // title: 'Paused',
      // description: 'Tap Resume to continue.',
      // primaryText: 'Resume',
    },
    onInactive: function() {
      try { FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); } catch(e) {}
      try { if (timer) timer.pause({ fromVisibilityTracker: true }); } catch(e) {}
      try { if (previewScreen) previewScreen.pause(); } catch(e) {}
    },
    onResume: function() {
      try { FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); } catch(e) {}
      try { if (timer) timer.resume({ fromVisibilityTracker: true }); } catch(e) {}
      try { if (previewScreen) previewScreen.resume(); } catch(e) {}
    }
  });
  ```
- **Header star runtime toggle.** `previewScreen.setStar(visible: boolean)` hides or shows the header star at runtime (use-case: clear the star indicator after a wrong answer, re-show on next round).
- **Instruction persists in game state — do NOT hide it.** After `switchToGame()`, `#previewInstruction` stays rendered above `#gameContent` in the shared scroll container. This is a product requirement: students must be able to scroll up to re-read the instruction at any time. Do not write code that toggles `#previewInstruction`, `.mathai-preview-header`, `#mathai-preview-slot` visibility, or any `.mathai-preview-*` class. If the stacked preview-text + game layout feels cramped in your game, fix it inside `#gameContent` (tighter game UI, shorter `fallbackContent.previewInstruction`) — never by reaching into preview DOM. Validator rule `5e0-DOM-BOUNDARY` enforces the ban.
- See `alfred/parts/PART-039.md` (distilled summary) and `alfred/parts/PART-039-preview-screen.md` for the authoritative full spec.

---

## Game-Building Procedures (HOW to wire components together)

### syncDOM

```javascript
function syncDOM() {
  var app = document.getElementById('app');
  if (!app) return;
  app.setAttribute('data-phase', gameState.phase);
  app.setAttribute('data-score', gameState.score);
  // Lives games: app.setAttribute('data-lives', gameState.lives);
  // Recommended: app.setAttribute('data-round', gameState.currentRound);
}
```

**Mandatory call sites -- syncDOM MUST be called immediately after every gameState change:**
phase change, score change, lives change, round advance. At minimum 3 calls (GEN-PHASE-MCQ).
**Target:** Always `#app`. Never `document.body`. Test harness reads `#app[data-phase]`.

### Initialization Sequence

Canonical boot order is defined in [PART-008 § Boot ordering](../../../parts/PART-008.md#boot-ordering). Reference shape:

```javascript
document.addEventListener('DOMContentLoaded', async function () {
  try {
    // 1. Block on CDN packages first
    await waitForPackages();

    // 2. Construct every component (FeedbackManager, SignalCollector, ScreenLayout,
    //    ProgressBar, TransitionScreen, PreviewScreen, FloatingButton, AnswerComponent, ...)
    //    See html-template.md § DOMContentLoaded 16-step sequence for the canonical list.
    await FeedbackManager.init();
    // ... new SignalCollector(...), ScreenLayout.inject(...), new ProgressBarComponent(...), etc.

    // 3. Register the message listener AFTER components are ready
    window.addEventListener('message', handlePostMessage);

    // 4. ONLY NOW signal ready — harness will respond with game_init
    window.parent.postMessage({ type: 'game_ready' }, '*');

    // 5. Boot
    setupGame();
  } catch (e) {
    console.error('[init] ' + e.message);
  }
});
```

### startGame

```javascript
function startGame() {
  if (gameState.isActive) return;
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.duration_data.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.score = 0;
  gameState.attempts = [];           // fresh-session boot ONLY — `restartGame()` does NOT touch this
  gameState.events = [];
  gameState.tries = 1;               // counter = 1 + lives_lost_across_session; survives `restartGame()`
  gameState.isProcessing = false;
  gameState.gameEnded = false;
  gameState.phase = 'gameplay';
  // Lives games: gameState.lives = gameState.totalLives;
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  syncDOM();
  render();
}
window.startGame = startGame;
```

### Answer Handler Sequence

The core game loop MUST follow this order:
1. Guard: `if (gameState.isProcessing || gameState.gameEnded) return;` then `isProcessing = true`
2. Evaluate correctness
3. `recordAttempt()` (per PART-009 -- all 12 fields)
4. `trackEvent('answer_submitted', ...)` (per PART-010)
5. Update internal `score`/`lives` counters and call `syncDOM()`. Do NOT touch the ActionBar header here — the header is locked at boot by `game_init.data.score` and updated only by the end-of-game `show_star` celebration. `setScore` and `setQuestionLabel` are not part of the public API.
6. **Terminal-answer detection + `attempt_complete`.** Compute `isLastRound` / `isGameOver` (the same flags the round-complete branch reads). If EITHER is true, this is the terminal answer of the session — call `postAttemptComplete(correct)` here, BEFORE the visual feedback / SFX / TTS chain. The host uses this signal to start preloading the next worksheet item while the celebration plays. Standalone games (`totalRounds: 1`) fire on every submit (each submit is terminal — either correct, or wrong with `lives → 0`). Feedback-only games pass `correct: true`. See PART-008 § attempt_complete and `postmessage-schema.md` § attempt_complete. Forbidden between `recordAttempt(...)` and `postAttemptComplete(...)`: any `await`, any `setTimeout`, any `transitionScreen.show()`, any audio call.
7. Visual feedback (selected-wrong/selected-correct classes, correct-reveal)
8. FeedbackManager audio (per `skills/feedback/SKILL.md`):
   - **Single-step correct/wrong (DEFAULT):** `await Promise.all([ FeedbackManager.sound.play(id, {sticker}), new Promise(function(r) { setTimeout(r, 1500); }) ])` → then **AWAIT** `try { await FeedbackManager.playDynamicFeedback({audio_content: round.<X>TTS, subtitle: round.<X>Subtitle, sticker}); } catch(e){}`. SFX awaited (~1.5s floor) for predictable visual flash; TTS awaited so the explanation finishes BEFORE round advance — without await, the subtitle/audio paints over the next round's transition. Package bounds TTS resolution at 3 s (API timeout) / 60 s (streaming) so it can never freeze the game indefinitely; `try/catch` swallows rejection so a network failure still advances. **Subtitle pairing rule:** `subtitle` MUST come from a paired authored field on the same round object (`<X>TTS` ↔ `<X>Subtitle` convention; see spec-creation/SKILL.md § 5e-i). NEVER hard-code a generic literal like `'Great job!'` or `'Try again!'` while `audio_content` reads `round.<X>TTS` — that strands students who can't hear the audio. **Side-effect ordering rule:** the chain is strictly `SFX-await → TTS-await → advance` in source order. Any side-effect that advances the game lifecycle — `setMode('next' / 'retry')`, `nextRound()`, `endGame()`, `showStarsCollected()`, `answerComponent.show()`, `transitionScreen.hide()`, `floatingBtn.destroy()`, `window.postMessage({type:'show_star',...})` — MUST appear AFTER the awaited `playDynamicFeedback` line. Placing any side-effect between the awaited SFX and the awaited TTS (or before the awaited SFX) means it executes while audio is still in flight. Validators: `GEN-FEEDBACK-TTS-AWAIT` (await), `GEN-FEEDBACK-SUBTITLE-LINKED-TO-AUDIO` (subtitle pairing), `GEN-FEEDBACK-ORDER` (side-effect ordering).
   - **Multi-step mid-round match:** `FeedbackManager.sound.play(id, {sticker}).catch(...)` — fire-and-forget. NO dynamic TTS, NO subtitle. SFX + sticker only.
   - Last-life wrong: ALWAYS play wrong SFX (awaited, Promise.all 1500ms min) BEFORE endGame(false) — never skip
9. **Advance to next round** via `renderRound()` / `loadRound()` / `endGame()`. For the default path (advance after correct, advance after wrong with predicate-driven retry), DO NOT set `isProcessing = false` here and DO NOT re-enable inputs in the handler after audio. `renderRound()` / `loadRound()` is the source of truth for this path: it sets `isProcessing = false`, removes `.dnd-disabled`, re-enables inputs (buttons, voice input), resumes the timer, clears marks, and resets state for the new round.

   **Exception paths** — these re-enable in the handler itself (no `renderRound()` between submit and next playable state):
   - **Standalone Try Again** (`spec.totalRounds: 1` + `totalLives > 1`) — `on('retry')` handler re-enables. See § Try Again flow above.
   - **Multi-round explicit retry button** (`spec.roundRetryButton: true`) — `on('retry')` handler either re-enables directly OR delegates to `renderRound(currentRound)` for same-round re-render. See § Try Again flow above.
   - **API-failure recovery** — catch branch re-enables; see § Re-enable exception patterns below.
   - **Terminal game-over** — `endGame()` removes `.dnd-disabled` from the board wrapper BEFORE teardown so end-game UI (Try Again on Game Over TS) stays tappable; see § Re-enable exception patterns below.
   - **Per-round / global timer expiry** — `onEnd` callback is a submit-equivalent; see [PART-006 § `onEnd` lifecycle contract](../../../parts/PART-006.md) and the matrix.

   Full lifecycle timing per (game shape × event) lives in [state-and-guards.md § Lifecycle matrix](../../interaction/reference/state-and-guards.md#interaction-lifecycle--canonical-matrix).

### Re-enable exception patterns

For paths that bypass `renderRound()`, the handler is responsible for re-enabling. The contract is: flip every disable in source order — `isProcessing = false`, `.dnd-disabled` remove (P6), `voiceInput.enable()` (P17), `timer.resume()` (PART-006). Skipping any one ships the input-stuck-disabled bug.

```js
// API-failure recovery — inside submit handler's catch branch.
// The player must be able to retry their submit; infra failure must NOT decrement lives.
try {
  await llmEvaluate(answer);
} catch (e) {
  showApiErrorBanner(e);

  gameState.isProcessing = false;
  if (boardEl) boardEl.classList.remove('dnd-disabled');
  if (voiceInput) voiceInput.enable();
  if (timer) timer.resume();
  return;   // do NOT advance round; do NOT decrement lives
}

// Terminal game-over — remove the board-level lock BEFORE endGame() teardown,
// so end-game UI (Try Again on Game Over TS, Claim Stars on Victory TS) remains tappable.
// Signature: endGame(correct). Multi-round caller computes
// `correct = (gameState.lives > 0 && gameState.stars > 0)`. Standalone caller passes
// the Submit handler's evaluation. Feedback-only games hardcode `endGame(true)`.
function endGame(correct) {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;

  if (boardEl) boardEl.classList.remove('dnd-disabled');   // unlock the board for end-game UI
  destroyDndForRound();                                     // tear down the listeners
  if (timer) timer.pause();                                 // PART-006 § Mandatory rules
  if (voiceInput) voiceInput.disable();                     // mic stays disabled through end-game

  postGameComplete(correct);                                // PASSTHROUGH to metrics.correct
  if (correct) showVictory();
  else showGameOver();
}
```

### Round mount narration (renderRound) — shape-conditional

When the round DOM mounts inside `renderRound(n)`, the build MAY emit a fire-and-forget question-narration call (CASE 3 in feedback/SKILL.md):

```javascript
// Inside renderRound(n), AFTER the question DOM is in the DOM tree:
if (round.questionTTS) {
  FeedbackManager.playDynamicFeedback({
    audio_content: round.questionTTS,
    subtitle:      round.questionSubtitle,   // PAIRED — see Z7 / GEN-FEEDBACK-SUBTITLE-LINKED-TO-AUDIO
    sticker:       STICKER_NEUTRAL
  }).catch(function(){});                     // fire-and-forget; .catch() only, NEVER await, NEVER Promise.race
}
```

**Whether to emit this block depends on the game shape:**

- **Multi-round (`totalRounds > 1`):** emit unconditionally. The block is a no-op when the round has no `questionTTS`, so it's safe to leave in for every multi-round game.
- **Standalone (`totalRounds: 1`):** emit ONLY if the spec sets `roundMountNarration: true`. When the flag is absent or `false`, do NOT emit the block at all (not even a guarded `if (round.questionTTS)` form). The single puzzle is the entire payoff and the PreviewScreen instruction TTS just finished — auto-narrating the question on top clutters first interaction. See spec-creation/SKILL.md § Optional `roundMountNarration` flag and spec-review Z9.

The `.catch()` shape (NEVER `await`, NEVER `Promise.race`) is enforced by `5e0-FEEDBACK-RACE-FORBIDDEN` and the fire-and-forget convention in feedback/SKILL.md § CASE 3. Side-effect ordering rules (`GEN-FEEDBACK-ORDER`) do NOT apply here — this is fire-and-forget mount narration, not the awaited submit-handler chain.

### resetGame (restartGame)

Must reset mutable round-cycle state: `phase`, `currentRound`, `score`, `events`, `duration_data`, `isActive`, `isProcessing`, `gameEnded`, plus game-specific fields (GEN-RESTART-RESET). Lives games reset `lives`. Then `syncDOM()` + `render()`.

**Must NOT reset (session-scoped fields):** `attempts`, `tries`, `setIndex`. These survive `restartGame()` and accumulate across the entire iframe session. They are initialized at fresh page load (`startGame()` for `attempts`; gameState initializer for `tries` and `setIndex`) and rotated/incremented only inside specific lifecycle hooks:

- `setIndex` — rotated inside `restartGame()` BEFORE `resetGameState()` (`gameState.setIndex = (gameState.setIndex + 1) % sets.length`).
- `tries` — incremented in the wrong-answer / life-decrement branch alongside `gameState.lives -= 1`.
- `attempts` — pushed inside `recordAttempt()`; the array is the full session history.

Validator rules: `GEN-RESTART-RESET` (existing, with `attempts` removed from required-reset list), `GEN-RESTART-TRIES-PRESERVED`, `GEN-RESTART-ATTEMPTS-PRESERVED`. See [data-contract/SKILL.md § Session-scoped fields](../../data-contract/SKILL.md).

```javascript
window.restartGame = resetGame;  // REQUIRED -- replay tests call this
```

**Do NOT call `previewScreen.show()` or `setupGame()` from `restartGame()`.** Preview is shown once per session. Split the reset portion from the preview portion of `setupGame()` — `restartGame` reruns only the reset + first-round entry.

### Preview screen integration (setupGame + startGameAfterPreview)

Canonical trio per PART-039. Game DOM MUST be rendered into `#gameContent` BEFORE `previewScreen.show()` is called; `gameState.startTime` is set in `startGameAfterPreview`, NOT in `setupGame`.

```javascript
function setupGame() {
  var content = gameState.content || fallbackContent;
  // 1. Render initial round UI into #gameContent FIRST
  injectGameHTML();
  renderInitialState();

  // 2. Show preview LAST
  previewScreen.show({
    instruction: content.previewInstruction || fallbackContent.previewInstruction,
    audioUrl: content.previewAudio || fallbackContent.previewAudio || null,
    showGameOnPreview: content.showGameOnPreview === true,
    onComplete: function(previewData) { startGameAfterPreview(previewData); }
  });
}

function startGameAfterPreview(previewData) {
  gameState.previewResult = previewData;
  gameState.duration_data.preview = gameState.duration_data.preview || [];
  gameState.duration_data.preview.push({ duration: previewData.duration });

  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();

  if (timer && timer.start) timer.start();
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  if (signalCollector) signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' });

  renderRound(); // first gameplay entry
}
```

**Restart path** (no preview):
```javascript
function restartGame() {
  var sets = getAvailableSets((gameState.content && gameState.content.rounds) || fallbackContent.rounds);
  gameState.setIndex = (gameState.setIndex + 1) % sets.length;   // rotate BEFORE reset
  resetGameState();
  if (signalCollector) signalCollector.reset();
  gameState.startTime = Date.now();
  gameState.isActive = true;
  gameState.duration_data.startTime = new Date().toISOString();
  if (progressBar) progressBar.update(0, gameState.totalLives);   // safety-net (prior session)
  trackEvent('game_start', { totalRounds: gameState.totalRounds });
  renderRound();
}
```

`previewScreen.destroy()` is called from the FloatingButton `on('next', ...)` handler (after `next_ended` is posted), NOT from `endGame()`. Destroying mid-`endGame()` synchronously tears down the ActionBar and `#previewStar` before the async `show_star` animation can land.

### Wrapper persistence — showVictory / showGameOver pattern (CRITICAL)

Victory, Game Over, Play Again, and Try Again render **inside** the preview wrapper. The header (avatar, score, star) stays visible; the preview slot is never hidden or detached. Mount results via `TransitionScreenComponent.show(...)` into `mathai-transition-slot` (a sibling of `#gameContent` inside `.game-stack`). Do NOT create a top-level `#results-screen` overlay, do NOT call `previewScreen.destroy()` at this point, do NOT set `style.display='none'` on `mathai-preview-slot`, and do NOT re-parent `#gameContent`.

**Results mounting rule (PART-024):** pass the results metrics HTML via `transitionScreen.show({ content: metricsHTML, persist: true, buttons: [...] })`. `content` is rendered inside the transition card; `persist: true` keeps it visible until a button is tapped. Never create a sibling `<div id="results-screen">` overlay and never hide the preview wrapper to make room for it.

**All user-visible strings come from `pre-generation/screens.md`, not from this file.** The snippets below show *structure*; **title, subtitle, button labels (count + order), sticker/icon emoji, and audio id** for each transition are copied verbatim from the corresponding Elements table in `screens.md`. Do NOT invent extra buttons, do NOT rename buttons, do NOT alter titles/subtitles. Template variables in screens.md (`N`, `M`, `[Title]`, numeric examples like `"Round 1"`) are matched via placeholder — your HTML can concatenate `'Round ' + roundNum` and still match. `test/content-match.test.js` enforces this and fails the build on drift.

**Default transition screens** — `game_over`, `motivation`, `victory`, `stars_collected` have canonical templates in `alfred/skills/game-planning/reference/default-transition-screens.md`. The planner copies those verbatim into `screens.md`; game-building reads screens.md and emits the matching `transitionScreen.show(...)`. Short summary of the structural defaults (strings live in the planning doc):
- **Game Over** → `icons: ['😔']`, title "Game Over", subtitle "You ran out of lives!", single `Try Again` button.
- **Motivation** → no icons, title "Ready to improve your score? ⚡", single `I'm ready! 🙌` button.
- **Victory** → `stars: gameState.stars`, title "Victory 🎉", per-game subtitle, buttons depend on stars: `Claim Stars` alone for 3★, `Play Again` + `Claim Stars` (horizontal) otherwise.
- **Stars Collected** → no icons/stars/subtitle/buttons, two-line title via `styles: { title: { whiteSpace: 'pre-line' } }`, auto-dismiss via `duration: 2500`.

**FloatingButton ownership (CRITICAL — see default-transition-screens.md "FloatingButton ownership per screen" table).** Victory / Game Over / Motivation render in-card buttons that own SEMANTIC end-game ACTIONS (`Play Again`, `Claim Stars`, `Try Again`, `I'm ready`). FloatingButton owns NAVIGATION VERBS (`Next`, `Continue`, `Done`, `Finish`) and is HIDDEN while these cards are visible. `setMode('next')` is reserved for AnswerComponent reveal (or, when `answerComponent: false`, Stars Collected `onMounted` after audio). Two regression patterns are now blocked by validator rules:

1. ❌ **Putting `text: 'Next'` (or other navigation verb) inside a TS button** → `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`. The Next CTA is FloatingButton's job.
2. ❌ **Stripping Victory `buttons:` to `[]` and routing via `onDismiss`** → `GEN-VICTORY-BUTTONS-REQUIRED`. `Claim Stars` and `Play Again` are SEMANTIC ACTIONS, not navigation verbs — they are NOT in the reserved list and MUST stay on the Victory card. Victory dismisses via explicit button taps only, never tap-anywhere.
3. ❌ **Calling `transitionScreen.show({title: 'Victory', ...})` without first calling `floatingBtn.setMode('hidden')`** → `GEN-FLOATING-BUTTON-LIFECYCLE`. A stale floating button competes with the in-card Claim Stars / Play Again buttons.

### Canonical Victory snippet (multi-round, AnswerComponent enabled)

**TS audio shape:** every prescribed TS plays SFX → TTS, both awaited inside `onMounted`. The `sfxId`, `sticker`, and `ttsText` come from the `## Screen Audio` table in `pre-generation/screens.md` (game-planning resolves them — including `creatorScreenAudio` overrides). Inline the resolved `ttsText` into the snippet; runtime tokens like `${score}`, `${totalRounds}` are interpolated against `gameState`. If the Screen Audio row is `silent`, omit the `playDynamicFeedback` call (Stars Collected is the canonical example).

```javascript
async function showVictory() {
  gameState.phase = 'results';
  gameState.isActive = false;
  syncDOM();
  try { progressBar.update(gameState.currentRound, gameState.livesLeft || 0); } catch (e) {}
  try { floatingBtn.setMode('hidden'); } catch (e) {}                  // ← required by GEN-FLOATING-BUTTON-LIFECYCLE
  const stars = gameState.stars;
  const buttons = stars === 3
    ? [{ text: 'Claim Stars', type: 'primary', action: showStarsCollected }]
    : [
        { text: 'Play Again',  type: 'secondary', action: showMotivation },
        { text: 'Claim Stars', type: 'primary',   action: showStarsCollected }
      ];
  // ttsText resolved by game-planning into screens.md Screen Audio table; build inlines it.
  const ttsText = stars === 3
    ? `Victory! You got ${gameState.score} out of ${gameState.totalRounds}!`
    : `Great work! You got ${gameState.score} out of ${gameState.totalRounds}!`;
  await transitionScreen.show({
    stars,
    title: 'Victory 🎉',
    subtitle: getVictorySubtitle(),                                     // game-specific from screens.md
    buttons,
    persist: true,
    onMounted: () => FeedbackManager.runSequence(async () => {
      postGameComplete(true);                                           // BEFORE audio (data-contract). Victory path → correct=true.
      try { await safePlaySound('sound_game_victory', { sticker: STICKER_CELEBRATE }); } catch (e) {}
      if (ttsText) {                                                    // null when Screen Audio marks silent
        try { await FeedbackManager.playDynamicFeedback({
          audio_content: ttsText, subtitle: ttsText, sticker: STICKER_CELEBRATE
        }); } catch (e) {}
      }
    })
  });
}
```

### Canonical Round Intro snippet
```javascript
async function showRoundIntro(n) {
  // Cross-Cutting Rule 10 cleanup before opening a new TS — also aborts in-flight runSequence
  try { FeedbackManager.sound.stopAll(); } catch (e) {}
  try { FeedbackManager.stream.stopAll(); } catch (e) {}
  try { floatingBtn.setMode('hidden'); } catch (e) {}
  const ttsText = `Puzzle ${n} of ${gameState.totalRounds}`;            // from screens.md Screen Audio
  return new Promise(resolve => {
    transitionScreen.show({
      title: `Puzzle ${n} of ${gameState.totalRounds}`,
      icons: ['🧩'],
      persist: true,
      onMounted: () => FeedbackManager.runSequence(async () => {
        try { await safePlaySound('rounds_sound_effect', { sticker: STICKER_ROUND }); } catch (e) {}
        if (ttsText) {
          try { await FeedbackManager.playDynamicFeedback({
            audio_content: ttsText, subtitle: ttsText, sticker: STICKER_ROUND
          }); } catch (e) {}
        }
        try { transitionScreen.hide(); } catch (e) {}
        resolve();
      })
    });
    setTimeout(() => { try { transitionScreen.hide(); } catch (e) {} resolve(); }, 8000);
  });
}
```

### Canonical Welcome snippet
```javascript
async function showWelcome() {
  try { floatingBtn.setMode('hidden'); } catch (e) {}
  const ttsText = `Let's play ${gameState.gameTitle || 'this game'}!`;  // from screens.md Screen Audio
  return new Promise(resolve => {
    transitionScreen.show({
      title: 'Welcome!',
      icons: ['👋'],
      persist: true,
      buttons: [{ text: "Let's go!", type: 'primary', action: () => {
        try { FeedbackManager.sound.stopAll(); } catch (e) {}           // also aborts the in-flight runSequence
        try { FeedbackManager.stream.stopAll(); } catch (e) {}
        try { transitionScreen.hide(); } catch (e) {}
        resolve();
      } }],
      onMounted: () => FeedbackManager.runSequence(async () => {
        try { await safePlaySound('sound_level_transition', { sticker: STICKER_LEVEL }); } catch (e) {}
        if (ttsText) {
          try { await FeedbackManager.playDynamicFeedback({
            audio_content: ttsText, subtitle: ttsText, sticker: STICKER_LEVEL
          }); } catch (e) {}
        }
      })
    });
  });
}
```

### Canonical Stars Collected → AnswerComponent → next_ended chain
```javascript
async function showStarsCollected() {
  gameState.phase = 'stars_collected';
  syncDOM();
  await transitionScreen.show({
    title: "Yay!\nStars collected!",
    buttons: [],
    persist: true,
    styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } },
    onMounted: async () => {
      await safePlaySound('victory_sound_effect', { sticker: STICKER_VICTORY });
      window.postMessage({
        type: 'show_star',
        data: { count: gameState.stars, variant: 'yellow', score: gameState.score + '/' + gameState.totalRounds }
      }, '*');
      setTimeout(showAnswerCarousel, 1500);                             // hand off after star animation
    }
  });
}

function showAnswerCarousel() {
  answerComponent.show({ slides: getReviewSlides() });
  floatingBtn.setMode('next');                                          // ← only place navigation-verb Next lives
  floatingBtn.on('next', () => {
    window.parent.postMessage({ type: 'next_ended' }, '*');
    answerComponent.destroy();
    previewScreen.destroy();
    floatingBtn.destroy();
  });
}
```

### Canonical Standalone end-flow (`totalRounds === 1`, no TransitionScreen, no body-card)

**End-state UI = AnswerComponent (PART-051) + FloatingButton mode + header `show_star`.** The puzzle grid stays rendered in `#gameContent` unchanged; AnswerComponent reveals the solution carousel below; FloatingButton drives the advance/retry CTA. **Do NOT render an inline body-card** ("Puzzle solved!" / "Try again!" / "Game over!" with sticker + title + subtitle) — that duplicates AnswerComponent and visually mimics a Victory/Game-Over TransitionScreen that standalone games are forbidden from rendering. Validators: `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` (no `transitionScreen.show()`) + `GEN-STANDALONE-END-PANEL-FORBIDDEN` (no `gameContent.innerHTML = '<...>'` inside endGame / onCorrect / onWrong).

**Step ordering is enforced by `GEN-FEEDBACK-ORDER`.** Each of the 6 steps below has a PERMITTED-calls list (see PART-050 § Standalone variant) and validator flags any call placed in the wrong beat. Common regression: `answerComponent.show()` placed in Step 2 (between `postGameComplete` and awaited TTS) — the carousel slides in mid-narration. The audio chain is strictly `attempt_complete SYNC → SFX-await → game_complete SYNC → TTS-await → reveal side-effects (show_star, answerComponent.show) → setMode-deferred-via-setTimeout`. Source order matters; the validator does not reason about runtime semantics — it checks where calls appear in the file.

```javascript
// CORRECT — puzzle stays, AnswerComponent reveals solution, FloatingButton advances.
async function endStandaloneGame(result) {
  // Step 0 — attempt_complete SYNC. Host preload hook; MUST be the very first beat,
  // before any await / audio call. recordAttempt(...) already ran in the submit handler
  // upstream, so the metrics payload is complete. See PART-008 § attempt_complete.
  postAttemptComplete(result.correct);

  // Step 1 — SFX awaited (~1.5 s floor).
  try {
    await safePlaySound(
      result.correct ? 'correct_sound_effect' : 'incorrect_sound_effect',
      { sticker: result.correct ? STICKER_CORRECT : STICKER_INCORRECT }
    );
  } catch (e) {}

  // Step 2 — game_complete SYNC. NO body-card render.
  // PASSTHROUGH of the Submit handler's evaluation — never derive from accuracy / last attempt.
  postGameComplete(result.correct);

  // Step 3 — TTS awaited (if game uses dynamic TTS).
  try {
    await FeedbackManager.playDynamicFeedback({
      audio_content: result.ttsText,                                     // from spec round content
      subtitle:      result.ttsSubtitle,                                 // paired *Subtitle field
      sticker:       result.correct ? STICKER_CORRECT : STICKER_INCORRECT
    });
  } catch (e) {}

  // Step 4 — show_star (correct only) + AnswerComponent reveal.
  if (result.correct) {
    window.postMessage({
      type: 'show_star',
      data: {
        count: gameState.stars,
        variant: 'yellow',
        score: gameState.score + '/' + gameState.totalRounds
      }
    }, '*');
  }
  if (answerComponent) {
    answerComponent.show({ slides: getReviewSlides(result) });
  }

  // Step 5 — reveal Next (or Retry on wrong-with-lives-remaining).
  setTimeout(function () {
    floatingBtn.setMode(result.correct ? 'next' : 'retry');
  }, 1100);
}

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  try { if (answerComponent) answerComponent.destroy(); } catch (e) {}
  try { if (previewScreen) previewScreen.destroy(); } catch (e) {}
  floatingBtn.destroy();
});
```

```javascript
// FORBIDDEN — duplicates AnswerComponent and visually mimics a Victory TS.
// Validator: GEN-STANDALONE-END-PANEL-FORBIDDEN.
async function endStandaloneGame(result) {
  await safePlaySound(...);
  // ❌ Do NOT do this. Renders a TS-mimicking body-card into #gameContent.
  document.getElementById('gameContent').innerHTML =
    '<div class="kak-screen-title">Puzzle solved!</div>' +
    '<div class="kak-screen-sticker"><img src="..."></div>' +
    '<div class="kak-screen-subtitle">You earned 3 stars.</div>';
  floatingBtn.setMode('next');
  // ...
}
```

**Spec-vs-build mismatch handling.** If the spec mentions a TransitionScreen anywhere in a standalone game (`Welcome TS` / `Game Over TransitionScreen` / etc. drafted by the spec author), the build MUST IGNORE the spec's TransitionScreen and emit the canonical AnswerComponent + FloatingButton end-flow above. Do NOT translate the TS into an inline body-card. Do NOT call `transitionScreen.show()` (validator blocks it). The spec-vs-build drift surfaces at Step 9 human review or earlier at Step 2 spec-review check Z8 (`SCOPE-CREEP-STANDALONE-END-PANEL`). Build's job is to emit canon, not to silently translate spec drift.

```javascript
// showVictory — see "Canonical Victory snippet" above for the full shape with
// floatingBtn.setMode('hidden') + conditional buttons. The snippet above is
// authoritative; copy from it rather than reconstructing from this skeleton.

async function showGameOver() {
  gameState.phase = 'game_over';
  gameState.isActive = false;
  syncDOM();
  try { floatingBtn.setMode('hidden'); } catch (e) {}                   // GEN-FLOATING-BUTTON-LIFECYCLE
  await transitionScreen.show({
    title: /* from screens.md */ 'Game Over',
    icons: ['😔'],
    subtitle: 'You ran out of lives!',
    persist: true,
    // Buttons: copy verbatim from screens.md. Do NOT add an Exit/Cancel/Skip unless screens.md lists one.
    buttons: [
      { text: 'Try Again', type: 'primary', action: showMotivation }
    ],
    onMounted: () => FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })
  });
}

// Stars Collected — EXCEPTION to the no-button auto-dismiss rule.
// The no-button auto-dismiss rule (await audio → hide) applies to roundIntro and similar
// intermediate screens. Stars Collected opts out because it is the terminal end-of-game
// surface — the screen must stay visible so the show_star animation lands on the celebration
// screen (not on an empty background) and the Next button reveals on top of the still-visible
// screen. The hide + destroy + game_exit move into the FloatingButton 'next' handler.
transitionScreen.show({
  title: "Yay! \n Stars collected!",
  buttons: [],
  styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } },
  onMounted: async () => {
    await FeedbackManager.sound.play('sound_stars_collected', { sticker: STICKER_CELEBRATE });
    // DO NOT hide here — Stars Collected is an exception to the no-button auto-dismiss rule.
    window.postMessage({ type: 'show_star', data: { count, variant: 'yellow', score: gameState.score + '/' + gameState.totalRounds } }, '*');
    setTimeout(function() { floatingBtn.setMode('next'); }, 1100);
  }
});

// Elsewhere — next handler owns the hide + cleanup
floatingBtn.on('next', function() {
  transitionScreen.hide();
  previewScreen.destroy();
  window.parent.postMessage({ type: 'game_exit' }, '*');
});

// Exception to the no-button auto-dismiss rule (which applies to roundIntro etc.) because Stars Collected is the terminal end-of-game surface.

// endGame — does NOT call previewScreen.destroy(). Destroy lives in the
// FloatingButton on('next', ...) handler (above) so the ActionBar header and
// #previewStar stay mounted long enough for the async show_star animation to
// land. Calling destroy() inside endGame() synchronously kills the animation.
//
// attempt_complete is NOT fired here. It is fired upstream by the submit handler
// (or per-round handler) immediately after recordAttempt(...) and BEFORE the
// awaited SFX/TTS chain that runs en route to endGame(). See § Answer Handler
// Sequence step 6 and PART-008 § attempt_complete.
function endGame(correct) {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  trackEvent('game_end', { correct: correct, score: gameState.score, stars: getStars() });
  postGameComplete(correct);      // PASSTHROUGH to metrics.correct; previewResult included automatically
  // NO previewScreen.destroy() here — see floatingBtn.on('next', ...).
}
```

### Game timer

When the game has a `TimerComponent`, instantiate it into a container inside `#gameContent` and own its full lifecycle:
- `timer.start()` in `startGameAfterPreview()`
- `timer.pause()` / `timer.resume()` from VisibilityTracker's `onInactive` / `onResume` callbacks, so the countdown freezes while the tab is hidden
- `timer.reset()` on restart

### Round-complete handler — bump only when student moves PAST the round (ordering rule)

The round-complete handler runs after the student submits and feedback plays. **Bump the progress bar AFTER feedback resolves, ONLY when the student moves PAST the current round, immediately BEFORE the next-round / Victory UI fires.** The bar advances *as the student moves to the next round / Victory* — not at submit, **not on Game Over** (game ended on this unfinished round; student never passed it), **not on a wrong-with-retry path** (still on same round).

**The student moves past the round on:**
- **Correct** — advance to next round (or Victory if last round)
- **Retries exhausted with `lives > 0`** (only in spec-defined retry flows) — round ends, advance to next round

**The student does NOT move past the round on:**
- **Last-life wrong** (`lives === 0` after decrement) — Game Over fires; the student stayed on this round and the game ended. Bar preserves prior progress + 0 hearts.
- **Wrong with retries remaining** — `floatingBtn.setMode('retry')` keeps the student on the same round.

**Default policy — `gameState.progress` counts rounds passed, NOT rounds correct.** Each round-passed bumps `progress` by 1. A wrong answer that advances (e.g., default no-retry flow with `lives > 0`) still passes the round — bumps. A wrong answer that ends the game (Game Over) does NOT pass the round — no bump. Score (correct count) is a separate internal counter (`gameState.score`) that feeds `getStars()` at end-of-game — it does NOT update the ActionBar header mid-round (the header is end-of-game-only). See `flow-implementation.md` § Round loop pattern for the full pattern.

**Canonical sequence per round (no-retry default flow):**

In the default no-retry flow, wrong-with-lives-remaining advances to the next round and wrong-with-last-life ends the game. The Game Over check must come BEFORE the bump:

```javascript
// Default no-retry flow — bump only when advancing (NOT on Game Over)
async function onRoundComplete(verdict) {
  // 1. State mutations — internal counters only, no ActionBar header writes
  if (verdict.correct) {
    gameState.score++;          // feeds getStars() at end-of-game
  } else {
    gameState.lives--;          // life lost (last-life wrong = Game Over)
    gameState.tries++;          // session-scoped counter; paired with every lives decrement
  }
  // 2. Feedback FIRST — bar still at previous progress while feedback plays
  await FeedbackManager.sound.play(verdict.correct ? 'correct' : 'incorrect', {...});

  // 3. Game Over branch — round NOT passed, no progress bump
  if (gameState.lives === 0) {
    if (progressBar) {
      try { progressBar.update(gameState.progress, 0); } catch (e) {}   // hearts empty, progress preserved
    }
    return endGame('game_over');
  }

  // 4. Student moved past — bump progress + update bar JUST BEFORE next-round / Victory
  gameState.progress++;
  if (progressBar) {
    try { progressBar.update(gameState.progress, Math.max(0, gameState.lives)); } catch (e) {}
  }

  // 5. Next-round / Victory UI
  if (gameState.progress >= gameState.totalRounds) return endGame('victory');  // bumped to N/N
  nextRound();
}
```

**Canonical sequence per round (retry flow — wrong with retry available does NOT bump):**

When the spec defines a per-round retry mechanic, the handler adds a retry branch BEFORE the Game Over / advance branches:

```javascript
async function onRoundComplete(verdict) {
  // 1. State mutations
  if (verdict.correct) gameState.score++;
  else { gameState.lives--; gameState.tries++; }   // session-scoped counter paired with lives decrement

  // 2. Feedback FIRST
  await FeedbackManager.sound.play(verdict.correct ? 'correct' : 'incorrect', {...});

  // 3. Wrong-with-retry? Stay on same round, no bump.
  const retryAvailable = !verdict.correct && gameState.lives > 0 && hasRetry(gameState);
  if (retryAvailable) {
    floatingBtn.setMode('retry');
    return;   // bump fires later (or never, if Game Over comes next)
  }

  // 4. Game Over? Round NOT passed, no progress bump.
  if (gameState.lives === 0) {
    if (progressBar) progressBar.update(gameState.progress, 0);
    return endGame('game_over');
  }

  // 5. Student moved past — bump progress + update bar
  gameState.progress++;
  if (progressBar) progressBar.update(gameState.progress, Math.max(0, gameState.lives));

  // 6. Next-round / Victory UI
  if (gameState.progress >= gameState.totalRounds) return endGame('victory');
  nextRound();
}
```

**Ordering rule:** the bump MUST happen BEFORE `nextRound()` / `endGame('victory')` (when bumping at all). The bump MUST NOT fire before `endGame('game_over')` (round wasn't passed) or before `floatingBtn.setMode('retry')` (still on same round). It does NOT need to happen before the awaited feedback SFX — the bump fires AFTER feedback resolves. Corrected ordering: feedback first, branch (retry → no bump | Game Over → no bump | moved past → bump), round-change UI.

Why this timing: bumping at submit feels premature (bar advances before the student has seen the result of their answer). Bumping after the round-change UI is too late (Victory paints with the pre-bump value — matching-doubles regression, April 2026). Bumping on a non-resolving wrong answer advances the bar past where the student actually is. **Bumping on Game Over implies the student passed the round when they didn't** — Game Over with bar at `7/10` reads as "completed 7" but the student lost on round 7; the truthful read is `6/10` + 0 hearts, "completed 6, lost on 7."

**Anti-pattern 1 — bar updated AFTER the round-change transition:**

```javascript
// WRONG — Victory renders with the pre-bump value on the final round
async function onRoundComplete() {
  await FeedbackManager.sound.play('all_correct', { ... });
  if (lastRound) endGame('victory');
  progressBar.update(gameState.progress, gameState.lives);   // too late — Victory already showing
}
```

**Anti-pattern 2 — progress counts only correct (causes round 10/10 to read 8/10):**

```javascript
// WRONG — student finishes the final round and the bar shows 8/10
// because they got rounds 3 and 7 wrong somewhere. Bar is mis-numbered.
async function onRoundComplete(verdict) {
  if (verdict.correct) {
    gameState.progress++;
    progressBar.update(gameState.progress, gameState.lives);
  } else {
    gameState.lives--;
    progressBar.update(gameState.progress, gameState.lives);   // hearts only, progress static
  }
  // Result: a 10-round game with 2 wrong answers shows "Round 8/10" on the
  // last round. The bar disagrees with the header / round-intro / preview Q label.
}
```

**Anti-pattern 3 — bar bumped at submit, before feedback (visually premature):**

```javascript
// WRONG — bar advances the instant the student taps Submit, while feedback
// is still playing for the round they were ON. Feels like the game has
// already moved on before the student has processed the result.
async function onRoundComplete(verdict) {
  if (verdict.correct) gameState.score++; else gameState.lives--;
  gameState.progress++;
  progressBar.update(gameState.progress, gameState.lives);   // bar advances now
  await FeedbackManager.sound.play(...);                     // feedback plays AFTER bar moved
  // The student sees: tap submit → bar jumps to next round → THEN feedback for previous round.
}
```

**Anti-pattern 4 — bar bumped on every wrong-with-retry (advances past actual round):**

```javascript
// WRONG — retry flow bumps progress on every wrong answer, including ones that
// keep the student on the same round. A 10-round game where the student retries
// round 5 twice before getting it right shows "Round 7/10" while the round-intro
// still says "Round 5" — bar disagrees with the round number being played.
async function onRoundComplete(verdict) {
  if (verdict.correct) gameState.score++; else gameState.lives--;
  await FeedbackManager.sound.play(...);
  gameState.progress++;                                     // bumps even when retrying
  progressBar.update(gameState.progress, gameState.lives);
  if (!verdict.correct && gameState.lives > 0) {
    floatingBtn.setMode('retry');                           // back to same round, but bar moved
    return;
  }
  // ...
}
```

**Anti-pattern 5 — bar bumped on Game Over (implies student passed the unfinished round):**

```javascript
// WRONG — bumps progress before the Game Over branch. Student loses last life on
// round 7 → bar shows 7/10 + 0 hearts on Game Over screen. Reads as "completed 7"
// but the student never passed round 7 — they lost on it. Truthful read is
// 6/10 + 0 hearts ("completed 6, lost on 7").
async function onRoundComplete(verdict) {
  if (verdict.correct) gameState.score++; else gameState.lives--;
  await FeedbackManager.sound.play(...);
  gameState.progress++;                                     // bumped before Game Over check
  progressBar.update(gameState.progress, gameState.lives);
  if (gameState.lives === 0) return endGame('game_over');   // bar misleads: 7/10 + 0 hearts
  // ...
}
```

**Correct — feedback first, retry → no bump, Game Over → no bump, moved past → bump:** see canonical sequences above. The Game Over branch must come BEFORE the bump, and it preserves the prior progress + 0 hearts so the bar reads as "completed N-1, lost on N."

**Alternative policies (only with explicit spec authorization):** rounds-correct, points-earned, section-progress, tiles-cleared. Default is rounds-attempted — never invent a custom policy without spec opt-in. Document the chosen metric in the spec's `## Flow` section.

### Preview timer sync — the game must render its own timer; do NOT rely on PreviewScreen mirroring

`timerConfig` and `timerInstance` on `previewScreen.show(...)` drive PreviewScreen's **internal** preview-phase countdown only. The current PreviewScreen CDN (`packages/components/preview-screen/index.js`) does **NOT** mirror `timerInstance` into `#previewTimerText` or any other header element during gameplay — earlier skill text claiming "PreviewScreen mirrors the TimerComponent each frame" is wrong and must not be followed.

To render the game's TimerComponent during gameplay:

1. **Mount `<div id="timer-container">` as a direct child of `#mathai-preview-slot`**, NOT inside `.mathai-preview-header` or `.mathai-preview-header-center`. Keeping it out of the header's flex flow is what makes centering stable regardless of left/right slot widths.
2. **Make `#mathai-preview-slot` a positioning context** — add `#mathai-preview-slot { position: relative; }` in game CSS.
3. **Absolute-center the timer at top** — matches the canonical React `TimerComponent`'s `showInActionBar: true` styles verbatim:
   ```css
   #timer-container {
     position: absolute;
     top: 1rem;
     left: 50%;
     transform: translateX(-50%);
     z-index: 50;
     pointer-events: none;
   }
   #timer-container > * { pointer-events: auto; }
   ```
4. **Override the TimerComponent's hard-coded inline styles.** Its `render()` sets `.timer-display { width: 320px; height: 41px; font-size: 24px; color: #000FFF }` which is too wide for the header and uses the wrong colour. In game CSS:
   ```css
   #timer-container .timer-wrapper { padding: 0 !important; margin: 0 !important; }
   #timer-container .timer-display {
     width: auto !important;
     height: auto !important;
     padding: 0 !important;
     font-size: 16px !important;
     font-weight: 700 !important;
     color: var(--mathai-primary) !important;
     font-family: var(--mathai-font-family) !important;
   }
   ```
5. **Hide the CDN's empty `#previewTimerText` span** so it doesn't occupy header space:
   ```css
   #previewTimerText { display: none !important; }
   ```
6. `new TimerComponent('timer-container', { timerType, format, startTime, endTime, autoStart: false })` per PART-006. Call `timer.start()` in `startGameAfterPreview`. Pause/resume from the VisibilityTracker `onInactive` / `onResume` callbacks with `{ fromVisibilityTracker: true }`.

**Anti-patterns (all seen in matching-doubles build, April 2026):**

- ❌ Mounting `#timer-container` with `display: none` expecting PreviewScreen to mirror text into the header — it doesn't; the timer runs invisibly.
- ❌ Mounting `#timer-container` inside `.mathai-preview-header-center` — the TimerComponent's hardcoded 320px width fights the flex slot sizing and pushes `.mathai-preview-header-right` (score/star) off-screen on 375-480px viewports.
- ❌ Omitting the `.timer-display` width/height/colour overrides — timer renders as a huge blue block.

### Audio permission gate

The preview's internal timer does not start until `FeedbackManager.init()` resolves and audio permission is granted. `gameState.startTime` MUST remain `null` while `previewScreen.getState() === 'preview'`; it is set only in `startGameAfterPreview()` after `onComplete` fires.

### Preview audio — no `new Audio()`

All preview audio flows through `FeedbackManager.sound.preload([{id, url}])` at init and `FeedbackManager.sound.play(id)` at runtime. `new Audio(` anywhere in game code is a fail — preview audio specifically, and game audio generally, must route through FeedbackManager.

### onPreviewInteraction

Only needed for interactive preview content (e.g. video, tap-to-reveal). Default omit. If used, callback receives `(key, value)` from `setPreviewData()` and the resulting data is available on `previewData` in `onComplete`.

### game_complete payload — previewResult

When building the `game_complete` postMessage payload, include `previewResult: gameState.previewResult || null`. Required when preview was interactive. See `data-contract.md` for full schema.

### Window Exposures

```javascript
window.gameState = gameState;       // test harness reads state
window.endGame = endGame;           // test harness calls this
window.restartGame = resetGame;     // replay tests
window.startGame = startGame;       // test harness triggers start
window.nextRound = nextRound;       // test harness advances rounds (GEN-WINDOW-NEXTROUNDEXPOSED)
window.loadRound = function(n) {    // harness jumpToRound(n) — multi-round games
  if (typeof n === 'number' && n >= 1 && n <= gameState.totalRounds) {
    gameState.currentRound = n;
    renderRound(n);
  }
};
```

All assignments MUST appear (GEN-WINDOW-EXPOSE).

**CRITICAL — never name the internal round-render function `loadRound`** (rule
`GEN-LOADROUND-SHADOW`). A top-level `function loadRound(n)` declaration
auto-attaches to `window.loadRound`, which the harness assignment then
overwrites. Every internal call site that says `loadRound(n)` — including ones
inside `showRoundIntro`'s `onMounted` callback — silently resolves to the
harness helper. If that helper calls back into `showRoundIntro(n)` (the common
pattern), you get unbounded recursion: 40,000+ `/generate-audio` calls per
30 seconds and the game never reaches gameplay. Use `function renderRound(n)`
for the internal function and reference it from `window.loadRound` as shown
above.

### getRounds with Fallback

```javascript
function getAvailableSets(rounds) {
  var seen = {};
  for (var i = 0; i < rounds.length; i++) if (rounds[i].set) seen[rounds[i].set] = true;
  var keys = Object.keys(seen).sort();
  return keys.length > 0 ? keys : ['A'];   // legacy untagged → single Set A
}

function getRounds() {
  var source = (gameState.content && gameState.content.rounds) || fallbackContent.rounds;
  var sets = getAvailableSets(source);
  var currentSetId = sets[gameState.setIndex % sets.length];
  var setRounds = source.filter(function(r) { return r.set === currentSetId; });
  if (setRounds.length >= gameState.totalRounds) return setRounds;
  var fbSetRounds = fallbackContent.rounds.filter(function(r) { return r.set === currentSetId; });
  if (fbSetRounds.length >= gameState.totalRounds) return fbSetRounds;
  return fallbackContent.rounds.slice(0, gameState.totalRounds);  // legacy untagged
}
```

For multi-round games, `fallbackContent.rounds` MUST contain rounds for at least 3 distinct `set` values (`'A'`, `'B'`, `'C'`), each with exactly `totalRounds` rounds — so total array length is `totalRounds × 3` (or more), NOT `totalRounds`. Every round object carries a `set: 'A'|'B'|'C'` key. All `id` values globally unique across sets (prefix convention `A_r1_…`, `B_r1_…`, `C_r1_…`). Validator rule `GEN-ROUNDSETS-MIN-3` blocks build-time. Never empty. **Standalone games (`totalRounds: 1`) are exempt:** ship a single round with no `set` key — the validator skips the rule, and `getAvailableSets()` falls back to `['A']` so `getRounds()` and `restartGame()` continue to work as no-ops. See game-building SKILL.md Step 4 for the canonical skeleton.

### getStars

Two canonical shapes — pick exactly one. They map to the spec's star criteria:

#### Shape A — score-based (no duration)

```javascript
function getStars(score) {
  var total = gameState.totalRounds;
  if (score >= Math.ceil(total * 0.9)) return 3;
  if (score >= Math.ceil(total * 0.6)) return 2;
  if (score >= 1) return 1;
  return 0;
}
```

#### Shape B — score + duration (speed gate)

If any star tier depends on duration/speed, **PART-006 TimerComponent is mandatory** and the duration value MUST come from the timer's API (`timer.getTimeTaken()` for total elapsed seconds, `timer.getElapsedTimes()` for per-round laps). See PART-006 § "When PART-006 is mandatory" for the full contract.

```javascript
// ✅ Correct — duration sourced from TimerComponent
function getStars(score) {
  var total = gameState.totalRounds;
  if (!timer) return 0;                                  // PART-006 must be present
  var elapsedSec = timer.getTimeTaken();                 // single source of truth
  if (score === total && elapsedSec < 30) return 3;      // 3★ requires fast solve
  if (score >= Math.ceil(total * 0.6)) return 2;
  if (score >= 1) return 1;
  return 0;
}
```

#### Forbidden — hand-rolled latency in player-visible logic

```javascript
// ❌ Forbidden by PART-006 § "Forbidden patterns"
function getStars() {
  var avg = sum(gameState.responseTimes) / gameState.responseTimes.length;  // FAILS validator
  if (avg < 3000) return 3;
}
// ❌ Forbidden — Date.now in score / feedback / end-game
if (Date.now() - gameState.roundStartTime < 2000) gameState.score += 2;     // FAILS validator
```

`gameState.responseTimes`, `gameStartTime`, `levelStartTime`, `roundStartTime`, `Date.now()`, `performance.now()` MUST NOT appear in `getStars`, score updates, feedback selection, lives loss, or end-game branches. They are allowed *only* inside the `recordAttempt({ response_time_ms: Date.now() - roundStartTime })` telemetry call (data-contract carve-out).

The static validator rule `TIMER-MANDATORY-WHEN-DURATION-VISIBLE` enforces this at build time.

### Keyboard Handling (Input-Based Games)

If the game uses text/number input instead of MCQ:
- Use `inputmode="numeric" pattern="[0-9]*"` and `font-size: 16px` (prevents iOS zoom).
- Enter key submits via `keydown` listener.
- Keep question visible on keyboard open via `visualViewport` resize listener.
- Blur input after answer processed to dismiss keyboard.

---

## Gen Rules (pipeline-enforced, not in any PART)

### State Management

| Rule | Requirement |
|------|-------------|
| GEN-ENDGAME-GUARD | endGame guard must check `gameState.gameEnded`, NOT `!gameState.isActive` |
| GEN-RESTART-PHASE | restartGame sets phase to `'start_screen'`, not `'playing'` |
| GEN-RESTART-RESET | restartGame resets ALL mutable fields including game-specific ones |
| GEN-ROUND-INDEX | `currentRound` is 0-based in logic, 1-based in display only |
| GEN-FLIP-RESET | Per-round counters reset at start of each round |
| GEN-GAMEID | `gameState.gameId` must be the FIRST field in the object literal |
| GEN-CORRECT-ANSWER-EXPOSURE | `gameState.correctAnswer` set BEFORE `syncDOM()` in each round |

### Round Lifecycle

Every `loadRound` must begin with: (1) `isProcessing = false`, (2) `isActive = true`, (3) `syncDOM()`.

### DOM / CSS

| Rule | Requirement |
|------|-------------|
| GEN-RESULTS-FIXED | Results screen uses `position: fixed` full-viewport overlay with `z-index: 100` |
| GEN-RESULTS-DOM | `#results-screen` element must exist in DOM (test harness queries it) |
| GEN-RESULTS-ROUNDS | Results screen displays rounds completed count |
| RULE-RESULTS-1 | `showResults()` populates `#results-screen` directly, never via `transitionScreen.show()` |
| GEN-HIDDEN-CLASS | `.hidden { display: none !important; }` must be defined if `.hidden` is used |
| GEN-HIDE-SHOW | `hide()`/`show()` helpers take DOM elements, NOT selector strings |
| GEN-MOBILE-STACK | Main layout uses `flex-direction: column` (portrait mobile) |
| GEN-DOM-CACHE | Cache DOM refs at init. No `getElementById` inside per-round render |
| GEN-CANVAS-001 | Canvas uses `max-width: 100%; height: auto` for responsive sizing |
| GEN-CSS-TOKENS | Feedback colors use `--mathai-success`, `--mathai-error`, `--mathai-warning` only |
| GEN-UX-004 | Never use `alert()`, `confirm()`, or `prompt()` |
