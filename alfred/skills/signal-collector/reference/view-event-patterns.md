# View Event Patterns

Copy-paste-ready patterns for integrating `signalCollector.recordViewEvent()` into generated games.

**MANDATORY RULE:** Every function that modifies the DOM in a way that changes what is visible on screen must call `signalCollector.recordViewEvent()`. This powers replay narration and ensures every input event has view context.

---

## Pattern: Screen Transition

Emit when the visible screen changes (ready -> gameplay, gameplay -> results, etc.).

```javascript
// Ready -> Gameplay
signalCollector.recordViewEvent('screen_transition', {
  screen: 'gameplay',
  metadata: { transition_from: 'ready' }
});

// Gameplay -> Results
signalCollector.recordViewEvent('screen_transition', {
  screen: 'results',
  content_snapshot: {
    score: gameState.score,
    accuracy: Math.round((gameState.score / gameState.totalRounds) * 100),
    stars: getStars(),
    time: timer ? timer.getElapsedTime() : 0
  },
  metadata: { transition_from: 'gameplay' }
});
```

---

## Pattern: Content Render (Round Start)

Emit when new question/round content is rendered. Include `content_snapshot` with the question and `components` with timer/progress state.

```javascript
function loadRound(roundNumber) {
  var roundData = getRounds()[roundNumber];
  renderQuestion(roundData);

  signalCollector.recordViewEvent('content_render', {
    screen: 'gameplay',
    content_snapshot: {
      question_text: roundData.question,
      round: roundNumber + 1,
      options: roundData.options || null,
      trigger: 'round_start'
    },
    components: {
      timer: timer ? { value: timer.getCurrentTime(), state: 'running' } : null,
      progress: { current: roundNumber + 1, total: gameState.totalRounds }
    }
  });
}
```

**Trigger values:**
- `'round_start'` — new round loaded by game flow
- `'timer_reshuffle'` — content changed by timer (auto-advancing games)
- `'user_action'` — content changed by student interaction

---

## Pattern: Visual Update (Cell/Option Selection)

Emit when the student selects, highlights, or modifies interactive elements within a round.

```javascript
// MCQ: option selected
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'option_selected',
    selected_option: optionId,
    options_visible: getVisibleOptions(),
    question_text: gameState.currentQuestion
  }
});

// Grid game: cell selected
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'cell_selected',
    selected_cell: { row: row, col: col },
    user_values: gameState.userValues,
    cells_filled: Object.keys(gameState.userValues).length,
    cells_total: gameState.totalInputCells
  }
});

// Number/text entry
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'number_entered',
    cell: { row: selectedRow, col: selectedCol },
    value_entered: num,
    user_values: gameState.userValues,
    cells_filled: Object.keys(gameState.userValues).length
  }
});

// Drag-and-drop placement
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'drop_placed',
    source: sourceId,
    target: targetId,
    matches: gameState.matches
  }
});
```

---

## Pattern: Feedback Display

Emit when correct/incorrect visual feedback is shown (green/red highlighting, message display).

```javascript
// Correct answer visual
signalCollector.recordViewEvent('feedback_display', {
  screen: 'gameplay',
  content_snapshot: {
    feedback_type: 'correct',
    message: 'Great job!',
    audio_id: 'correct'
  }
});

// Incorrect answer visual
signalCollector.recordViewEvent('feedback_display', {
  screen: 'gameplay',
  content_snapshot: {
    feedback_type: 'incorrect',
    correct_answer: currentRound.answer,
    student_answer: userAnswer,
    message: 'Not quite!'
  }
});

// Grid validation results
signalCollector.recordViewEvent('feedback_display', {
  screen: 'gameplay',
  content_snapshot: {
    feedback_type: results.allCorrect ? 'correct' : 'incorrect',
    correct_cells: results.correctCells,
    incorrect_cells: results.incorrectCells,
    groups_correct: results.groupsCorrect,
    groups_total: results.groupsTotal
  }
});
```

---

## Pattern: Overlay Toggle

Emit when transition screens, modals, or overlays are shown/hidden.

```javascript
// Transition screen shown
signalCollector.recordViewEvent('overlay_toggle', {
  screen: 'transition',
  content_snapshot: {
    overlay: 'transition_screen',
    visible: true,
    title: 'Round 2',
    subtitle: 'Get ready!'
  }
});

// Transition screen hidden
signalCollector.recordViewEvent('overlay_toggle', {
  screen: 'gameplay',
  content_snapshot: {
    overlay: 'transition_screen',
    visible: false
  }
});
```

---

## Pattern: Component State

Emit when timer, progress bar, or other UI components change state.

```javascript
// Timer paused (tab switch)
signalCollector.recordViewEvent('component_state', {
  screen: 'gameplay',
  components: { timer: { value: timer.getCurrentTime(), state: 'paused' } },
  metadata: { reason: 'tab_hidden' }
});

// Timer expired
signalCollector.recordViewEvent('component_state', {
  screen: 'gameplay',
  components: { timer: { value: 0, state: 'expired' } },
  metadata: { reason: 'timeout' }
});

// Progress update
signalCollector.recordViewEvent('component_state', {
  screen: 'gameplay',
  components: {
    progress: { current: gameState.currentRound + 1, total: gameState.totalRounds },
    lives: gameState.lives
  }
});
```

---

## Pattern: Timer-Driven Content (Auto-Reshuffle)

For games where content changes on a timer WITHOUT user action (e.g., grid reshuffles, bubble games):

```javascript
function loadGrid() {
  var pairs = generateRandomGrid(gameState.targetSum);
  gameState.currentGrid = pairs;
  createGrid(pairs);

  signalCollector.recordViewEvent('content_render', {
    screen: 'gameplay',
    content_snapshot: {
      type: 'grid_generated',
      grid_index: gameState.gridIndex,
      pairs_visible: pairs.map(function(p) { return p.a + '+' + p.b; }),
      trigger: 'timer_reshuffle'   // distinguishes from user-triggered content changes
    },
    components: {
      timer: timer ? { value: timer.getCurrentTime(), state: 'running' } : null
    }
  });
}

// Timer calls loadGrid() every N seconds
shuffleTimerId = setInterval(function() {
  if (!gameState.isActive) return;
  gameState.gridIndex++;
  loadGrid();  // loadGrid emits the view event with trigger:'timer_reshuffle'
}, 5000);
```

---

## When NOT to Call recordViewEvent

Do **not** call recordViewEvent for:

- **Pure internal state changes** with no visible effect (updating a counter variable, toggling a flag)
- **CSS hover/focus effects** that don't change content (`:hover` opacity, `:focus` outline)
- **Events already auto-captured** by SignalCollector (clicks, taps, keystrokes — these are recorded automatically)
- **Audio events** — FeedbackManager audio does not change visible DOM (sticker overlays are managed by FeedbackManager)

**Rule of thumb:** If a student watching the screen would notice a change, call `recordViewEvent`. If the screen looks the same, don't.
