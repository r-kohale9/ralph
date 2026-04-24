# PART-040: Action Bar (Header)

**Category:** INTERNAL | **Condition:** Instantiated automatically by PART-039 (PreviewScreenComponent); not called directly by game code | **Dependencies:** PART-017 (ScreenLayout)

---

## Overview

`ActionBarComponent` owns the **persistent header bar** inside `#mathai-preview-slot`:

- Back button (fires `WORKSHEET_BACK` postMessage to parent)
- Avatar videos (speaking / silent, toggled by PreviewScreen on audio play/pause)
- Question label, score, star (populated from `game_init` postMessage payload)

It does **NOT** own `#previewProgressBar` — that element lives visually inside the header area but is driven by PreviewScreenComponent's preview-phase audio-sync.

ActionBar does not render or observe any game timer. Games that want a visible timer render their own `TimerComponent` inside `#gameContent`.

`ActionBarComponent` is instantiated by `PreviewScreenComponent` internally. Game code does not construct it or call its methods directly — the one operation exposed for game use is `previewScreen.setStar(visible)` (pass-through to ActionBar).

---

## Relationship to PreviewScreen

```
PreviewScreenComponent (PART-039)
  └─ internally owns ──► ActionBarComponent (this part)
        │
        └─ populates .mathai-preview-header-left / -right
        └─ listens for `game_init` postMessage
        └─ exposes setters: setAvatarSpeaking, setStar, destroy
```

When `new PreviewScreenComponent(...)` runs, its constructor calls `new ActionBarComponent({ slotId: ... })` before any other DOM query. Component load order in `packages/components/index.js` ensures `window.ActionBarComponent` is defined first.

---

## Constructor

```javascript
new ActionBarComponent({ slotId: 'mathai-preview-slot' });
```

`slotId` defaults to `'mathai-preview-slot'`. The constructor throws if the slot skeleton is missing — `ScreenLayout.inject({ slots: { previewScreen: true } })` must have run first.

## Public methods

| Method | Signature | Called by |
|---|---|---|
| `setAvatarSpeaking(bool)` | speaking state | PreviewScreen on audio play / pause / stop |
| `setStar(visible: boolean)` | runtime star toggle | Games (via `previewScreen.setStar(...)` pass-through) |
| `setScore(text: string)` | runtime score text update (e.g. "1/10") | Games (via `previewScreen.setScore(...)` pass-through) on every state change |
| `setQuestionLabel(text: string)` | runtime question-label update (e.g. "Q2") | Games (via `previewScreen.setQuestionLabel(...)` pass-through) on round advance |
| `destroy()` | remove `message` listener, cancel star animations, flush queue | PreviewScreen on own `destroy()` |

## DOM ownership

**Owned** (ActionBar reads / writes, game code MUST NOT touch):
- `.mathai-preview-header` (positioning)
- `.mathai-preview-header-left` (back, avatar, question label)
- `.mathai-preview-header-right` (score, star)
- `#previewBackBtn`, `#previewAvatarSpeaking`, `#previewAvatarSilent`
- `#previewQuestionLabel`, `#previewScore`, `#previewStar`
- Injected stylesheet: `<style id="mathai-action-bar-styles">` (all `.mathai-preview-header*`, `.mathai-preview-back-btn`, `.mathai-preview-avatar-wrap*`, `.mathai-preview-question-label`, `.mathai-preview-score`, `.mathai-preview-star`)

**NOT owned** (lives in header visually but belongs to PreviewScreen):
- `#previewProgressBar` (preview-phase audio sync)

## Updating header state from game code

Call the pass-through methods on PreviewScreen:

```js
previewScreen.setQuestionLabel('Q' + gameState.currentRound);
previewScreen.setScore(gameState.score + '/' + gameState.totalRounds);
previewScreen.setStar(true);
```

These forward to `ActionBarComponent.setScore` / `setQuestionLabel` / `setStar` and mutate the header DOM directly. No messages are posted, so the game's own `handlePostMessage` listener is not re-triggered.

**Why NOT re-post `game_init` from the game:** the game listens on the same `window` for `{type:'game_init'}` to run `setupGame()`. A re-fire from the game would re-run setup with fallback content and reset state. Games fire `game_init` exactly once — from the host-harness path — and use the direct methods above for all subsequent header updates.

## game_init payload contract (host → game + ActionBar)

ActionBar ALSO listens to `window.message` events for `{ type: 'game_init', data: { questionLabel, score, showStar } }`. Each payload **shallow-merges** into the internal state so partial updates (e.g. `{ score: '2/3' }` alone) don't blank previously-set fields — this is reliability rule R8. This path remains for the host harness (and for demo pages like `usage.html` that have no competing listener) but games should not use it.

## show_star payload contract

The same `window.message` listener also handles `{ type: 'show_star', data?: { count?, variant?, silent? } }` — an **intra-frame** message dispatched by the game via `window.postMessage(...)` (NOT `window.parent.postMessage(...)`). It triggers the same star-award animation used in mathai-client: the star renders at the viewport top-left at its intrinsic image size and collapses toward the header's `#previewStar` via animated `transform-origin` + `scale` + `opacity` over 1 s, while an award chime plays. The static `#previewStar` itself is not modified — its `src` and visibility are untouched by the animation.

| Field | Type | Default | Notes |
|---|---|---|---|
| `count` | `1 \| 2 \| 3` | `1` | Picks `star-full.png` / `*_x2.png` / `*_x3.png`. Values outside {1,2,3} are clamped. |
| `variant` | `'yellow' \| 'blue'` | `'yellow'` | Palette family. Yellow matches the static-star default. |
| `silent` | `boolean` | `false` | Skips the success chime for rapid combos. |
| `score` | `string` | *undefined → no change* | Applied to `#previewScore` AFTER the 1 s animation finishes. Use this to atomically bump the header count in lockstep with the award — celebration visibly precedes the number change. |
| `questionLabel` | `string` | *undefined → no change* | Applied to `#previewQuestionLabel` AFTER the animation finishes. Rarely needed here; round advance normally uses `previewScreen.setQuestionLabel(...)` directly. |

Rapid-fire behavior:
- Identical payloads within 500 ms are **deduped** (swallowed silently) to absorb accidental double-fires.
- Distinct payloads while an animation is in flight are **queued** (up to 3) and drained on each `animationend`.

Audio is autoplay-policy aware: the first user gesture on the page unlocks playback; before then the visual still runs but the chime is skipped by the browser.

Games MUST NOT fire `show_star` via `window.parent.postMessage` — that target is the host app, not the ActionBar in the same frame. See [data-contract/schemas/postmessage-schema.md](../../alfred/skills/data-contract/schemas/postmessage-schema.md) for the complete intra-frame vs cross-frame table.

## Reliability (R-rules this part addresses)

- **R8** — `game_init` partial payload merge preserves prior fields.

## Component boundary

Game code MUST NOT call `getElementById` / `querySelector` on ActionBar-owned IDs (`previewBackBtn`, `previewAvatarSpeaking`, `previewAvatarSilent`, `previewQuestionLabel`, `previewScore`, `previewStar`) or `.mathai-preview-*` classes in that set. Validator rule `5e0-DOM-BOUNDARY` (lib/validate-static.js) enforces this — it fires when either `PreviewScreenComponent` or `ActionBarComponent` is present in the HTML.

