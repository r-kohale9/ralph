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
| `destroy()` | remove `message` listener | PreviewScreen on own `destroy()` |

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

## game_init payload contract

ActionBar listens to `window.message` events for `{ type: 'game_init', data: { questionLabel, score, showStar } }`. Each payload **shallow-merges** into the internal state so partial updates (e.g. `{ score: '2/3' }` alone) don't blank previously-set fields — this is reliability rule R8.

## Reliability (R-rules this part addresses)

- **R8** — `game_init` partial payload merge preserves prior fields.

## Component boundary

Game code MUST NOT call `getElementById` / `querySelector` on ActionBar-owned IDs (`previewBackBtn`, `previewAvatarSpeaking`, `previewAvatarSilent`, `previewQuestionLabel`, `previewScore`, `previewStar`) or `.mathai-preview-*` classes in that set. Validator rule `5e0-DOM-BOUNDARY` (lib/validate-static.js) enforces this — it fires when either `PreviewScreenComponent` or `ActionBarComponent` is present in the HTML.

## Version

- v1.1.0 — current. ActionBar owns header-left / header-right + back / avatar / question label / score / star. No timer display, no rAF loop, no pause/resume surface.
