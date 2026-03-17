# PART-025: ScreenLayout Component

**Category:** CONDITIONAL | **Condition:** Game uses ProgressBar or TransitionScreen components | **Dependencies:** PART-002

---

## Code

```javascript
const layout = ScreenLayout.inject('app', {
  slots: {
    progressBar: {{true/false}},
    transitionScreen: {{true/false}}
  }
});

// Returns:
// layout.progressSlot — 'mathai-progress-slot' or null
// layout.transitionSlot — 'mathai-transition-slot' or null
// layout.gameContent — 'gameContent' (always present)
```

## HTML Requirement

```html
<div id="app"></div>
```

ScreenLayout injects the full page structure (page-center, game-wrapper, game-stack) into this div. Your game content goes inside `#gameContent`.

## Slot Configurations

| Config | ProgressBar | TransitionScreen | Use When |
|--------|------------|-----------------|----------|
| Minimal | `false` | `false` | Simple game, no rounds/levels |
| With progress | `true` | `false` | Multi-round game with progress |
| Full | `true` | `true` | Full game with progress + transitions |

## CRITICAL: Game Content Placement

When using ScreenLayout, **ALL game HTML must render inside `#gameContent`**. ScreenLayout creates the `.page-center > .game-wrapper > .game-stack` structure automatically — your game content slot is `#gameContent` which lives inside this structure.

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
