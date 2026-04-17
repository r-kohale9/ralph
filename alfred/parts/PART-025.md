### PART-025: ScreenLayout Component (v2)

**Source of truth:** `warehouse/parts/PART-025-screen-layout-component.md`

**Purpose:** Auto-generates the game page structure (preview wrapper, game stack, transition slot, progress slot) given a `slots` config.

**Primary API — slots mode (MANDATORY for new games):**

```javascript
ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,     // default when spec previewScreen !== false (PART-039); OMIT this key entirely when spec previewScreen=false
    progressBar: true,       // for Shape 2 Multi-round / Shape 3 Sectioned; omit for Shape 1 Standalone
    transitionScreen: true   // for any multi-screen flow
  }
});
// returns: { previewSlot, progressSlot, transitionSlot, gameContent }
```

**DOM structure (preview-wrapper mode):**

```
#app
  .page-center
    #mathai-preview-slot           (persistent wrapper, always visible)
      .mathai-preview-header       (fixed top: avatar, label, score, star)
      .mathai-preview-body         (single scroll area)
        .mathai-preview-instruction
        .mathai-preview-game-container
          .game-stack
            #mathai-progress-slot  (created when slots.progressBar: true)
            #gameContent           (game renders here)
            #mathai-transition-slot
```

**Key rules:**
- HTML requires only `<div id="app"></div>` — ScreenLayout builds everything inside.
- `slots.previewScreen: true` is the default (PART-039 wrapper persistence applies) — omit the key when spec declares `previewScreen: false`.
- `slots.progressBar: true` is required for the round-progress bar slot to be created inside `.game-stack`. Without it, `#mathai-progress-slot` will NOT exist (ProgressBar cannot mount).
- Game content goes ONLY inside `#gameContent`. Do NOT re-parent `#gameContent` or any ScreenLayout-created element at runtime.
- Do NOT author CSS that repositions `#mathai-progress-slot`, `#mathai-preview-slot`, or `#mathai-transition-slot` — layout is component-owned.

**Legacy — sections API (DEPRECATED, backward compat only):**

The 4-section API (`sections: { header, questionText, progressBar, playArea, transitionScreen }`) exists only for games built before the preview wrapper was introduced (pre-PART-039). New games MUST NOT use it — static validator rejects `sections:` in `ScreenLayout.inject`.

See `warehouse/parts/PART-025-screen-layout-component.md` for full DOM detail and migration notes.
