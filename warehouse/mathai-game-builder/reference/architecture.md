# MathAI Game Builder Architecture

## Overview

The MathAI Game Builder creates educational games as **reusable templates** that receive runtime content, enabling unlimited variations from a single game implementation.

## Games as Templates

Games don't contain hardcoded content - they receive it at runtime via the postMessage protocol:

```javascript
// Game receives this via postMessage
window.addEventListener("message", (event) => {
  if (event.data.type === "game_init") {
    const { gameId, content, context, goals } = event.data.data;

    // content = runtime data from backend
    // context = student's previous performance
    // goals = target metrics for this session

    startGame(content);
  }
});
```

**Key Benefits:**
- **One game → unlimited content variations** (e.g., same quiz template, different problems)
- **Personalized content** delivered based on student level and performance
- **Platform integration** - works integrated with learn.mathai.ai platform
- **Runtime flexibility** - same game can serve different difficulty levels

The **same game template** can show different content to different students based on their level.

## PostMessage Protocol

### How Games Receive Content

Games communicate with the MathAI platform using the postMessage API:

**1. Initialization Message**
```javascript
window.addEventListener("message", (event) => {
  if (event.data.type === "game_init") {
    const { gameId, content, context, goals } = event.data.data;
    // Initialize game with received data
  }
});
```

**Message Structure:**
- `type: "game_init"` - Identifies initialization message
- `data.gameId` - Unique identifier for this game instance
- `data.content` - Game-specific content (questions, problems, etc.)
- `data.context` - Student's previous performance data
- `data.goals` - Target metrics for this session

**2. Sending Results Back**
```javascript
window.parent.postMessage({
  type: "game_complete",
  data: {
    gameId: currentGameId,
    results: {
      score: finalScore,
      attempts: allAttempts,
      events: eventTracker.getEvents()
    }
  }
}, "*");
```

## Answer Validation System

Games support three validation approaches to handle different types of questions.

### Validation Types

**1. Fixed Answer** - Single correct value or array
```javascript
// Single value: "What is 5 × 3?" → 15
const correct = userAnswer === correctAnswer;

// Fixed array: "List primes < 10" → [2,3,5,7]
const correct = checkArrayAnswer(userAnswer, [2, 3, 5, 7]);
```

**2. Function-Based** - Rule-based validation
```javascript
// "Name any even number" → Any n where n % 2 === 0
const correct = (n) => n % 2 === 0;

// "Find two numbers that sum to 10"
const correct = validateSum(userAnswer, targetSum);
```

**3. LLM-Based** - Subjective/open-ended responses
```javascript
// "Explain why 12 is even" → Backend evaluates
const attempt = {
  validationType: "llm",
  requiresBackendValidation: true,
  userAnswer: explanation
};
```

For detailed documentation, see [Answer Validation Types](../types/README.md).

## Event Tracking System

Two-level tracking provides complete replay capability for teachers and parents:

### High-Level: Attempt Tracking

Track each question attempt with outcome:

```javascript
const attempt = {
  questionNumber: 1,
  question: "What is 5 + 3?",
  userAnswer: "8",
  correctAnswer: "8",
  correct: true,
  validationType: "fixed",
  timestamp: Date.now(),
  attemptCount: 1
};

tracker.recordAttempt(attempt);
```

### Low-Level: Event Tracking

Track all user interactions for detailed replay:

```javascript
const eventTracker = {
  events: [],

  track(type, target, data = {}) {
    this.events.push({
      type,
      target,
      timestamp: Date.now(),
      ...data
    });
  },

  getEvents() {
    return this.events;
  }
};

// Usage examples
eventTracker.track("tap", "answer-button-3", { position: { x: 100, y: 200 } });
eventTracker.track("input_change", "answer-input", { value: "15" });
eventTracker.track("drag_end", "number-5", { dropTarget: "sum-box" });
```

### Standard Event Types

**Pointer Events:**
- `tap`, `hover`

**Input Events:**
- `input_change`, `input_focus`, `input_blur`

**Drag & Drop:**
- `drag_start`, `drag_move`, `drag_end`

**Game State:**
- `game_start`, `game_end`
- `question_shown`, `question_completed`
- `feedback_shown`, `audio_played`

**Navigation:**
- `level_start`, `hint_requested`
- `game_paused`, `game_resumed`

### Why Both Levels?

- **Attempts** = What happened (correct/incorrect, which question)
- **Events** = How it happened (every tap, drag, input change)

Together they enable:
- Teachers to replay student sessions
- Analytics to identify struggle points
- Parents to understand learning process
- Platform to adapt difficulty

### Signal Capture Layer (SignalCollector)

On top of the two-level tracking, the **SignalCollector** package provides a comprehensive raw signal capture layer:

```
DOM Events → SignalCollector buffer → Problem signals (Tier 2-4) → attempt_history.metadata.signals
                                   → Raw input_events → game_complete payload
```

**Three data flows:**

1. **Raw input events** — Every click, tap, drag, keystroke with full context (target, timestamp, position, problem state). Stored in a ring buffer (max 5000 events) and included in the `game_complete` postMessage payload as `input_events`.

2. **Problem-level signals** — Computed automatically on `endProblem()`:
   - **Tier 2 (Process):** `time_to_first_interaction`, `phase_times`, `interaction_sequence`, `self_corrections`
   - **Tier 3 (Engagement):** `hesitation_points`, `interaction_velocity`, `frustration_indicators`, `flow_indicators`
   - **Tier 4 (Context):** `problem_position_in_session`, `problems_since_last_error`, `time_of_day`

3. **Collection metadata** — Version, event counts, truncation status, device context.

**How it differs from AnalyticsManager:**
- AnalyticsManager sends 7 game events to Mixpanel/Amplitude/CleverTap (external analytics platforms)
- SignalCollector captures raw interactions and computed signals for the backend (pedagogy, cognition modeling)
- Both operate independently and capture complementary data

See [components/signal-collector.md](../components/signal-collector.md) for full API reference.

## Template Structure

### File Organization

```
game-template/
├── index.html              # Main game file
├── game.js                 # Game logic
├── styles.css              # Styling
├── helpers/
│   ├── api-helper.js       # Backend API integration (POC)
│   ├── tracker-helper.js   # Event & attempt tracking (POC)
│   └── case-converter.js   # camelCase ↔ snake_case conversion
└── README.md               # Template documentation
```

### Required Components

**1. Core Game Structure**
- HTML canvas or DOM-based interface
- Event listeners for user interactions
- Validation logic for answers
- State management for game progress

**2. PostMessage Integration**
- Listener for `game_init` messages
- Sender for `game_complete` results
- Embedded mode support for platform integration

**3. Tracking Systems**
- Attempt tracking for questions
- Event tracking for all interactions
- Session management

**4. Feedback System**
- FeedbackManager integration
- Audio playback (sounds + streams)
- Subtitles and stickers
- Debug utilities

### Package Dependencies

Games load centralized packages from CDN:

```html
<!-- FeedbackManager: Audio + Subtitles + Stickers -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- Components: Timer, Popup, etc. -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- Helpers: Case converter, utilities, InteractionManager -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
```

**Package Details:**
- **FeedbackManager**: Audio playback, subtitles, stickers, and multimedia feedback
- **Components**: Timer, Popup, Subtitle, Sticker UI components
- **Helpers**: Utility functions, API integration, and **InteractionManager**
- **InteractionManager**: Controls pointer-events on game areas during feedback and evaluation phases, automatically integrated with FeedbackManager for audio feedback control

**Why Centralized Packages?**
- Consistent behavior across all games
- Easy updates (fix once, deploy everywhere)
- Reduced code duplication
- Shared component library

### Platform Integration

Games run in embedded mode within the learn.mathai.ai platform:

```javascript
// Wait for postMessage from platform
window.addEventListener("message", handleGameInit);

function handleGameInit(event) {
  if (event.data.type === 'game_init') {
    const { content, sessionId, gameId } = event.data;
    startGame(content, sessionId, gameId);
  }
}
```

## Content Schema System

### Defining Input Schema

Games declare their expected content structure:

```javascript
// Game declares what content structure it expects
inputSchema: {
  type: "object",
  properties: {
    rounds: {
      type: "array",
      items: {
        type: "object",
        properties: {
          operand1: { type: "number" },
          operand2: { type: "number" },
          answer: { type: "number" }
        }
      }
    }
  },
  required: ["rounds"]
}
```

### Content Validation

Backend validates content against schema before delivery:

```javascript
// Content creator provides:
{
  rounds: [
    { operand1: 5, operand2: 3, answer: 15 },
    { operand1: 7, operand2: 4, answer: 28 }
  ]
}

// Backend validates structure matches inputSchema
// Game receives validated content via postMessage
```

## Platform Integration

### Game Registration

Games are registered in the **mathai-core** service:

1. Game uploaded to storage
2. Registered with metadata (name, description, tags)
3. Input schema extracted and stored
4. Game becomes available at `mathai/game/{id}`

### Content Sets

Different difficulty levels use the same game:

- **Easy**: Simple single-digit problems
- **Medium**: Double-digit with regrouping
- **Hard**: Multi-step word problems

All use the same game template, different content.

### Session Embedding

Games are embedded in learning sessions:

```javascript
// Platform creates iframe with game
<iframe src="mathai/game/{gameId}" />

// Platform sends initialization
iframe.contentWindow.postMessage({
  type: "game_init",
  data: { gameId, content, context, goals }
}, "*");

// Game sends results back
window.parent.postMessage({
  type: "game_complete",
  data: { results }
}, "*");
```

## Key Architectural Principles

1. **Templates Not Static Content** - Games are reusable, content is dynamic
2. **Runtime Content Delivery** - postMessage protocol for initialization
3. **Comprehensive Tracking** - Both attempts and detailed events
4. **Multi-Type Validation** - Support fixed, function, and LLM validation
5. **Centralized Packages** - Shared components and utilities
6. **Platform Integration** - Works embedded in learn.mathai.ai
7. **Audio-Centric Feedback** - Rich multimedia feedback system
8. **Interaction Control** - Automatic pointer-events management during feedback phases with configurable settings for custom behavior

## Related Documentation

- [Answer Validation Types](../types/README.md)
- [FeedbackManager Usage](../types/feedback-manager-usage.md)
- [Timer Component Usage](../types/timer-component-usage.md)
- [Subtitle Component Usage](../types/subtitle-component-usage.md)
- [Visibility Tracker Usage](../types/visibility-tracker-usage.md)
- [MCP Integration](./mcp-integration.md)
- [Troubleshooting Guide](./error-messages.md)
