# FloatingButtonComponent

Fixed-bottom floating action button that owns the **Submit → Retry / Next** lifecycle for every MathAI game whose flow includes a Submit CTA. See [PART-050](../../../parts/PART-050-floating-button.md) for the pipeline contract.

**Key idea:** visibility is **game-state-driven**, not interaction-driven. The button appears only when the game is in a submittable state, and disappears the moment it isn't — type → appears, clear → disappears, re-type → appears again.

## Install

Via the bundle (preferred):

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
```

Standalone:

```html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js"></script>
```

## API

### Constructor

```js
new FloatingButtonComponent({
  slotId: 'mathai-floating-button-slot',   // default
  addDelay: true,                          // 1500ms entrance delay on FIRST reveal only
  labels: { submit: 'Submit', retry: 'Try again', next: 'Next', submitting: 'Submitting…' }
});
```

If `slotId` doesn't exist, the component auto-creates a `<div>` on `<body>` and logs a warning. Declare `slots.floatingButton: true` in `ScreenLayout.inject()` to silence it.

### Visibility — the submittable predicate

The component starts hidden. Drive it from the game's state:

```js
function isSubmittable() {
  return gameState.userInput != null && gameState.userInput.trim() !== '';
}

inputEl.addEventListener('input', () => {
  gameState.userInput = inputEl.value;
  floatingBtn.setSubmittable(isSubmittable());   // <-- every state change
});
```

`setSubmittable(true)` ⇒ `setMode('submit')`. `setSubmittable(false)` ⇒ `setMode(null)` (hidden). It is a **no-op when the current mode is `'retry'` or `'next'`** — those modes are driven by the submit result, not by input validity.

### Lifecycle — Submit / Retry / Next

```js
floatingBtn.on('submit', async () => {
  const correct = checkAnswer(gameState.userInput);
  await playFeedback(correct);
  if (correct) {
    floatingBtn.setMode('next');
  } else {
    floatingBtn.setMode('retry');
  }
});

floatingBtn.on('retry', () => {
  resetInput();
  gameState.userInput = '';
  floatingBtn.setMode(null);   // back to submittable-predicate driven
});

floatingBtn.on('next', () => {
  advanceRound();
  floatingBtn.setMode(null);
});
```

Because `on('submit')` returns a Promise, the button automatically:
- disables itself
- swaps its label to `Submitting…`
- ignores additional clicks until the promise resolves

### Public API

| Method | Purpose |
|--------|---------|
| `setMode(mode)` | `'submit'` / `'retry'` / `'next'` / `null`. Mutually exclusive. `null` fully hides the component. |
| `setSubmittable(bool)` | Convenience wrapper for the submittable predicate. No-op while in `'retry'` / `'next'`. |
| `setDisabled(bool)` | Keeps the button visible but greys it out and blocks clicks. Use for transient lockouts. |
| `setLabels({submit, retry, next, submitting, secondary})` | Overrides. Passing `secondary: '…'` enables the dual-button variant in `submit` mode. |
| `setError(text)` | Shows an error line above the button row. Pass `''` / `null` to clear. |
| `on(event, handler)` | `event ∈ {submit, retry, next, secondary}`. Handler may be async. |
| `show()` | Shortcut for `setMode('submit')`. |
| `hide()` | Shortcut for `setMode(null)`. |
| `destroy()` | Removes DOM, clears listeners. Call from `endGame()`. |

### Dual-button variant

Set a `secondary` label and its handler to render two buttons side-by-side (e.g. Yes / No). The secondary button is **only** visible while `mode === 'submit'`.

```js
floatingBtn.setLabels({ submit: 'Yes', secondary: 'No' });
floatingBtn.on('submit',    () => answer(true));
floatingBtn.on('secondary', () => answer(false));
```

### Hidden vs. Disabled

They are two distinct states — use the right one:

- **Hidden** (`setMode(null)` / `setSubmittable(false)`): component is removed from the visual flow entirely. Use when the game is **not in a submittable state**. This is the normal state while the player is still filling in their answer.
- **Disabled** (`setDisabled(true)`): component is visible but greyed. Use for transient lockouts (network roundtrip, animation in flight). The submitting Promise flow already handles the `isSubmitting` case automatically — you rarely need `setDisabled` manually.

## Styling

Palette ported 1:1 from the React [FlowButton.tsx](../../../../../mathai-client/src/modules/flow/components/FlowButton.tsx) reference + Tailwind theme (mathai-client `tailwind.config.js`). Hard-coded, not themed — matching the React reference is the source of truth, not the MathAI `--mathai-*` game-style tokens.

| Token | Value | Applied to |
|-------|-------|------------|
| `gargoyle-gas` | `#FFDE49` | Primary button background (all modes) |
| `white` | `#FFFFFF` | Secondary button background (dual-button variant) |
| disabled bg | `#DDDDDD` | Disabled button background |
| `dark-charcoal` | `#333333` | Button text colour |
| idle border | `#ECECEC` | Button border (default state) |
| pressed border | `#270F36` | Button border (after tap / `data-mathai-fb-pressed="true"`) |
| `congo-pink` | `#FB7D7D` | Error text colour |
| border-radius | `8px` | `rounded-lg` |
| height | `68px` | Button height |
| padding | `20px 53px` | Button padding (drops to `20px 16px` below 360px viewport) |
| gap | `4px` | Gap between dual buttons |
| box-shadow | `0 2px 1px rgba(0, 0, 0, 0.1)` | Button elevation |
| font-weight | `400` (`font-normal`) | Button text |
| font-size | `16px` (`text-base`) | Button text |
| z-index | `3` | Component stacking (matches React reference) |

Only `--mathai-game-max-width` (480px fallback) and `--mathai-font-family` (`system-ui` fallback) are read from the game's variable scope — everything else is literal, matching the React reference.

All styles are scoped under `.mathai-fb-*` and injected once (idempotent via `#mathai-floating-button-styles`).

### Entrance animation

A single ~280ms spring (`cubic-bezier(0.22, 1, 0.36, 1)`) plays every time the component transitions from hidden → visible. The React reference's `addDelay: true` default (1500ms) was intentionally dropped — it made sense in framer-motion's mount-driven model but not in our interaction-driven model (button becomes visible when the player interacts, so 1.5s of invisibility feels broken).

The `addDelay` constructor option is retained for back-compat but is a no-op.

## Invariants the validator enforces

See [static-validation-rules.md](../../../../alfred/skills/game-building/reference/static-validation-rules.md):

- `GEN-FLOATING-BUTTON-CDN` — Script tag must be present when the component is used.
- `GEN-FLOATING-BUTTON-SLOT` — `slots.floatingButton: true` required in `ScreenLayout.inject()`.
- `GEN-FLOATING-BUTTON-PREDICATE` — Game must call `setSubmittable` from at least one input/state handler (prevents the "show once, never hide" anti-pattern).
- `5e0-FLOATING-BUTTON-DUP` — No custom `<button>` in `#gameContent` whose id/class matches `/submit|retry|next|cta/i` when FloatingButton is used.
