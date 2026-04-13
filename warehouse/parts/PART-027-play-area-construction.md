# PART-027: Play Area Construction

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-025

> **Note:** Play area HTML must be injected into `#gameContent` via JS after `ScreenLayout.inject()` (PART-025 v2). Do not place play area HTML directly in `<body>` or `#app`.

---

## Purpose

Framework for designing and building the interactive play area inside the game layout. Apply this process before writing HTML to ensure the play area is coherent, solvable, and well-structured.

## Construction Process

### Step 1: Interpret the Game Definition

Extract from the game requirements:
- Structural rules (grid size, board layout, zones)
- Allowed actions (click, drag, type, select)
- Spatial logic (adjacency, paths, regions)
- Win conditions (all correct, target score, reach goal)
- Loss conditions (lives, timer, max attempts)
- Environmental constraints (walls, locked cells, boundaries)

### Step 2: Construct the Play Area

Design a cohesive environment:
- **Spatial layout** — grid, linear, freeform, or stacked
- **Interactive elements** — clickable cells, draggable tiles, input fields, selectable options
- **Visual zones** — question area, answer area, feedback area, control area
- **State indicators** — selected, correct, incorrect, disabled, active

> **CRITICAL: Video and audio player elements do NOT belong in the play area.** If the game has video content (PART-040) or content audio with a visible player (PART-041), place them in a separate `.instruction-area` div ABOVE the play area. The play area is for interactive elements (options, buttons, inputs) that the user taps/clicks. See PART-040 and PART-041 for placement guidance.

### Step 3: Model Player Behavior

Consider how users will approach the play area:
- What will they try first?
- Where will they get confused?
- What incorrect paths are likely?
- Where are decision points?

Use these insights to refine layout and feedback.

### Step 4: Simulate Runs

Walk through mentally:
- A complete **success run** (optimal path)
- A **failure run** (common mistakes)
- An **edge case** (empty input, rapid clicking, undo)

### Step 5: Verify the Design

Check:
- All interactive elements are reachable
- Win path exists and is achievable
- Feedback is clear for correct/incorrect
- State transitions are logical
- No dead-end states where user is stuck

## Play Area HTML Pattern

```html
<div class="game-block" id="play-area">
  <!-- Question/Prompt Section -->
  <div class="question-section">
    <h2 id="question-text"></h2>
  </div>

  <!-- Interactive Section -->
  <div class="interactive-section" id="interactive-area">
    <!-- Game-specific interactive elements go here -->
    <!-- Examples: grid, input fields, draggable items, option cards -->
  </div>

  <!-- Feedback Section -->
  <div class="feedback-section hidden" id="feedback-area">
    <p id="feedback-text"></p>
  </div>
</div>

<!-- Button Section (from PART-022) -->
<div class="btn-container">
  <button class="game-btn btn-secondary" onclick="resetInputs()">Reset</button>
  <button class="game-btn btn-primary" id="btn-submit" onclick="handleSubmit()">Submit</button>
  <button class="game-btn btn-secondary hidden" id="btn-retry" onclick="handleRetry()">Retry</button>
  <button class="game-btn btn-primary hidden" id="btn-next" onclick="nextRound()">Next</button>
</div>
```

## Common Play Area Layouts

### Grid Layout
```css
.game-grid {
  display: grid;
  grid-template-columns: repeat(var(--cols), 1fr);
  gap: 4px;
  max-width: 360px;   /* MUST have pixel cap — 100% alone causes huge cells on desktop */
  margin: 0 auto;     /* Center within parent */
  aspect-ratio: 1;
}

.grid-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: pointer;
  font-size: var(--mathai-font-size-title);
  transition: all 0.2s ease;
  overflow: hidden;    /* Prevent pseudo-elements (diagonal lines, overlays) from escaping */
}

.grid-cell.selected { border-color: var(--mathai-blue); background: #EBF0FF; }
.grid-cell.correct { border-color: var(--mathai-green); background: var(--mathai-light-green); }
.grid-cell.incorrect { border-color: var(--mathai-red); background: var(--mathai-light-red); }
```

### Option Cards Layout
```css
.options-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.option-card {
  padding: 16px 24px;
  border: 2px solid #E0E0E0;
  border-radius: var(--mathai-border-radius-card);
  cursor: pointer;
  font-size: var(--mathai-font-size-body);
  transition: all 0.2s ease;
  min-width: 80px;
  text-align: center;
}

.option-card.selected { border-color: var(--mathai-blue); background: #EBF0FF; }
.option-card.correct { border-color: var(--mathai-green); background: var(--mathai-light-green); }
.option-card.incorrect { border-color: var(--mathai-red); background: var(--mathai-light-red); }
```

### Input Field Layout
```css
.input-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.game-input {
  padding: 12px 16px;
  font-size: var(--mathai-font-size-body);
  font-family: var(--mathai-font-family);
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  text-align: center;
  width: 200px;
  outline: none;
  transition: border-color 0.2s ease;
}

.game-input:focus { border-color: var(--mathai-blue); }
.game-input.correct { border-color: var(--mathai-green); }
.game-input.incorrect { border-color: var(--mathai-red); }
```

## State Management Pattern

```javascript
function updateElementState(element, state) {
  // Remove all state classes
  element.classList.remove('selected', 'correct', 'incorrect', 'disabled');
  // Add new state
  if (state) element.classList.add(state);
}

function disableInteraction(container) {
  container.querySelectorAll('[data-interactive]').forEach(el => {
    el.style.pointerEvents = 'none';
    el.classList.add('disabled');
  });
}

function enableInteraction(container) {
  container.querySelectorAll('[data-interactive]').forEach(el => {
    el.style.pointerEvents = 'auto';
    el.classList.remove('disabled');
  });
}
```

## Verification

- [ ] Play area has clear question/prompt section
- [ ] Interactive elements have distinct visual states (default, selected, correct, incorrect)
- [ ] Feedback area exists for showing result messages
- [ ] Layout is responsive within 480px max-width
- [ ] Grids have a pixel max-width (e.g. 360px), not just `max-width: 100%`
- [ ] Grid cells have `overflow: hidden` if using pseudo-elements (diagonal lines, badges, etc.)
- [ ] Play area HTML is inside `#gameContent` (when using ScreenLayout — see PART-025)
- [ ] All interactive elements are accessible via click/tap
- [ ] State transitions are smooth (CSS transitions)
- [ ] Win and loss paths have been mentally simulated
