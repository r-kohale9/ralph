# Signal Capture Patterns

Copy-paste-ready patterns for integrating SignalCollector into generated games.

## Pattern 1: waitForPackages with SignalCollector

```javascript
async function waitForPackages() {
  while (typeof FeedbackManager === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof TimerComponent === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof VisibilityTracker === 'undefined') await new Promise(r => setTimeout(r, 50));
  while (typeof SignalCollector === 'undefined') await new Promise(r => setTimeout(r, 50));
  console.log('All packages loaded');
}
```

## Pattern 2: Initialization

```javascript
window.addEventListener('DOMContentLoaded', async () => {
  await waitForPackages();
  await FeedbackManager.init();

  // Initialize signal collector
  // containerSelector defaults to 'body' — captures all events including
  // transition screens, ready buttons, and overlays outside .game-play-area
  const signalCollector = new SignalCollector({
    sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
    studentId: window.gameVariableState?.studentId || null,
    templateId: gameState.gameId || null
  });
  window.signalCollector = signalCollector;

  // Initialize timer, visibility tracker, etc.
  const timer = new TimerComponent({ /* ... */ });

  const visibilityTracker = new VisibilityTracker({
    onInactive: () => {
      signalCollector.pause();
      signalCollector.recordCustomEvent('visibility_hidden', {});
      timer.pause();
    },
    onResume: () => {
      signalCollector.resume();
      signalCollector.recordCustomEvent('visibility_visible', {});
      timer.resume();
    }
  });

  // Start first round
  startRound(1);
});
```

## Pattern 3: Problem Lifecycle (Round/Question)

**Important — deferred endProblem:** Don't call `endProblem` immediately on solve. Defer it to the next `startProblem` call so transition screen events stay tagged to the previous problem. Otherwise events during transitions get `problem_id: null` and are lost from problem-level analysis.

```javascript
function startRound(roundNumber) {
  const roundData = gameContent.rounds[roundNumber - 1];

  // Flush deferred endProblem from previous round (transition events stay tagged)
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }

  // Start signal collection for this round
  signalCollector.startProblem('round_' + roundNumber, {
    round_number: roundNumber,
    question_text: roundData.question,
    correct_answer: roundData.answer,
    difficulty: roundData.difficulty || null
  });

  // Render the round UI
  renderQuestion(roundData);
  questionStartTime = Date.now();
}

function submitAnswer(userAnswer) {
  const roundId = 'round_' + gameState.currentRound;
  const isCorrect = validateAnswer(userAnswer);

  // Defer endProblem — will be called at next startRound or endGame
  gameState.pendingEndProblem = {
    id: roundId,
    outcome: { correct: isCorrect, answer: userAnswer, correct_answer: gameContent.rounds[gameState.currentRound - 1].answer }
  };

  // Log the outcome as custom event (problem stays active through transition)
  signalCollector.recordCustomEvent('round_solved', { correct: isCorrect, answer: userAnswer });

  // Build attempt history entry (signals are kept separate — NOT merged here)
  const attempt = {
    attempt_number: gameState.currentRound,
    start_timestamp: new Date(questionStartTime).toISOString(),
    end_timestamp: new Date().toISOString(),
    duration: (Date.now() - questionStartTime) / 1000,
    overall_correctness: isCorrect ? 1.0 : 0.0,
    lives_lost: isCorrect ? 0 : 1,
    help_taken: 0,
    metadata: {
      round_number: gameState.currentRound,
      level_number: 1,
      content_visible: { /* ... */ },
      content_interactive: { /* ... */ },
      content_interacted: [ /* ... */ ],
      question: {
        question_number: gameState.currentRound,
        question: gameContent.rounds[gameState.currentRound - 1].question,
        correct_answer: gameContent.rounds[gameState.currentRound - 1].answer,
        user_answer: userAnswer,
        was_correct: isCorrect,
        time_spent: Date.now() - questionStartTime
      }
    }
  };

  window.gameVariableState.attemptHistory.push(attempt);

  // Continue game flow
  if (isCorrect) {
    showCorrectFeedback();
  } else {
    showIncorrectFeedback();
  }
}
```

## Pattern 4: updateCurrentAnswer (Multi-Input Games)

For games where the answer is spread across multiple inputs (grids, drag-drop, matching):

```javascript
// Single-input games: current_answer is auto-captured from input.value — no action needed

// Multi-input games (e.g., Kakuro grid): call updateCurrentAnswer after each change
function handleCellInput(row, col, value) {
  const key = `${row}-${col}`;
  gameState.userValues[key] = value;

  // Update signal collector with full answer state
  signalCollector.updateCurrentAnswer(gameState.userValues);
  // e.g., {"1-1": 3, "1-2": 7} — student's work in progress

  renderGrid();
}

// Drag-and-drop matching game:
function handleDrop(sourceId, targetId) {
  gameState.matches[targetId] = sourceId;

  signalCollector.updateCurrentAnswer(gameState.matches);
  // e.g., {"slot-1": "item-a", "slot-2": "item-c"}
}
```

**Note:** `current_answer` = student's live state, not the correct answer. Correct answer goes in `startProblem(problemData.correct_answer)` and `endProblem(outcome)`.

## Pattern 5: game_complete with Signals

```javascript
function completeGame() {
  // Flush any deferred endProblem before sealing
  if (signalCollector && gameState.pendingEndProblem) {
    signalCollector.endProblem(gameState.pendingEndProblem.id, gameState.pendingEndProblem.outcome);
    gameState.pendingEndProblem = null;
  }

  const metrics = {
    total_rounds: gameState.totalRounds,
    correct_rounds: gameState.correctRounds,
    accuracy: gameState.correctRounds / gameState.totalRounds,
    total_time: window.gameVariableState.timerElapsedTimes.reduce((a, b) => a + b, 0),
    completed: true
  };

  // seal() detaches listeners, computes final signals, returns complete payload
  // Data stays readable after seal — console inspection works on game complete screen
  const payload = signalCollector.seal();

  window.parent.postMessage({
    type: 'game_complete',
    data: {
      metrics: metrics,
      attempts: window.gameVariableState.attemptHistory,
      ...payload  // { events, signals, metadata }
    }
  }, '*');
}
```

**seal() replaces flush + destroy + manual assembly.** No cleanup needed — data is immutable and accessible until iframe teardown.

## Pattern 6: API Submission with Signals

```javascript
async function submitResults() {
  const summary = tracker.getSummary();
  const payload = signalCollector.seal(); // idempotent — safe to call again

  await api.submitResults({
    session_id: tracker.getSessionId(),
    game_id: gameState.gameId,
    metrics: {
      accuracy: summary.accuracy,
      duration: summary.duration,
      total_attempts: summary.totalAttempts,
      correct_attempts: summary.correctAttempts
    },
    attempts: window.gameVariableState.attemptHistory,
    ...payload  // { events, signals, metadata }
  });
}
```

## Pattern 7: data-signal-id Markup

Add `data-signal-id` to important interactive elements for clear signal identification:

```html
<div class="game-play-area">
  <!-- Question display -->
  <div data-signal-id="question-text" class="question">What is 38 + 25?</div>

  <!-- Answer options -->
  <div class="options">
    <button data-signal-id="option-a" class="option">53</button>
    <button data-signal-id="option-b" class="option">63</button>
    <button data-signal-id="option-c" class="option">65</button>
    <button data-signal-id="option-d" class="option">67</button>
  </div>

  <!-- Text input -->
  <input data-signal-id="answer-input" type="text" placeholder="Type answer">

  <!-- Scaffolds -->
  <div data-signal-id="number-line" class="scaffold number-line">...</div>
  <button data-signal-id="hint-button" class="hint-btn">Hint</button>

  <!-- Submit -->
  <button data-signal-id="submit-button" class="submit-btn">Submit</button>
</div>
```

## Pattern 8: Debug Functions

```javascript
// Add to debug functions section of game
window.debugSignals = function() {
  console.log('=== Signal Collector Debug ===');
  signalCollector.debug();
  console.log('Input events:', signalCollector.getInputEvents().length);
  console.log('Problem signals:', signalCollector.getAllProblemSignals());
  console.log('Current view:', signalCollector.getCurrentView());
  console.log('Metadata:', signalCollector.getMetadata());
};
```

## Pattern 9: View State Events (MANDATORY)

**Rule: Every function that modifies the DOM in a way that changes what is visible on screen must call `signalCollector.recordViewEvent()`.**

This applies to ALL visual changes: screen transitions, content renders, cell selections, number entries, feedback display, timer-driven content changes, overlay show/hide, etc.

### Screen Transitions

```javascript
// Ready → Gameplay
function showGameScreen() {
  document.getElementById('game-screen').style.display = 'flex';
  document.getElementById('results-screen').style.display = 'none';

  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'gameplay',
      metadata: { transition_from: 'ready' }
    });
  }
}

// Gameplay → Results
function showResults(metrics) {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'flex';

  if (signalCollector) {
    signalCollector.recordViewEvent('screen_transition', {
      screen: 'results',
      content_snapshot: {
        score: metrics.score,
        accuracy: metrics.accuracy,
        stars: metrics.stars,
        time: metrics.time
      },
      metadata: { transition_from: 'gameplay' }
    });
  }
}
```

### Content Render (Round Start)

```javascript
function setupRound(roundNumber) {
  var roundData = gameContent.rounds[roundNumber - 1];
  renderQuestion(roundData);

  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        question_text: roundData.question,
        round: roundNumber,
        options: roundData.options || null,
        trigger: 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: timer.isRunning ? 'running' : 'paused' } : null,
        progress: { current: roundNumber, total: gameState.totalRounds }
      }
    });
  }
}
```

### Timer-Driven Content Changes (Auto-Reshuffle)

For games like Bubbles Pairs where content changes on a timer WITHOUT user action:

```javascript
function loadGrid() {
  var pairs = generateRandomGrid(gameState.targetSum);
  gameState.currentGrid = pairs;
  createGrid(pairs);

  // VIEW EVENT: content changed — could be timer or user triggered
  if (signalCollector) {
    signalCollector.recordViewEvent('content_render', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'grid_generated',
        grid_index: gameState.gridIndex,
        target_sum: gameState.targetSum,
        pairs_visible: pairs.map(function(p) { return p.a + '+' + p.b; }),
        correct_pair_index: pairs.findIndex(function(p) { return p.a + p.b === gameState.targetSum; }),
        trigger: 'timer_reshuffle'  // or 'user_action' or 'round_start'
      },
      components: {
        timer: timer ? { value: timer.getCurrentTime(), state: 'running' } : null,
        points: { current: gameState.points, target: gameState.targetPoints }
      }
    });
  }
}

// The setInterval callback:
shuffleTimerId = setInterval(function() {
  if (!gameState.isActive) return;
  gameState.gridIndex++;
  loadGrid();  // loadGrid() emits the view event with trigger:'timer_reshuffle'
}, 5000);
```

### Cell / Option Selection

```javascript
// Kakuro: cell selected, group highlighted
function selectCell(row, col) {
  highlightGroup(row, col);

  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'cell_selected',
        selected_cell: { row: row, col: col },
        group_highlighted: getGroupCells(row, col),
        target_sum: getGroupSum(row, col),
        user_values: gameState.userValues,
        cells_filled: Object.keys(gameState.userValues).length,
        cells_total: gameState.totalInputCells
      }
    });
  }
}

// MCQ: option selected
function selectOption(optionId) {
  highlightOption(optionId);

  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'option_selected',
        selected_option: optionId,
        options_visible: getVisibleOptions(),
        question_text: gameState.currentQuestion
      }
    });
  }
}
```

### Number / Answer Entry

```javascript
// Kakuro: number entered into cell
function enterNumber(num) {
  gameState.userValues[selectedKey] = num;
  renderCellValue(selectedKey, num);

  if (signalCollector) {
    signalCollector.recordViewEvent('visual_update', {
      screen: 'gameplay',
      content_snapshot: {
        type: 'number_entered',
        cell: { row: selectedRow, col: selectedCol },
        value_entered: num,
        user_values: gameState.userValues,
        cells_filled: Object.keys(gameState.userValues).length,
        cells_total: gameState.totalInputCells
      }
    });
  }
}
```

### Validation Feedback

```javascript
// Correct/incorrect cell coloring after check
function showValidationFeedback(results) {
  applyCellColors(results);

  if (signalCollector) {
    signalCollector.recordViewEvent('feedback_display', {
      screen: 'gameplay',
      content_snapshot: {
        feedback_type: results.allCorrect ? 'correct' : 'incorrect',
        correct_cells: results.correctCells,
        incorrect_cells: results.incorrectCells,
        duplicate_cells: results.duplicateCells || [],
        groups_correct: results.groupsCorrect,
        groups_total: results.groupsTotal,
        message: results.message
      }
    });
  }
}

// Bubbles Pairs: correct tap — cell turns green
if (signalCollector) {
  signalCollector.recordViewEvent('visual_update', {
    screen: 'gameplay',
    content_snapshot: {
      type: 'cell_correct',
      pair: { a: pair.a, b: pair.b },
      cell_index: index,
      points_after: gameState.points
    }
  });
}

// Bubbles Pairs: wrong tap — cell flashes red
if (signalCollector) {
  signalCollector.recordViewEvent('visual_update', {
    screen: 'gameplay',
    content_snapshot: {
      type: 'cell_wrong',
      pair: { a: pair.a, b: pair.b },
      cell_index: index,
      points_after: gameState.points,
      flash_duration_ms: 1000
    }
  });
}
```

### Audio Feedback (Phase 3)

```javascript
// Before playing audio feedback
if (signalCollector) {
  signalCollector.recordViewEvent('feedback_display', {
    screen: 'gameplay',
    content_snapshot: {
      feedback_type: 'correct',
      message: 'Great job!',
      audio_id: 'correct',
      audio_playing: true
    }
  });
}
await FeedbackManager.sound.play('correct', { subtitle: 'Great job!', sticker: { ... } });
```

### Overlay / Transition Screen

```javascript
// Transition screen shown between rounds
transitionScreen.show({ title: 'Round 2', subtitle: 'Get ready!' });

if (signalCollector) {
  signalCollector.recordViewEvent('overlay_toggle', {
    screen: 'transition',
    content_snapshot: {
      overlay: 'transition_screen',
      visible: true,
      title: 'Round 2',
      subtitle: 'Get ready!'
    }
  });
}
```

### Timer / Component State

```javascript
// Timer paused (tab switch)
if (signalCollector) {
  signalCollector.recordViewEvent('component_state', {
    screen: 'gameplay',
    components: { timer: { value: timer.getCurrentTime(), state: 'paused' } },
    metadata: { reason: 'tab_hidden' }
  });
}

// Timer expired
if (signalCollector) {
  signalCollector.recordViewEvent('component_state', {
    screen: 'gameplay',
    components: { timer: { value: 0, state: 'expired' } },
    metadata: { reason: 'timeout' }
  });
}
```
