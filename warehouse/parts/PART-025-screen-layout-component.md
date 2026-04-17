# PART-025: ScreenLayout Component (v2)

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-002

---

ScreenLayout supports **two modes**. The `slots` API is the **primary mode** — all new games MUST use it. `previewScreen: true` is the default slot configuration (required by PART-039); opt out with spec-level `previewScreen: false`, in which case `slots.previewScreen` MUST be omitted. The `sections` API exists only for backward compatibility with games built before the preview wrapper was introduced; it will be phased out as those games are regenerated.

## Mode 1: Slots API — Preview Wrapper (PART-039 games, default)

```javascript
ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,                    // default; OMIT this key when spec previewScreen=false
    transitionScreen: true                  // For multi-round games
  }
});

// Returns:
// { previewSlot, transitionSlot, gameContent }
```

### DOM Structure (slots + previewScreen:true)

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
- The round progress-bar slot (`#mathai-progress-slot`) is created at the top of `.game-stack` when `slots.progressBar: true` is passed; omitted otherwise (Shape 1 Standalone). The preview header carries its own audio-countdown strip (`#previewProgressBar`) — a different element.
- PreviewScreenComponent populates header content and manages state transitions.

When `previewScreen: false`, the legacy `.game-wrapper > .game-stack > #gameContent` structure is created instead.

## Mode 2: Sections API — 4-Section Layout (DEPRECATED — backward compat only)

```javascript
ScreenLayout.inject('app', {
  sections: {
    header: true,            // Only if game has timer/HUD
    questionText: true,      // Game instructions
    progressBar: true,       // Round progress + lives
    playArea: true,          // Main game content
    transitionScreen: true   // Welcome/level/results screens
  },
  styles: {
    header: { background: '#1A1A2E' },
    questionText: { padding: '16px 20px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', width: '100%' },
    progressBar: { padding: '0 20px', maxWidth: '600px', marginLeft: 'auto', marginRight: 'auto', marginTop: '8px', width: '100%' }
  }
});

// Returns:
// { header, questionText, progressBar, playArea, transitionSlot, progressSlot, gameContent, previewSlot }
```

### DOM Structure (sections)

```
#app
  .mathai-layout-root (100dvh flex column)
    .mathai-layout-header  (#mathai-header-slot)    ← sticky, z-index: 10
    .mathai-layout-body                             ← scrollable flex column
      .mathai-layout-question (#mathai-question-slot)
      .mathai-layout-progress (#mathai-progress-slot)
      .mathai-layout-playarea (#gameContent)         ← flex: 1
      #mathai-transition-slot                        ← sibling of playArea
```

### Section Config

| Section | Required | Default Slot ID | Purpose |
|---------|----------|----------------|---------|
| `header` | Only if timer/HUD | `mathai-header-slot` | Sticky top bar for timer |
| `questionText` | **YES** | `mathai-question-slot` | Game instructions text |
| `progressBar` | **YES** | `mathai-progress-slot` | Round/level progress + hearts |
| `playArea` | **YES** (always created) | `gameContent` | Main game content |
| `transitionScreen` | **YES** | `mathai-transition-slot` | Welcome/level/results cards |

## HTML Requirement

```html
<div id="app"></div>
```

## CRITICAL: Game Content Placement

**ALL game HTML must render inside `#gameContent`** regardless of which mode is used. Build HTML via JS after inject — never put game HTML directly in `<body>` or in `#app`.

```javascript
// Correct — build game HTML via JavaScript after inject
ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true } });
var gameContent = document.getElementById('gameContent');
gameContent.innerHTML = '<div id="game-screen">...</div>';
```

## CSS Override (sections mode only)

ScreenLayout sections CSS loads dynamically, so play area overrides MUST use `!important`:

```css
.mathai-layout-playarea {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  padding: 0 20px 32px !important;
}
```

## Question Text Pattern (sections mode only)

```javascript
function updateInstructions() {
  var slot = document.getElementById('mathai-question-slot');
  if (!slot || !gameState.content) return;
  slot.innerHTML = '<div class="instruction-area"><p class="instruction-text">Game instruction here.</p></div>';
}
```

## Rules

- Call `ScreenLayout.inject()` BEFORE creating ProgressBar, TransitionScreen, or PreviewScreen
- **ALL game content MUST be inside `#gameContent`** — never as a sibling of `#app`
- Don't manually create `.page-center` / `.game-wrapper` if using this component
- Build HTML in JS after inject — never put game HTML directly in `<body>` or `#app`
- In sections mode: use `!important` on `.mathai-layout-playarea` CSS overrides
- In slots mode with `previewScreen: true`: no `.game-wrapper`, no `#mathai-progress-slot`, no `#mathai-header-slot`, no `#mathai-question-slot` — those only exist in sections mode

## Verification

- [ ] `ScreenLayout.inject()` called with correct config mode
- [ ] `#app` div exists in HTML (the ONLY structural div in body before inject)
- [ ] **ALL game content rendered inside `#gameContent`**
- [ ] Game HTML built via JS innerHTML after inject (no static HTML in body)
- [ ] Slots match the components used

## Source Code

Full ScreenLayoutComponent implementation: `warehouse/packages/components/screen-layout/index.js`
