### PART-050: FloatingButton Component (Submit / Retry / Next)

**Category:** CONDITIONAL | **Condition:** Every game whose flow has a Submit / Check / Done / Commit CTA UNLESS the spec sets `floatingButton: false` | **Dependencies:** PART-002, PART-017 (FeedbackManager), PART-022 (superseded for the floating variant)

**Purpose:** fixed-bottom action button that owns the Submit → Retry / Next state machine for the entire game session. Absorbs PART-022's Submit / Retry / Next lifecycle. Reset remains inline per PART-022.

---

## Opt-out (`floatingButton: false`)

When the spec declares a top-level `floatingButton: false`, this part **does not apply**:

- `FloatingButtonComponent` MUST NOT be instantiated, imported, or referenced.
- `ScreenLayout.inject()` MUST NOT pass `floatingButton: true` in its `slots` — omit the key entirely.
- The game hand-rolls its Submit / Retry / Next buttons inline per PART-022 (below the play area).
- All validator rules listed below (`GEN-FLOATING-BUTTON-*`, `5e0-FLOATING-BUTTON-*`) are auto-skipped.

Two valid reasons to opt out:
1. **The flow has no Submit CTA at all** — timer-driven auto-advance, drag-to-commit, canvas-only flows. The game should emit NO Submit / Check / Done button anywhere.
2. **The user explicitly wants inline Submit for this specific game** — the spec author deliberately opts into the PART-022 inline pattern.

**Build-step rule (enforced by [game-building/SKILL.md](../skills/game-building/SKILL.md)):** step 4 (Build) MUST NOT write `floatingButton: false` into `spec.md` to silence validator rules. The spec is authored at step 1 and reviewed at step 2 — a build-time mutation shows up in `git diff` and is a visible scope violation the user can revert. Same trust model as PART-039's `previewScreen: false`.

---

## ScreenLayout configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    floatingButton: true,     // reserves #mathai-floating-button-slot as a body-level sibling
    previewScreen: true,
    transitionScreen: true
  }
});
```

The slot is a sibling of `.page-center` / `.mathai-layout-root` (not inside the scrolling body) — the component uses `position: fixed` and must not scroll with content.

## Instantiation

```javascript
const floatingBtn = new FloatingButtonComponent({
  slotId: 'mathai-floating-button-slot'
});
```

## Public API

| Method | Purpose |
|--------|---------|
| `setMode(mode)` | `'submit'` / `'retry'` / `'next'` / `null`. Mutually exclusive. `null` fully hides the component. |
| `setSubmittable(bool)` | Convenience: `true` ⇒ `setMode('submit')`; `false` ⇒ `setMode(null)`. **No-op while in `'retry'` or `'next'`.** |
| `setDisabled(bool)` | Keeps the button visible but greys it out. For transient lockouts only. |
| `setLabels({submit, retry, next, submitting, secondary})` | Overrides. Passing `secondary: '…'` enables the dual-button variant in `submit` mode. |
| `setError(text)` | Shows/clears an error line above the button row. |
| `on(event, handler)` | `event ∈ {submit, retry, next, secondary}`. Handler may be async. |
| `show()` | `setMode('submit')`. |
| `hide()` | `setMode(null)`. |
| `destroy()` | Removes DOM, clears listeners. Call from `endGame()`. |

## Three modes — all use the same yellow button

The only per-mode difference is the label text. This mirrors the React FlowButton reference which treats every state as "the CTA is here, tap to proceed". Distinguishing colours by mode would fight the reference design and confuse players.

| Mode | When | Default label | Button background |
|------|------|---------------|-------------------|
| `'submit'` | Game state is valid to evaluate | `Submit` | `#FFDE49` (gargoyle-gas) |
| `'retry'` | Standalone game, wrong submit, lives remaining | `Try again` | `#FFDE49` |
| `'next'` | Game has ended; player has viewed results and is ready to advance | `Next` | `#FFDE49` |
| `null` / hidden | Not in a submittable state | — | (not rendered) |

Text colour: `#333333` (dark-charcoal). Secondary button (dual-button variant): `#FFFFFF` (white), same dark text. Disabled: `#DDDDDD`. Height: 68px. Padding: 20px 53px. Border-radius: 8px. Shadow: `0 2px 1px rgba(0,0,0,0.1)`.

---

## Lifecycle

1. **Page load:** component instantiated, starts hidden (`mode = null`). NOT shown on page load.
2. **Submittable predicate (owned by game code):** define `isSubmittable()` over `gameState`. Call `floatingBtn.setSubmittable(isSubmittable())` from EVERY handler that can change submittability:
   - `input`, `change`, `keyup` on text / number inputs
   - `click` on MCQ option chips
   - `drop`, `dragend` on DnD targets
   - Any programmatic state mutation (reset, undo, clear)
3. **On submit click:** `on('submit')` handler runs. If it returns a Promise, the button auto-shows `Submitting…` and ignores clicks until resolved. Handler dispatches to `setMode('retry')` or `setMode('next')` based on result.
4. **On retry click:** clear feedback, reset input, set mode to `null` (back to predicate-driven).
5. **On next click:** advance round, set mode to `null` until the player re-enters a submittable state.
6. **`endGame()`:** call `floatingBtn.destroy()`.

## Lifecycle diagram

```
  page load / new round
          │
          ▼
       hidden ◀──────── retry / next click ◀────┐
          │                                      │
  player edits → isSubmittable()=true            │
          │                                      │
          ▼                                      │
       submit ──── submit click (promise) ──────▶│
                                                 │
                                          wrong: retry
                                          right: next
```

## Dual-button variant

Enable the secondary slot for parallel-answer flows (Yes / No, True / False):

```js
floatingBtn.setLabels({ submit: 'Yes', secondary: 'No' });
floatingBtn.on('submit',    () => answer(true));
floatingBtn.on('secondary', () => answer(false));
```

The secondary button is only rendered in `mode === 'submit'`. Secondary background is white on the same dark text. Dual mode is OFF by default.

---

## Next flow — required for every FloatingButton-using game

**Every game that reaches an end state MUST surface a Next button.** This is how the host harness learns "the player is done viewing results" and can tear down the iframe / advance to the next worksheet item. The signal is a new postMessage type `next_ended` (distinct from `game_complete`).

**Next is the LAST thing the player sees.** Its semantic is "player is done, tear down". If Next appears while feedback audio is still playing OR while the results/stars TransitionScreen is still visible, the player can tap it and destroy the iframe mid-audio or before absorbing the result. That defeats the entire purpose.

**The sequence differs by shape.** Pick the right one based on `totalRounds`.

### Standalone variant (`totalRounds: 1`, Shape 1) — NO TransitionScreen

Standalone games have ONE question, ONE submit, ONE end state. There is nothing to transition between — TransitionScreen is architecturally redundant. The round's inline feedback panel in `#gameContent` (worked-example, stars if correct, final message) IS the end-of-game display. Validator `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` blocks any TransitionScreen usage when `totalRounds === 1`.

Four-step sequence:

1. **Await feedback** — `await FeedbackManager.play(correct ? 'correct' : 'incorrect')`.
2. Render the inline feedback panel in `#gameContent` (persists on-screen; no card overlay).
3. Post `{ type: 'game_complete', data: { metrics: ... } }`.
4. `floatingBtn.setMode('next')` — Next appears at the bottom, BELOW the feedback panel.

The `await` on step 1 is the separator the TIMING rule needs — `setMode('next')` is safe right after `game_complete` because feedback has already completed.

Canonical wiring:

```js
async function endGame(correct) {
  await FeedbackManager.play(correct ? 'correct' : 'incorrect');
  renderInlineFeedbackPanel(correct);                               // update #gameContent
  window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');
  floatingBtn.setMode('next');
}

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  floatingBtn.destroy();
});
```

`ScreenLayout.inject()` for standalone MUST omit `transitionScreen`: `slots: { floatingButton: true, previewScreen: true, transitionScreen: false }` (or omit the key entirely). Do NOT instantiate `new TransitionScreenComponent(...)`.

### Multi-round variant (`totalRounds > 1`, Shape 2 / Shape 3) — TransitionScreen with `buttons: []`

Multi-round games end after the final round when the per-round feedback has already cleared. The victory / game_over TransitionScreen card is the end-of-game display.

Five-step sequence:

1. Game evaluates the final submit → decide outcome.
2. **Await feedback** — `await FeedbackManager.play(...)`.
3. Post `game_complete` with metrics.
4. Show victory / game_over via `transitionScreen.show({ content: ..., buttons: [] })` — **NO buttons**, tap-dismissible only.
5. Register `transitionScreen.onDismiss(() => { transitionScreen.hide(); floatingBtn.setMode('next'); })` — `setMode('next')` lives ONLY inside this callback.

Canonical wiring:

```js
async function endRound(correct) {
  await FeedbackManager.play(correct ? 'correct' : 'incorrect');
  window.parent.postMessage({ type: 'game_complete', data: {...} }, '*');

  transitionScreen.show({
    stars: correct ? 3 : 0,
    content: resultsHtml,
    buttons: []                          // tap-dismissible only
  });
  transitionScreen.onDismiss(() => {
    transitionScreen.hide();
    floatingBtn.setMode('next');         // ONLY setMode('next') call in the game
  });
}

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  floatingBtn.destroy();
});
```

**Hard rules for both variants.** `setMode('next')` MUST NOT be in `endGame()`, `handleGameOver()`, `postGameComplete()`, or any function that immediately precedes `setMode('next')` with a `game_complete` postMessage and nothing else. The only valid separators between `game_complete` and `setMode('next')` are: `await` (standalone — feedback already awaited), OR `transitionScreen.onDismiss(...)` + `transitionScreen.hide()` (multi-round). Validator `GEN-FLOATING-BUTTON-NEXT-TIMING` catches all other patterns.

**Banned — DO NOT do any of these** (the exact patterns previous runs have produced and each was rejected):

- ❌ `postGameComplete(sr, su); floatingBtn.setMode('next');` in the body of `endGame()` — Next appears during feedback audio.
- ❌ `setMode('next')` in the same function as `game_complete` postMessage — same issue, regardless of wrapping try/catch.
- ❌ Fire-and-forget feedback at the end of game (`FeedbackManager.play(...).catch(...)`) — end-of-game feedback MUST be awaited so the TransitionScreen shows AFTER audio completes.
- ❌ `setMode('next')` inside `.then(...)` of feedback play without also dismissing the TransitionScreen — Next appears while the stars card is still visible.
- ❌ **`transitionScreen.show({ buttons: [{ text: 'Next', action: ... }] })` — WRONG.** The Next CTA is owned by FloatingButton, NOT by a button inside the TransitionScreen card. Victory / game_over TransitionScreens MUST use `buttons: []` (empty array) and rely on tap-to-dismiss. Any `text: 'Next'` / `'Continue'` / `'Done'` / `'Finish'` / `'Play Again'` inside a TransitionScreen's `buttons:` array is a validator error (`GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`). A Next button on the card followed by a floating Next produces a confusing double-Next UX — players click the card's Next, see another Next appear at the bottom, and don't know which one actually fires. Welcome / round-intro / motivation screens may still have buttons (`I'm ready`, `Let's go`, `Skip`) — those labels are NOT in the reserved-word list.

**Contract:** the `next_ended` postMessage fires ONCE per game session, AFTER `game_complete`, specifically in response to the user clicking Next. Host listens for both. See [alfred/skills/data-contract/schemas/postmessage-schema.md](../skills/data-contract/schemas/postmessage-schema.md).

Validator rules enforcing this:
- `GEN-FLOATING-BUTTON-NEXT-MISSING` — must call `setMode('next')` AND register `on('next', ...)`.
- `GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE` — the handler body must emit `next_ended`.
- `GEN-FLOATING-BUTTON-NEXT-TIMING` — `setMode('next')` must not sit next to `game_complete` without an `await` / transition-dismiss separator.

---

## Try Again flow — standalone games with `totalLives > 1` only

**Scope:** ONLY applies to Shape 1 Standalone games (`totalRounds: 1`) where the spec sets `totalLives > 1`. Multi-round games continue to use TransitionScreen retry buttons — they are NOT affected by this section.

**Why not multi-round?** In multi-round games, a wrong answer either advances to the next round (no retry) or ends the game (lives exhausted, TransitionScreen shows Play Again). There's no "retry the same round" moment mid-round. In standalone, the single round IS the game, so "retry this question" is the only way to use a spare life.

**Flow:**

1. User submits → wrong.
2. Game code: `gameState.lives -= 1`; record the attempt with `is_retry: (gameState.retryCount || 0) > 0`.
3. Await feedback (`FeedbackManager.play('incorrect')`).
4. Check `gameState.lives > 0`:
   - **Yes** → show Try Again (`floatingBtn.setMode('retry')`).
   - **No** → `endGame(false)` → goes through the Next flow (TransitionScreen game_over → Next button).
5. User taps Try Again:
   - If `spec.retryPreservesInput: true`: input value is kept, player can edit it.
   - Otherwise (default): input is cleared before the click handler returns.
   - Interaction is re-enabled (`gameState.isProcessing = false`).
   - **Attempt history, score, and the already-decremented lives are PRESERVED** — do NOT reset them.
   - `floatingBtn.setMode(null)` → the submittable predicate takes over again as the player edits.

Canonical wiring:

```js
// Inside the wrong-answer branch of on('submit'):
gameState.lives -= 1;
gameState.attempts.push({
  correct: false,
  is_retry: (gameState.retryCount || 0) > 0,
  /* other required fields */
});
await FeedbackManager.play('incorrect');

if (gameState.lives > 0) {
  gameState.retryCount = (gameState.retryCount || 0) + 1;
  if (!RETRY_PRESERVES_INPUT) {
    inputEl.value = '';
    gameState.userInput = '';
  }
  gameState.isProcessing = false;
  floatingBtn.setMode('retry');
} else {
  endGame(false);     // triggers the Next flow
}

floatingBtn.on('retry', function () {
  floatingBtn.setMode(null);
  if (inputEl && !RETRY_PRESERVES_INPUT) inputEl.focus();
});
```

`RETRY_PRESERVES_INPUT` is a game-scope const the generator emits from `spec.retryPreservesInput`.

**Must NOT reset:**
- `gameState.lives` — already decremented, do not restore
- `gameState.attempts` — every attempt stays in the history with `is_retry: true`
- `gameState.score`, `gameState.retryCount`, `recordAttempt` data

**Must reset / re-enable:**
- `gameState.isProcessing = false` (so the input responds to typing again)
- Clear input value (unless `retryPreservesInput: true`)
- Clear any inline feedback UI the game rendered for the wrong attempt

Validator rules that enforce this: `GEN-FLOATING-BUTTON-RETRY-STANDALONE` (standalone + lives>1 must register `on('retry', ...)`), `GEN-FLOATING-BUTTON-RETRY-LIVES-RESET` (retry handler must not contain a lives reset).

---

## Invariants

- Only one of {submit, retry, next} visible at a time — enforced by `setMode`.
- Button MUST be hidden when the game is in a non-submittable state, even if the player has already interacted. "Player touched the input" is NOT sufficient — the current state must be valid for evaluation.
- No custom `<button>` with id / class / data-testid / aria-label / inner text matching `/submit|retry|next|check|done|commit|cta/i` inside `#gameContent` when FloatingButton is used. Duplicate action buttons confuse the player and break the validator (`5e0-FLOATING-BUTTON-DUP`).
- Component container lives in `#mathai-floating-button-slot`, NOT inside `#gameContent`.
- Reset button (if applicable) remains inline per PART-022 — NOT absorbed by this component.

## Integration with FeedbackManager (PART-017)

Submit handlers should await FeedbackManager audio / sticker cues before deciding the next mode:

```js
floatingBtn.on('submit', async () => {
  const correct = evaluate(gameState.userInput);
  recordAttempt({ correct, /* … */ });
  await FeedbackManager.play(correct ? 'correct' : 'incorrect');

  if (correct) {
    endGame(true);     // triggers the Next flow (see "Next flow" section above)
  } else if (isStandaloneWithLivesRemaining()) {
    floatingBtn.setMode('retry');    // see "Try Again flow" section above
  } else {
    endGame(false);    // triggers the Next flow
  }
});
```

The Promise-return pattern keeps the button in `Submitting…` for the full feedback duration — no race between animation and the Retry / Next reveal. Never call `setMode('next')` directly from the submit handler for the victory path — Next appears AFTER the end TransitionScreen dismisses, not alongside it.

---

## CDN

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

The bundle auto-loads `FloatingButtonComponent`. Standalone alternative:

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js"></script>
```

---

## Validator rules enforced

| Rule | What it checks |
|------|----------------|
| `GEN-FLOATING-BUTTON-CDN` | Script tag for `floating-button/index.js` OR the `components/index.js` bundle is present when `FloatingButtonComponent` is referenced. |
| `GEN-FLOATING-BUTTON-SLOT` | `slots.floatingButton: true` in `ScreenLayout.inject()` when the component is instantiated. |
| `GEN-FLOATING-BUTTON-PREDICATE` | Source calls `setSubmittable(` from at least one input/state-change handler. |
| `GEN-FLOATING-BUTTON-MISSING` | Hand-rolled Submit / Check / Done / Commit `<button>` in source but `FloatingButtonComponent` is NOT instantiated. |
| `5e0-FLOATING-BUTTON-DUP` | No custom submit/retry/next/check/done/commit/cta `<button>` inside `#gameContent` when FloatingButton is used. Scans id, class, data-testid, aria-label, inner text — all 5 attributes. |
| `GEN-FLOATING-BUTTON-NEXT-MISSING` | FloatingButton used AND `game_complete` posted somewhere, but no `setMode('next')` call AND no `on('next', ...)` handler — the Next button MUST be wired at every game end. |
| `GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE` | `on('next', ...)` handler body does NOT post `{ type: 'next_ended' }` — a silent Next handler breaks the harness teardown signal. |
| `GEN-FLOATING-BUTTON-NEXT-TIMING` | `setMode('next')` sits within 400 chars of a `game_complete` reference without a `transitionScreen.hide()` / `transitionScreen.onDismiss(` / `await` / `.then(` separator — Next MUST appear only after feedback + TransitionScreen dismiss, not alongside `game_complete`. |
| `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN` | TransitionScreen button object with `text: 'Next' / 'Continue' / 'Done' / 'Finish' / 'Play Again'` found while FloatingButton is in use — the Next CTA is owned by FloatingButton, NOT by a button inside the TransitionScreen card. Victory / game_over screens must use `buttons: []` + tap-dismiss. (Applies to multi-round games; standalone games use no TransitionScreen at all per the rule below.) |
| `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN` | Spec has `totalRounds: 1` AND FloatingButton is used, but source references TransitionScreen (`new TransitionScreenComponent(` or `transitionScreen.show(`). Standalone games MUST NOT use TransitionScreen — the inline feedback panel in `#gameContent` is the end-of-game display. Multi-round games are unaffected. |
| `GEN-FLOATING-BUTTON-RETRY-STANDALONE` | Spec has `totalRounds: 1` AND `totalLives > 1` AND FloatingButton used, but no `on('retry', ...)` handler — standalone+lives games MUST wire Try Again. |
| `GEN-FLOATING-BUTTON-RETRY-LIVES-RESET` | `on('retry', ...)` handler body contains a lives reset (`gameState.lives = gameState.totalLives` or `gameState.lives = <literal>`) — Try Again MUST preserve the already-decremented lives state. |

All rules above are auto-skipped when the spec declares `floatingButton: false` (see the Opt-out section at the top of this part). No other opt-out path exists.
