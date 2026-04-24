# PART-050: Floating Button (Submit / Retry / Next)

> **⚠ Canonical doc lives at [`alfred/parts/PART-050.md`](../../alfred/parts/PART-050.md).**
> The Alfred pipeline reads only from `alfred/` + `lib/` — it does NOT read this warehouse copy. This file is kept for consistency with the rest of `warehouse/parts/` but is NOT authoritative. Make all substantive edits in `alfred/parts/PART-050.md`.

**Category:** CONDITIONAL | **Condition:** Every game whose flow has a Submit / Check / Done / Commit CTA UNLESS the spec sets `floatingButton: false` | **Dependencies:** PART-002, PART-017 (FeedbackManager), PART-022 (superseded for the floating variant)

---

## Opt-out (`floatingButton: false`)

Mirrors PART-039's `previewScreen: false` pattern. When the spec declares a top-level `floatingButton: false`, this part **does not apply**:

- `FloatingButtonComponent` MUST NOT be instantiated, imported, or referenced.
- `ScreenLayout.inject()` MUST NOT pass `floatingButton: true` in its `slots` — omit the key entirely.
- The game hand-rolls its Submit / Retry / Next buttons inline per PART-022.
- All validator `GEN-FLOATING-BUTTON-*` / `5e0-FLOATING-BUTTON-*` rules auto-skip.

Two valid reasons to opt out: (1) the flow has no Submit CTA at all (timer-driven auto-advance, drag-to-commit), (2) the spec author deliberately prefers inline buttons.

**Build-step rule.** Step 4 (Build) MUST NOT write `floatingButton: false` into `spec.md` to silence validator rules. Spec mutations during build show up in `git diff` and are a visible scope violation the user can revert.

For every other game with a Submit step and no `floatingButton: false`, this part is MANDATORY.

---

## Overview

FloatingButtonComponent is a **fixed-bottom action button** that owns the Submit → Retry / Next state machine for the entire game session. It absorbs the PART-022 Submit / Retry / Next lifecycle (Reset remains a PART-022 concern — it lives inline in the play area, not floating).

Key property: **visibility is game-state-driven, not interaction-driven.** The component is hidden unless the game is in a submittable state (input non-empty, all DnD tiles placed, an option selected, etc.). It appears AND disappears as the player edits — type → appears, clear → disappears, re-type → appears again. "Player has interacted once" is NOT sufficient to show it.

Three modes, mutually exclusive. **All three use the same yellow button** — the only per-mode difference is the label text. This is intentional — the component mirrors the React reference ([FlowButton.tsx](../../../../mathai-client/src/modules/flow/components/FlowButton.tsx)) which treats every state as "the CTA is here, tap to proceed". Distinguishing colours by mode would fight the reference design and confuse players about what the button means.

| Mode | When | Default label | Button background |
|------|------|---------------|-------------------|
| `'submit'` | Game state is valid to evaluate | `Submit` | `#FFDE49` (gargoyle-gas) |
| `'retry'` | Submit returned incorrect | `Retry` | `#FFDE49` |
| `'next'` | Submit returned correct (or round complete) | `Next` | `#FFDE49` |
| `null` / hidden | Not in a submittable state; OR between rounds | — | (not rendered) |

Text colour is always `#333333` (dark-charcoal). The **secondary button** in the dual-button variant is `#FFFFFF` (white) on the same dark text. Disabled state is `#DDDDDD` bg. See README styling table for the full palette; tokens are hard-coded to match the React reference rather than themed via `--mathai-*` variables.

---

## ScreenLayout Configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    floatingButton: true,     // reserves #mathai-floating-button-slot as a <body> sibling
    previewScreen: true,      // unchanged
    transitionScreen: true    // unchanged
  }
});
```

The floating slot is a sibling of the layout root (not inside `.page-center` / `.mathai-layout-body`), because it uses `position: fixed` and must not scroll with the body.

## Instantiation (in DOMContentLoaded, after ScreenLayout.inject)

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

---

## Lifecycle

1. **Page load:** component instantiated, starts hidden (mode = `null`). Component is NOT shown just because the player has seen the round.
2. **Submittable predicate (owned by game code):** define `isSubmittable()` over `gameState`. Call `floatingBtn.setSubmittable(isSubmittable())` from every handler that can change submittability:
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

When the round shows two parallel answer choices (Yes / No, True / False), enable the secondary slot:

```js
floatingBtn.setLabels({ submit: 'Yes', secondary: 'No' });
floatingBtn.on('submit',    () => answer(true));
floatingBtn.on('secondary', () => answer(false));
```

The secondary button is only rendered in `mode === 'submit'`. Dual mode is OFF by default.

---

## Invariants

- Only one of {submit, retry, next} visible at a time — enforced by `setMode`.
- Button MUST be hidden when the game is in a non-submittable state, even if the player has already interacted. "Player touched the input" is NOT sufficient — the current state must be valid for evaluation. Violating this is a common pipeline regression (bodmas-blitz, match-up-ratios history).
- No custom `<button>` in `#gameContent` with id / class matching `/submit|retry|next|cta/i` when FloatingButton is used. Duplicate action buttons confuse the player and break the validator (`5e0-FLOATING-BUTTON-DUP`).
- Component container lives in `#mathai-floating-button-slot`, NOT inside `#gameContent`. The slot is a sibling of `.page-center` / `.mathai-layout-root`.
- Reset button (if applicable) remains inline per PART-022 — NOT absorbed by this component.

## Integration with FeedbackManager (PART-017)

Submit handlers should await `FeedbackManager` audio / sticker cues before flipping mode:

```js
floatingBtn.on('submit', async () => {
  const correct = evaluate(gameState.userInput);
  recordAttempt({ correct, /* … */ });
  await FeedbackManager.play(correct ? 'correct' : 'incorrect');
  floatingBtn.setMode(correct ? 'next' : 'retry');
});
```

The Promise-return pattern guarantees the button stays in `Submitting…` state for the full feedback duration — no race between animation and the Retry / Next reveal.

---

## Validator rules enforced

| Rule | What it checks |
|------|----------------|
| `GEN-FLOATING-BUTTON-CDN` | Script tag for `floating-button/index.js` OR the `components/index.js` bundle is present when `FloatingButtonComponent` is referenced. |
| `GEN-FLOATING-BUTTON-SLOT` | `slots.floatingButton: true` in `ScreenLayout.inject()` when the component is instantiated. |
| `GEN-FLOATING-BUTTON-PREDICATE` | Source calls `setSubmittable(` from at least one input/state-change handler. Catches the "show once, never hide" regression. |
| `5e0-FLOATING-BUTTON-DUP` | No custom submit/retry/next/cta `<button>` inside `#gameContent` when FloatingButton is used. |
