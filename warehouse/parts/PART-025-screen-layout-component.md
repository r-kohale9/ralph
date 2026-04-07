# PART-025: ScreenLayout Component

**Category:** CONDITIONAL | **Condition:** Game uses ProgressBar or TransitionScreen components | **Dependencies:** PART-002

---

## Code

```javascript
const layout = ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,                    // MANDATORY (PART-039)
    transitionScreen: {{true/false}},       // For multi-round games
    progressBar: false                      // Ignored when previewScreen:true
  }
});

// Returns:
// layout.previewSlot — 'mathai-preview-slot'
// layout.transitionSlot — 'mathai-transition-slot' or null
// layout.gameContent — 'gameContent' (always present)
```

## HTML Requirement

```html
<div id="app"></div>
```

## DOM Structure

When `slots.previewScreen: true` (the default for all games per PART-039), ScreenLayout creates a **persistent preview wrapper** that holds the game throughout the entire session:

```
#app
  .page-center
    #mathai-preview-slot                       (the persistent wrapper, always visible)
      .mathai-preview-header (fixed)           (avatar, label, score, star, progress, timer)
      .mathai-preview-body (scrollable)
        .mathai-preview-instruction
        .mathai-preview-game-container
          .game-stack
            #gameContent                       (game renders here)
            #mathai-transition-slot            (between-round transitions)
```

Key points:
- The header bar is `position: fixed` and visible in BOTH preview and game states.
- Instruction + game content share a single scroll area below the fixed header (no nested scrolling).
- `#gameContent` and `#mathai-transition-slot` are siblings inside `.game-stack` — no DOM moves at runtime.
- The progress bar slot (`#mathai-progress-slot`) is NOT created — the preview header has the progress bar.
- PreviewScreenComponent populates header content and manages state transitions.

When `previewScreen: false` (legacy / no-preview path), the old structure is created instead: `.game-wrapper > .game-stack > #gameContent`.

## Slot Configurations

| Config | previewScreen | transitionScreen | Use When |
|--------|---------------|------------------|----------|
| Standard | `true` | `false` | Single-round game |
| With transitions | `true` | `true` | Multi-round game with between-round screens |
| Legacy | `false` | any | Only for non-PART-039 games (rare) |

## CRITICAL: Game Content Placement

When using ScreenLayout, **ALL game HTML must render inside `#gameContent`**. ScreenLayout creates the surrounding structure automatically — when `previewScreen: true`, that structure is the preview wrapper; otherwise it is `.game-wrapper > .game-stack`. Either way, your game content slot is `#gameContent`.

**Wrong — game HTML as sibling of `#app` (content escapes the layout):**
```html
<div id="app"></div>
<!-- WRONG: This renders OUTSIDE the ScreenLayout wrapper -->
<div id="game-screen">
  <div class="game-grid">...</div>
</div>
```

**Wrong — game HTML directly in `#app` (overwritten by ScreenLayout.inject):**
```html
<div id="app">
  <!-- WRONG: ScreenLayout.inject('app') replaces this -->
  <div class="game-grid">...</div>
</div>
```

**Correct — use a `<template>` element and clone into `#gameContent` after inject:**
```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <div class="game-grid" id="game-grid">...</div>
  </div>
  <div class="btn-container">
    <button class="game-btn btn-primary" id="btn-submit" onclick="handleSubmit()">Submit</button>
  </div>
</template>

<script>
// In DOMContentLoaded:
const layout = ScreenLayout.inject('app', { slots: { progressBar: true } });
const gameContent = document.getElementById('gameContent');
const template = document.getElementById('game-template');
gameContent.appendChild(template.content.cloneNode(true));
</script>
```

**Alternative — build game HTML entirely via JavaScript after inject:**
```javascript
const layout = ScreenLayout.inject('app', { slots: { progressBar: true } });
const gameContent = document.getElementById('gameContent');
gameContent.innerHTML = `
  <div id="game-screen" class="game-block">
    <div class="game-grid" id="game-grid"></div>
  </div>
`;
```

## Rules

- Call `ScreenLayout.inject()` BEFORE creating ProgressBar or TransitionScreen
- **ALL game content MUST be inside `#gameContent`** — never as a sibling of `#app`
- Don't manually create `.page-center` / `.game-wrapper` if using this component
- Use `<template>` + cloneNode or build HTML in JS after inject — never put game HTML directly in `<body>` or in `#app`
- Game grids and play areas inherit the 480px max-width from `.game-wrapper` — do NOT set width: 100vw on game elements

## Verification

- [ ] `ScreenLayout.inject()` called with correct slot configuration
- [ ] `#app` div exists in HTML (and is the ONLY structural div in body before inject)
- [ ] **ALL game content rendered inside `#gameContent`** (no game elements outside the layout wrapper)
- [ ] Game HTML uses `<template>` + cloneNode or JS innerHTML (not static HTML in body)
- [ ] Slots match the components used (progressBar=true if ProgressBar used, etc.)
- [ ] No game element sets `width: 100vw` or `max-width: 100%` without a pixel cap

## Source Code

Full ScreenLayoutComponent implementation: `warehouse/packages/components/screen-layout/index.js`
