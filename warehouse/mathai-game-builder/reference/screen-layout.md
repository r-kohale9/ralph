# Screen Layout and Dimensions

> Editable technical doc + LLM prompt that describes the behaviour and dimensions of an HTML game section. Use this doc to copy/paste into prompts, code editors, or design specs.

---

## Purpose

This editable document defines the required **layout**, **dimensions**, and **behavior** for a mobile-first HTML game section. It is written so an LLM or developer can quickly understand and reproduce the layout.

Keep in mind:

* Game content must be **centered horizontally** with empty white space on both sides.
* The game wrapper's **max-width is 480px** and its **width is 100vw** (so it fits small screens and centers on larger viewports).
* All unique content inside the wrapper is stacked **vertically**, with **10px padding** and **10px **`margin-bottom`** between stacked items.
* The page supports **vertical scrolling** if content overflows.

---

## Core HTML Structure (wrapper only)

```html
<!-- Parent: centers content horizontally with white space on sides -->
<div class="page-center">

  <!-- Main wrapper: max-width 480px, width 100vw, vertical scroll allowed -->
  <section class="game-wrapper">

    <!-- Outer vertical stack container for all unique content -->
    <div class="game-stack">

      <!-- Child content block #1 -->
      <div class="game-block">
        <!-- content here -->
      </div>

      <!-- Child content block #2 -->
      <div class="game-block">
        <!-- content here -->
      </div>

      <!-- Child content block #3 -->
      <div class="game-block">
        <!-- content here -->
      </div>

      <!-- Add more .game-block items as required -->

    </div>

  </section>

</div>
```

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Game Screen — core layout</title>
  <style>
    /* Page-level layout */
    :root{
      --game-max-width: 480px;
      --stack-gap: 10px; /* used for padding and margin-bottom */
    }

    html, body {
      height: 100%;
      margin: 0;
      background: #f6f6f6; /* page background (white space left/right visible on wide screens) */
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    }

    /* Center the wrapper horizontally and allow vertical scroll on page */
    .page-center {
      display: flex;
      justify-content: center; /* horizontal center */
      width: 100%;
      min-height: 100dvh; /* allow for mobile safe-areas */
      box-sizing: border-box;
      padding: 0; /* optional: add top/bottom spacing if needed */
    }

    /* The game wrapper — fills narrow screens, caps at 480px */
    .game-wrapper {
      width: 100vw;           /* fill the viewport width on narrow screens */
      max-width: var(--game-max-width); /* never wider than 480px */
      box-sizing: border-box;
      background: #ffffff;    /* white content area */
      display: flex;
      flex-direction: column; /* vertical stacking for unique content */
      align-items: stretch;
      /* center vertically when content is smaller than viewport */
      min-height: 100dvh;
      padding-top: 54px; /* optional top offset from provided reference */
      pointer-events: auto;
    }

    /* The vertical stack inside the wrapper. Each child is a unique content block */
    .game-stack {
      display: flex;
      flex-direction: column;
      gap: var(--stack-gap);        /* visual gap between items — optional since each item has margin-bottom */
      padding: 0 10px 20px 10px;   /* horizontal padding, extra bottom padding */
      box-sizing: border-box;
      width: 100%;
      overflow-x: hidden; /* avoid horizontal overflow */
    }

    /* Standard block style for unique content items */
    .game-block {
      padding: var(--stack-gap);
      margin-bottom: var(--stack-gap);
      background: transparent; /* default; individual blocks can set their own background */
      border-radius: 8px; /* optional */
      box-sizing: border-box;
    }

    /* A helper to keep the page scrollable while allowing inner content to be centered when short */
    .content-fill {
      display: flex;
      flex-direction: column;
      justify-content: center; /* vertically center children when there is extra space */
      min-height: calc(100dvh - 54px); /* account for top offset */
      box-sizing: border-box;
    }

    /* Small responsive tweaks */
    @media (min-width: 520px) {
      .game-wrapper { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="page-center" role="main">
    <section class="game-wrapper" aria-label="Game area">

      <!-- top offset + vertically centering container -->
      <div class="content-fill">

        <!-- Stack of unique content blocks. Each block must follow the `game-block` rules: padding 10px and margin-bottom 10px. -->
        <div class="game-stack" aria-live="polite">

          <!-- Example: Status bar block -->
          <div class="game-block" id="status-bar" role="region" aria-label="status bar">
            <!-- status bar content (rounds, lives, progress, etc.) -->
          </div>

          <!-- Example: Prompt / instruction block -->
          <div class="game-block" id="instruction" role="region" aria-label="instructions">
            <!-- short instruction text - keep within one block -->
          </div>

          <!-- Example: Main game content (grid, draggable area) -->
          <div class="game-block" id="game-canvas" role="region" aria-label="game canvas">
            <!-- main interactive content — responsive and width constrained to the wrapper -->
          </div>

          <!-- Example: Transition / ready screen -->
          <div class="game-block" id="transition-screen" role="dialog" aria-label="level transition" aria-hidden="true">
            <!-- overlay / transition content — can be shown/hidden by JS -->
          </div>

        </div>

      </div>

    </section>
  </div>
</body>
</html>
```

---

## 🎮 Game Controls & Buttons

### Button Layout Requirements

All MathAI games must include the following buttons in their interface:

#### Below Play Area:
- **Reset Button** - Resets all inputs in the play area to their initial state
  - Position: Below the main game canvas
  - Function: Clear all user inputs, reset game state
  - Style: Secondary button (gray/blue)

#### Bottom-Centre (Contextual):
- **Submit Button** - Submits the current answer/attempt
  - Visibility: Show only after at least 1 user interaction
  - Position: Bottom-centre of the game area
  - Function: Process and validate user input
  - Style: Primary button (green)

- **Retry Button** - Allows user to try again on the same question
  - Visibility: Show after incorrect submission
  - Position: Bottom-centre (replaces Submit when needed)
  - Function: Reset attempt counter, allow another try
  - Style: Secondary button (blue)

- **Next Button** - Advances to the next question/round
  - Visibility: Show after correct submission or round completion
  - Position: Bottom-centre (replaces Submit when needed)
  - Function: Move to next question, update progress
  - Style: Primary button (green)

### Important Distinction:
**These game control buttons are separate from Transition Screen buttons.** Transition Screen buttons appear in modal overlays (see [`components-library.md`](components-library.md)) for major game state changes (victory, game over, etc.). The buttons described here are part of the main game interface layout.

### Button Behavior Guidelines:
- **Mutual Exclusivity**: Only one action button should be visible at a time (Submit OR Retry OR Next)
- **State Management**: Button visibility should change based on game state and user interactions
- **Accessibility**: All buttons must have proper ARIA labels and keyboard navigation support
- **Responsive**: Buttons should stack vertically on narrow screens, remain centered on wider screens
- **InteractionManager Integration**: The InteractionManager automatically controls pointer-events on the game canvas during feedback and evaluation phases. Buttons outside the game area remain clickable even when the game area is disabled.

### InteractionManager Integration

The `InteractionManager` provides automatic pointer-events control during:
- **Long audio feedback** (>1 second) - Game area becomes non-interactive during audio playback
- **Evaluation phases** - Game area becomes non-interactive during answer processing

**Technical Details:**
- Uses `pointer-events: none` on the game canvas to disable interaction
- Buttons outside the disabled area (Submit/Retry/Next) remain functional
- Visual feedback overlays can be shown using InteractionManager events
- Configurable via settings to allow custom interaction behavior

**Button Integration:**
- Submit/Retry/Next buttons should call `interactionManager.enable()` when clicked
- Game area interactions are automatically disabled during evaluation phases
- Visual feedback (overlays, grayed elements) should be shown using InteractionManager events

---

## Editing notes

---

## Accessibility & behavior tips

* Use `aria-live` on non-static instruction blocks so screen readers announce updates.
* Avoid relying on `100vh` due to mobile browser UI chrome; prefer `100dvh` where supported and fall back gracefully.

---
