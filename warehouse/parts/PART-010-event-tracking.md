# PART-010: Event Tracking & SignalCollector

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-003, PART-004, PART-007

---

## A. Event Tracking (trackEvent)

The `trackEvent` function pushes game-level events to `gameState.events`. This is the existing event tracking system — simple, synchronous, and always present.

### Code

```javascript
function trackEvent(type, target, data = {}) {
  gameState.events.push({
    type,
    target,
    timestamp: Date.now(),
    ...data
  });
}
```

### Placement

Global scope function (RULE-001).

### Standard Event Types

| Type | When to Fire | Example Call |
|------|-------------|-------------|
| `game_start` | `setupGame()` begins | `trackEvent('game_start', 'game')` |
| `game_end` | `endGame()` called | `trackEvent('game_end', 'game', { metrics })` |
| `question_shown` | Round renders | `trackEvent('question_shown', 'game', { round, question })` |
| `tap` | User clicks/taps | `trackEvent('tap', 'btn-submit', { position: {x,y} })` |
| `input_change` | User types | `trackEvent('input_change', 'answer-input', { value })` |
| `drag_start` | Drag begins | `trackEvent('drag_start', 'tile-5', { position })` |
| `drag_end` | Drag ends | `trackEvent('drag_end', 'tile-5', { dropTarget, position })` |
| `game_paused` | Tab loses focus | `trackEvent('game_paused', 'system')` |
| `game_resumed` | User resumes | `trackEvent('game_resumed', 'system')` |

### Rules

- Fire `game_start` at beginning of `setupGame()`
- Fire `game_end` in `endGame()` before cleanup
- Fire game-specific events at every user interaction point
- Always include `target` (the element or system that triggered it)

---

## B. SignalCollector

SignalCollector is a **separate, complementary** system that captures every atomic user interaction (clicks, taps, drags, keystrokes) and computes problem-level signals across three tiers:

- **Tier 2 (Process):** How the student solved it — timing, interaction sequence, self-corrections
- **Tier 3 (Engagement):** How engaged they were — hesitations, frustration, flow
- **Tier 4 (Context):** What surrounded it — position in session, time of day, error streaks

**Note:** SignalCollector is auto-loaded via the Helpers package. No extra script tag needed.

**CRITICAL: Do NOT define an inline stub/polyfill/fallback class for SignalCollector.** The real CDN script checks `if (window.SignalCollector)` and skips initialization if it already exists. An inline stub like `window.SignalCollector = window.SignalCollector || class { ... }` will permanently shadow the real package. Let `waitForPackages()` (PART-003) handle the loading wait. See Anti-Pattern 18 (PART-026).

## Initialization

Handled in PART-004. SignalCollector is created after `FeedbackManager.init()`, before Timer/VisibilityTracker:

```javascript
signalCollector = new SignalCollector({
  sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
  studentId: window.gameVariableState?.studentId || null,
  templateId: gameState.gameId || null
});
window.signalCollector = signalCollector;
```

## Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `containerSelector` | string | `'body'` | CSS selector for event delegation target |
| `maxBufferSize` | number | `5000` | Max events in ring buffer |
| `throttleMs` | number | `100` | Throttle interval for pointermove events |
| `sessionId` | string | `null` | Session identifier |
| `studentId` | string | `null` | Student identifier |
| `templateId` | string | `null` | Game template identifier |
| `hesitationThresholdMs` | number | `3000` | Pause duration to count as hesitation |
| `frustrationClickMs` | number | `1000` | Time window for detecting rapid clicks |
| `frustrationClickCount` | number | `3` | Clicks in window to flag frustration |

## Problem Lifecycle

### startProblem(problemId, problemData)

Call when a new question/round begins. Starts tracking input events for this problem.

```javascript
signalCollector.startProblem('round_' + roundNumber, {
  round_number: roundNumber,
  question_text: roundData.question,
  correct_answer: roundData.answer,
  difficulty: roundData.difficulty || null
});
```

### endProblem(problemId, outcome) → signals

Call after validation completes. Computes and returns Tier 2-4 signals.

```javascript
const signals = signalCollector.endProblem('round_1', {
  correct: true,
  answer: 63
});
```

### Deferred endProblem Pattern

**Important:** Don't call `endProblem` immediately on solve. Defer it to the next `startProblem` call so transition screen events stay tagged to the previous problem. Otherwise events during transitions get `problem_id: null` and are lost from problem-level analysis.

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
}

function submitAnswer(userAnswer) {
  const roundId = 'round_' + gameState.currentRound;
  const isCorrect = validateAnswer(userAnswer);

  // Defer endProblem — will be called at next startRound or endGame
  gameState.pendingEndProblem = {
    id: roundId,
    outcome: { correct: isCorrect, answer: userAnswer }
  };

  // Log the outcome as custom event (problem stays active through transition)
  signalCollector.recordCustomEvent('round_solved', { correct: isCorrect, answer: userAnswer });

  // Continue game flow...
}
```

### updateCurrentAnswer(answer)

For multi-input games (grids, drag-drop, matching) where the answer is spread across multiple inputs:

```javascript
// Single-input games: current_answer is auto-captured from input.value — no action needed

// Multi-input games: call updateCurrentAnswer after each change
gameState.userValues[cellKey] = value;
signalCollector.updateCurrentAnswer(gameState.userValues);
// e.g., {"1-1": 3, "1-2": 7} — student's work in progress, NOT the correct answer
```

### recordCustomEvent(type, data)

Record game-specific events not captured by automatic listeners:

```javascript
signalCollector.recordCustomEvent('hint_requested', { hint_number: 1 });
signalCollector.recordCustomEvent('scaffold_opened', { scaffold: 'number_line' });
```

## View Events (MANDATORY)

**RULE: Every function that modifies the DOM in a way that changes what is visible on screen MUST call `signalCollector.recordViewEvent()`.** This includes showing/hiding elements, updating text content, swapping screens, rendering new questions, highlighting cells, displaying feedback, and any timer-driven content swap.

### recordViewEvent(viewType, viewData)

| viewType | When to emit | Key data |
|---|---|---|
| `screen_transition` | Screen swap (ready→gameplay→results) | `screen`, `metadata.transition_from` |
| `content_render` | Content displayed — round start, timer reshuffle, auto-advance | `content_snapshot`, `metadata.trigger` |
| `feedback_display` | Correct/incorrect feedback shown | `content_snapshot.feedback_type`, `message` |
| `component_state` | Timer/progress/scaffold state change | `components.timer`, `components.progress` |
| `overlay_toggle` | Modal/transition screen show/hide | `content_snapshot.overlay`, `visible` |
| `visual_update` | Every game-specific visual change: cell selection, number entry, option highlight, grid mutation, drag state | `content_snapshot.type` + game-specific |

**Trigger field values:**
- `'round_start'` — initial content render at round/problem start
- `'user_action'` — content changed because user did something
- `'timer_reshuffle'` — content changed by game timer (no user action)

### View Event Examples

```javascript
// Screen transition
signalCollector.recordViewEvent('screen_transition', {
  screen: 'gameplay',
  metadata: { transition_from: 'ready' }
});

// Content render (round start)
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

// Timer-driven content change (no user action)
signalCollector.recordViewEvent('content_render', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'grid_generated',
    grid_index: gameState.gridIndex,
    pairs_visible: pairs.map(p => p.a + '+' + p.b),
    trigger: 'timer_reshuffle'
  },
  components: {
    timer: timer ? { value: timer.getCurrentTime(), state: 'running' } : null
  }
});

// Visual update (cell selection, option highlight, etc.)
signalCollector.recordViewEvent('visual_update', {
  screen: 'gameplay',
  content_snapshot: {
    type: 'cell_selected',
    selected_cell: { row: 1, col: 2 },
    user_values: gameState.userValues,
    cells_filled: Object.keys(gameState.userValues).length
  }
});

// Feedback display
signalCollector.recordViewEvent('feedback_display', {
  screen: 'gameplay',
  content_snapshot: {
    feedback_type: 'correct',
    message: 'Great job!',
    audio_id: 'correct'
  }
});

// Overlay toggle (transition screen)
signalCollector.recordViewEvent('overlay_toggle', {
  screen: 'transition',
  content_snapshot: {
    overlay: 'transition_screen',
    visible: true,
    title: 'Round 2'
  }
});
```

**Effect on input events:** After calling `recordViewEvent`, all subsequent input events automatically include a `view_context` field with the last recorded view state. Every click/tap/key knows what screen and content was visible when it happened.

## data-signal-id Markup

Add `data-signal-id` to important interactive elements for clear signal identification:

```html
<div class="game-play-area">
  <div data-signal-id="question-text" class="question">What is 38 + 25?</div>

  <div class="options">
    <button data-signal-id="option-a" class="option">53</button>
    <button data-signal-id="option-b" class="option">63</button>
    <button data-signal-id="option-c" class="option">65</button>
  </div>

  <input data-signal-id="answer-input" type="text" placeholder="Type answer">
  <button data-signal-id="submit-button" class="submit-btn">Submit</button>
</div>
```

**Target Identification Priority:**
1. `data-signal-id` attribute (explicit, game-defined) — use this for important elements
2. `id` attribute
3. `tag.className` (first 2 classes)
4. Tag name fallback

## Seal & Game Complete

Handled in PART-011. Use `seal()` to finalize and include signal data in the submission payload. See PART-011 for the `endGame()` integration.

## Data Access Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getInputEvents()` | `Array` | Copy of raw input events buffer |
| `getProblemSignals(problemId)` | `Object\|null` | Computed Tier 2-4 signals for a completed problem |
| `getAllProblemSignals()` | `Object` | Map of all completed problem signals |
| `getMetadata()` | `Object` | Collection metadata: version, counts, device context |
| `getCurrentView()` | `Object\|null` | Current view state (last set by `recordViewEvent`) |
| `debug()` | `Object` | Log and return debug summary |

## Lifecycle Methods

| Method | Description |
|--------|-------------|
| `seal()` | Finalize at game end. Detaches listeners, returns `{ events, signals, metadata }`. Idempotent. |
| `pause()` | Pause signal collection (use with VisibilityTracker) |
| `resume()` | Resume signal collection |

## Rules

- Initialize SignalCollector in PART-004 after `FeedbackManager.init()`
- Call `startProblem` before rendering each question — captures reading time
- Use deferred `endProblem` pattern — defer to next `startProblem` or `endGame`
- Call `recordViewEvent` in EVERY function that changes visible DOM content
- Add `data-signal-id` to all important interactive elements in HTML
- Use `updateCurrentAnswer` for multi-input games (grids, drag-drop)
- Signals are kept SEPARATE from `attempt_history` — never merge into attempt metadata
- Integrate with VisibilityTracker for pause/resume (PART-005)
- Call `seal()` in `endGame()` before postMessage (PART-011)

## Verification

### trackEvent
- [ ] `trackEvent` function exists in global scope
- [ ] Pushes to `gameState.events`
- [ ] Each event has `type`, `target`, `timestamp`
- [ ] `game_start` fired in setupGame
- [ ] `game_end` fired in endGame
- [ ] Game-specific interaction events fired

### SignalCollector
- [ ] SignalCollector initialized in PART-004 with sessionId, studentId, templateId
- [ ] `window.signalCollector` assigned
- [ ] `startProblem` called at each round/question start
- [ ] Deferred `endProblem` pattern used (via `gameState.pendingEndProblem`)
- [ ] `recordViewEvent` called in every DOM-modifying function
- [ ] `data-signal-id` attributes on important interactive elements
- [ ] `updateCurrentAnswer` used for multi-input games
- [ ] `seal()` called in endGame before postMessage
- [ ] Signals separate from attempt_history
- [ ] Integrated with VisibilityTracker (PART-005)

## Deep Reference

`mathai-game-builder/components/signal-collector.md` — Full API reference with input event schema, problem signal schema (Tier 2-4), and performance notes.

`mathai-game-builder/examples/signal-capture-patterns.md` — 9 copy-paste-ready integration patterns.
