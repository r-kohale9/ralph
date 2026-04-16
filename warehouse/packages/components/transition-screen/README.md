# TransitionScreenComponent

Card-based inline transition screens (welcome, round intros, level intros, victory, game over). Visual-only: no audio, no stickers, no auto-dismiss timers. The **runtime owns show/hide lifetime**.

## API

### Constructor

```js
new TransitionScreenComponent({
  autoInject: true,                 // default
  slotId: 'mathai-transition-slot', // default
  gameContentId: 'gameContent'      // default
});
```

### `show(config) => Promise<void>`

Renders the card and resolves the returned Promise once the DOM is mounted and styles have flushed (after two `requestAnimationFrame` ticks).

Accepted fields:

| Field | Type | Notes |
|-------|------|-------|
| `icons` | `string \| string[]` | Emoji icons row |
| `iconSize` | `'small' \| 'normal' \| 'large'` | Icon size |
| `stars` | `0..3` | Renders stars row (overrides `icons`) |
| `title` | `string` | Title text |
| `subtitle` | `string` | Subtitle text |
| `buttons` | `[{text, type, action, styles}]` | Buttons. `type` ∈ `primary` / `secondary` / `outline`. Clicking a button calls `action()` then auto-hides the screen (baseline). |
| `content` | `string \| HTMLElement` | Custom HTML/DOM injected into the card's custom slot |
| `styles` | `{screen, card, icons, title, subtitle, buttons, custom}` | Per-element style overrides |
| `titleStyles`, `subtitleStyles` | `object` | v1 compat aliases |

### `hide()`

Hides the screen and restores game content. The runtime is responsible for calling this for all non-button-driven variants (Welcome, Round N, Level N intro, Custom intro, Ready-to-improve, Yay-stars — any screen that advances via timer or runtime signal).

### `onMounted(cb)`

Registers a **one-shot** callback fired when the next `show()` is fully mounted (after styles flush). Same signal as the Promise returned by `show()`, useful when the caller does not want to await.

```js
ts.onMounted(() => console.log('card visible'));
ts.show({ title: 'Round 1' });
```

### `getCustomSlot() => HTMLElement | null`

Returns the `.mathai-ts-custom` container for programmatic DOM injection.

### `getCard() => HTMLElement | null`

Returns the card root for advanced styling.

### `destroy()`

Removes the DOM and clears references.

## Deprecated — silently accepted, one-time console warning

These fields exist for one version of back-compat and have **no effect**:

- `duration` — runtime owns the timer
- `persist` — runtime owns dismissal
- `sticker` — TransitionScreen is sticker-free by design

## Sound-free / sticker-free guarantee

This component does not import or depend on any audio module, FeedbackManager, or sticker package. It only renders the card and its children.

## Runtime call-pattern coverage (7 variations)

| # | Variation | Call shape |
|---|-----------|------------|
| 1 | Welcome | `show({icons:['👋'], title, subtitle})` then runtime `hide()` after timer |
| 2 | Round N intro | `show({title:'Round N', subtitle})` then runtime `hide()` |
| 3 | Level N intro | `show({icons:['🎯'], title:'Level N', subtitle})` then runtime `hide()` |
| 4 | Practice / Challenge section intro | `show({title:'Practice', subtitle})` then runtime `hide()` |
| 5 | Custom intro (rich content) | `show({title, content: '<div>…</div>', buttons:[{text:'Start', action}]})` |
| 6 | Ready to improve | `show({icons:['💪'], title:'Ready to improve?', buttons:[{text:'Yes', action}]})` |
| 7 | Yay stars (end-of-round / end-of-game) | `show({stars: 2, title:'Nice!', buttons:[{text:'Next', action}]})` |

In all variations, the button click (when present) still auto-hides the card after invoking the button's `action()` — that is the intended "runtime signal" for button-driven variations. Timer-driven variations require an explicit `hide()` from the runtime.
