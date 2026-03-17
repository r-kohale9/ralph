# MCP Server Integration

## Overview

The MathAI Game Builder uses **two MCP servers**:

1. **mathai-feedback** - Audio, stickers, and subtitle management
2. **mathai-core** - Game registration and content sets

**File operations use Claude Code native tools** (Read, Write, Edit, Bash), not MCP.

This document details the available tools, workflows, and best practices.

## Feedback MCP Tools

The **mathai-feedback** MCP server manages the feedback library. All feedback is audio-centric: every feedback is an audio file that can optionally include a subtitle and/or sticker.

### Available Tools

#### `search_feedback`

Search the feedback library by category, tags, or text query.

**Parameters:**
```javascript
{
  category?: string,        // Filter by category
  tags?: string[],          // Filter by tags
  query?: string,           // Text search
  limit?: number            // Max results (default: 10)
}
```

**Returns:**
```javascript
[
  {
    id: "feedback_123",
    audioUrl: "https://storage.googleapis.com/.../audio.mp3",
    text: "Great work!",
    category: "encouragement",
    tags: ["correct", "positive"],
    subtitle?: {
      text: "Great work!",
      duration: 2000
    },
    sticker?: {
      url: "https://storage.googleapis.com/.../sticker.json",
      type: "lottie"
    }
  }
]
```

**Example:**
```javascript
// Search for correct answer feedback
const results = await search_feedback({
  category: "encouragement",
  tags: ["correct"]
});

// Search for tap sounds
const tapSounds = await search_feedback({
  category: "effects",
  tags: ["tap", "click"]
});
```

#### `create_feedback`

Create new feedback with audio, optional subtitle, and optional sticker. Saved to library.

**Parameters:**
```javascript
{
  text: string,             // Text for TTS
  category: string,         // encouragement/corrections/effects/progress/celebrations
  tags?: string[],          // Optional tags
  subtitle?: {
    text: string,
    duration?: number       // Auto-calculated if not provided
  },
  sticker?: {
    url: string,            // Lottie animation URL
    type: "lottie"
  }
}
```

**Returns:**
```javascript
{
  id: "feedback_456",
  audioUrl: "https://storage.googleapis.com/.../audio.mp3",
  text: "Keep trying!",
  category: "encouragement",
  tags: ["incorrect", "supportive"],
  subtitle: { ... },
  sticker: { ... }
}
```

**Example:**
```javascript
// Create custom encouragement
const newFeedback = await create_feedback({
  text: "You're getting closer!",
  category: "encouragement",
  tags: ["incorrect", "supportive"],
  subtitle: {
    text: "You're getting closer!",
    duration: 2500
  }
});
```

#### `generate_dynamic_audio`

Generate audio at runtime with variable values. NOT saved to library (use for personalized feedback).

**Parameters:**
```javascript
{
  text: string,             // Template with {{variables}}
  variables?: object        // Variable values
}
```

**Returns:**
```javascript
{
  audioUrl: "https://storage.googleapis.com/.../temp_audio.mp3",
  text: "You scored 8 out of 10!"
}
```

**Example:**
```javascript
// Generate personalized score announcement
const scoreAudio = await generate_dynamic_audio({
  text: "You scored {{correct}} out of {{total}}!",
  variables: {
    correct: 8,
    total: 10
  }
});

// Use in game
await FeedbackManager.stream.play(scoreAudio.audioUrl, {
  subtitle: { text: scoreAudio.text }
});
```

#### `update_feedback_subtitle`

Add or update subtitle on existing feedback.

**Parameters:**
```javascript
{
  feedbackId: string,
  subtitle: {
    text: string,
    duration?: number
  }
}
```

#### `update_feedback_sticker`

Add or update sticker on existing feedback.

**Parameters:**
```javascript
{
  feedbackId: string,
  sticker: {
    url: string,
    type: "lottie"
  }
}
```

#### `get_categories`

List all available feedback categories.

**Returns:**
```javascript
[
  {
    name: "encouragement",
    description: "Positive reinforcement"
  },
  {
    name: "corrections",
    description: "Gentle error feedback"
  },
  {
    name: "effects",
    description: "Interaction sounds (taps, chimes)"
  },
  {
    name: "progress",
    description: "Dynamic feedback with variables"
  },
  {
    name: "celebrations",
    description: "Success moments"
  }
]
```

### Feedback Workflow (MANDATORY)

**Step 1: Identify Feedback Needs**

Analyze the game and list all feedback cases:

```
Feedback Cases:
- Tap/click sounds
- Correct answer feedback
- Incorrect answer feedback
- Game complete celebration
- Timer running out warning
```

**Step 2: Present PLAN to User**

Show feedback plan as a table (NO DB search yet):

```
| Case | Category | Description |
|------|----------|-------------|
| Tap | effects | Button/option tap sound |
| Correct | encouragement | Positive reinforcement |
| Incorrect | corrections | Supportive error feedback |
| Complete | celebrations | Game completion celebration |
```

**Step 3: Get User Approval**

Wait for user to review and approve the PLAN:
- User can modify cases
- User can add/remove categories
- User must explicitly approve with "approve" or "approved"

**Step 4: Search Database (AFTER Approval)**

Only after approval, search for each case:

```javascript
// Search for tap sound
const tapResults = await search_feedback({
  category: "effects",
  tags: ["tap"]
});

// Search for correct feedback
const correctResults = await search_feedback({
  category: "encouragement",
  tags: ["correct"]
});
```

**Step 5: Create if Not Found**

If search finds nothing suitable, create new feedback:

```javascript
// Nothing found, create new
const customFeedback = await create_feedback({
  text: "Excellent choice!",
  category: "encouragement",
  tags: ["correct", "unique"]
});
```

**Step 6: Integrate into Game**

Add feedback URLs to game code:

```javascript
const feedbackAssets = {
  tap: {
    audioUrl: tapResults[0].audioUrl,  // From search
    type: 'sound'
  },
  correct: {
    audioUrl: correctResults[0].audioUrl,
    subtitle: correctResults[0].subtitle,
    sticker: correctResults[0].sticker,
    type: 'stream'
  }
};
```

**NEVER search database before getting approval on the PLAN!**

## Core Service MCP Tools

The **mathai-core** MCP server manages game registration, content sets, and catalog.

### Basic Tools

#### `register_game`

Register a new game in the catalog with metadata and inputSchema.

**Parameters:**
```javascript
{
  gameArtifactPath: string,     // Absolute path to game HTML file
  metadata: {
    title: string,
    description?: string,
    concepts: string[],         // ["multiplication", "addition"]
    difficulty: string,         // "easy" | "medium" | "hard"
    gradeLevel: {
      min: number,
      max: number
    },
    estimatedDuration?: number, // Minutes
    features?: string[]         // ["timer", "audio", "drag-drop"]
  }
}
```

**Returns:**
```javascript
{
  gameId: "game_multiplication_quiz_v1_0_0",
  version: "1.0.0",
  status: "registered",
  inputSchema: { ... },         // Extracted from game
  createdAt: "2024-11-03T12:00:00Z"
}
```

**Example:**
```bash
# Get absolute path
GAME_DIR=$(pwd)/games/game-123

# Register new game
const gameResult = await mathai_core__register_game({
  gameArtifactPath: "${GAME_DIR}/index.html",
  metadata: {
    title: "Multiplication Quiz",
    description: "Interactive multiplication practice",
    concepts: ["multiplication", "times-tables"],
    difficulty: "medium",
    gradeLevel: { min: 3, max: 5 },
    estimatedDuration: 10,
    features: ["audio", "feedback", "timer"]
  }
});

console.log('Game ID:', gameResult.gameId);
```

**Important:**
- Always use absolute file path (resolve with `$(pwd)/games/...`)
- File must exist in games directory
- InputSchema extracted automatically from game code
- Creates new registration every time (never reuse)

#### `create_content_set`

Create a content set for a registered game.

**Parameters:**
```javascript
{
  gameId: string,
  name: string,
  grade: number,                // Grade level (e.g., 3, 4, 5)
  difficulty: string,           // "easy" | "medium" | "hard"
  concepts: string[],           // Educational concepts (e.g., ["multiplication", "times-tables"])
  content: object,              // Must match game's inputSchema
  description?: string,         // description
  metadata?: object             // JSONB metadata (stores complete creation context)
}
```

**Returns:**
```javascript
{
  contentSetId: "content_easy_001",
  gameId: "game_multiplication_quiz_v1_0_0",
  url: "https://learn.mathai.ai/game/game_multiplication_quiz_v1_0_0/content_easy_001",
  validated: true
}
```

**Example with metadata:**
```javascript
// Create easy content set with metadata
const easySet = await mathai_core__create_content_set({
  gameId: "game_multiplication_quiz_v1_0_0",
  name: "Grade 3 Easy - Times Tables 1-5",
  grade: 3,
  difficulty: "easy",
  concepts: ["multiplication", "times-tables"],
  content: {
    totalQuestions: 10,
    retryAllowed: true,
    timerType: "countdown",
    startTime: 300,
    starThresholds: { 3: 90, 2: 70, 1: 50 },
    questions: [
      { operand1: 2, operand2: 3, answer: 6 },
      { operand1: 4, operand2: 2, answer: 8 },
      { operand1: 3, operand2: 3, answer: 9 }
    ]
  },
  description: "Simple multiplication for grade 3",
  metadata: {
    name: "Grade 3 Easy - Times Tables 1-5",
    grade: 3,
    difficulty: "easy",
    concepts: ["multiplication", "times-tables"],
    tags: ["practice", "arithmetic"],
    estimatedTime: 300,
    itemCount: 10,
    targetAccuracy: 80,
    customFields: {
      teacherNotes: "Focus on 1-5 times tables",
      prerequisites: ["counting", "addition"],
      learningObjectives: ["Master 1-5 times tables", "Build multiplication fluency"]
    }
  }
});

console.log('Play at:', easySet.url);
```

**Metadata Field:**
The `metadata` JSONB field stores complete creation context and allows flexible querying:
- Stores any JSON structure (nested objects, arrays, etc.)
- Can include custom fields without schema changes
- Useful for filtering, analytics, and teacher notes

**Important:**
- Content automatically validated against inputSchema
- Returns playable URL immediately
- Share URL with user right after creation

#### `list_games`

Browse all registered games in catalog.

**Parameters:**
```javascript
{
  filters?: {
    concepts?: string[],
    difficulty?: string,
    gradeLevel?: number
  },
  limit?: number,
  offset?: number
}
```

**Returns:** Array of game objects

**Example:**
```javascript
// Find all multiplication games
const games = await mathai_core__list_games({
  filters: {
    concepts: ["multiplication"],
    gradeLevel: 4
  }
});
```

#### `search_content_sets`

Find content sets by criteria.

**Parameters:**
```javascript
{
  gameId?: string,
  difficulty?: string,
  tags?: string[],
  limit?: number
}
```

**Example:**
```javascript
// Find all easy content for a game
const easySets = await mathai_core__search_content_sets({
  gameId: "game_multiplication_quiz_v1_0_0",
  difficulty: "easy"
});
```

#### `validate_content`

Validate content against a game's inputSchema.

**Parameters:**
```javascript
{
  gameId: string,
  content: object
}
```

**Returns:**
```javascript
{
  valid: boolean,
  errors?: string[]
}
```

**Example:**
```javascript
// Validate before creating content set
const validation = await mathai_core__validate_content({
  gameId: "game_multiplication_quiz_v1_0_0",
  content: {
    rounds: [
      { operand1: 5, operand2: 3, answer: 15 }
    ]
  }
});

if (validation.valid) {
  // Safe to create content set
}
```

### Advanced Tools

#### `create_content_sets_batch`

Create multiple content sets from JSON file (avoids token limits).

**Parameters:**
```javascript
{
  gameId: string,
  contentFilePath: string       // Path to JSON file with array of content sets
}
```

**Example JSON file:**
```json
[
  {
    "name": "Easy Level 1",
    "difficulty": "easy",
    "content": { "rounds": [...] }
  },
  {
    "name": "Easy Level 2",
    "difficulty": "easy",
    "content": { "rounds": [...] }
  }
]
```

#### `generate_content_from_template`

Auto-generate content using built-in templates.

**Parameters:**
```javascript
{
  template: string,             // "multiplication-tables" | "addition-facts" | etc.
  parameters: {
    range?: [number, number],   // Number range
    count?: number,             // How many questions
    difficulty?: string
  }
}
```

**Returns:** Generated content matching template

**Example:**
```javascript
// Generate multiplication problems
const content = await mathai_core__generate_content_from_template({
  template: "multiplication-tables",
  parameters: {
    range: [1, 10],
    count: 20,
    difficulty: "easy"
  }
});

// Use in content set
await mathai_core__create_content_set({
  gameId: "game_multiplication_quiz_v1_0_0",
  name: "Generated Easy",
  difficulty: "easy",
  content: content
});
```

#### `validate_input_schema`

Validate schema before registration with sample content.

**Parameters:**
```javascript
{
  schema: object,               // JSON Schema
  sampleContent: object         // Example content to validate
}
```

**Example:**
```javascript
// Test schema before registering game
const validation = await mathai_core__validate_input_schema({
  schema: {
    type: "object",
    properties: {
      rounds: { type: "array" }
    },
    required: ["rounds"]
  },
  sampleContent: {
    rounds: [
      { operand1: 5, operand2: 3, answer: 15 }
    ]
  }
});
```

#### `update_game_version`

Create new version of existing game with changelog.

**Parameters:**
```javascript
{
  gameId: string,
  gameArtifactPath: string,     // Path to updated game file
  versionType: string,          // "major" | "minor" | "patch"
  changelog: string
}
```

**Example:**
```javascript
// Update game with bug fix
const newVersion = await mathai_core__update_game_version({
  gameId: "game_multiplication_quiz_v1_0_0",
  gameArtifactPath: "/Users/the-hw-app/Documents/claude/multiplication-quiz-v2.html",
  versionType: "minor",
  changelog: "Added timer component, fixed audio issues"
});

// Returns: game_multiplication_quiz_v1_1_0
```

#### `test_game`

Run automated tests on game.

**Parameters:**
```javascript
{
  gameArtifactPath: string,
  contentSetId?: string,
  tests: string[]               // ["renders", "accepts_input", "validates_correctly", "tracks_events"]
}
```

**Returns:**
```javascript
{
  passed: boolean,
  results: [
    { test: "renders", passed: true },
    { test: "accepts_input", passed: true },
    { test: "validates_correctly", passed: false, error: "..." }
  ]
}
```

#### `get_content_analytics`

Get usage and performance metrics for content sets.

**Parameters:**
```javascript
{
  gameId: string,
  contentSetId?: string,
  timeRange?: {
    start: string,
    end: string
  }
}
```

**Returns:**
```javascript
{
  totalPlays: 1234,
  averageScore: 78.5,
  averageAccuracy: 0.82,
  averageDuration: 245,
  completionRate: 0.91
}
```

#### `search_games_semantic`

Semantic search using natural language queries.

**Parameters:**
```javascript
{
  query: string,                // Natural language
  limit?: number
}
```

**Example:**
```javascript
// Natural language search
const games = await mathai_core__search_games_semantic({
  query: "games that teach fractions visually",
  limit: 5
});
```

## Search Patterns

### When to Search Feedback

**Search first:**
- Common feedback needs (tap, correct, incorrect)
- Standard encouragement/corrections
- Generic celebration sounds

**Create new:**
- Game-specific feedback
- Unique phrases
- Custom combinations
- When search finds nothing suitable

**Example:**
```javascript
// 1. Search first
const results = await search_feedback({
  category: "encouragement",
  tags: ["correct"]
});

// 2. If found, use it
if (results.length > 0) {
  feedbackAssets.correct = {
    audioUrl: results[0].audioUrl,
    subtitle: results[0].subtitle
  };
}

// 3. Otherwise, create
else {
  const newFeedback = await create_feedback({
    text: "Perfect multiplication!",
    category: "encouragement",
    tags: ["correct", "multiplication"]
  });

  feedbackAssets.correct = {
    audioUrl: newFeedback.audioUrl,
    subtitle: newFeedback.subtitle
  };
}
```

### When to Search Games

**Search existing games when:**
- User asks to "update [gameId]"
- User asks to "continue work on [gameId]"
- Adding content to existing game
- Checking if similar game exists

**Create new game when:**
- Building new game from scratch
- User asks to "create a game"
- No existing game matches requirements

**IMPORTANT:** Always create NEW registration for NEW games. Never reuse registrations.

## When to Create vs Search

### Feedback

| Scenario | Action |
|----------|--------|
| Common interaction sound | Search first |
| Standard encouragement | Search first |
| Generic celebration | Search first |
| Game-specific phrase | Create new |
| Custom combination | Create new |
| Personalized with variables | Use `generate_dynamic_audio` |

### Games & Content

| Scenario | Action |
|----------|--------|
| New game concept | Create new registration |
| Update existing game | Use `update_game_version` |
| Add difficulty levels | Create new content sets |
| Similar game exists | Still create new (don't reuse) |
| Testing variations | Create new content sets |

## Complete Workflow Example

### Creating a New Game with Feedback

```javascript
// Phase 1: Create Game HTML
// (Done in artifact viewer)

// Phase 2: Add Validation
// (Edit file with validation logic)

// Phase 3: Add Feedback
// Step 1: Identify needs
console.log('Feedback needed: tap, correct, incorrect, complete');

// Step 2: Present PLAN (get approval)
// (Show table to user, wait for "approve")

// Step 3: Search after approval
const tap = await search_feedback({ category: "effects", tags: ["tap"] });
const correct = await search_feedback({ category: "encouragement", tags: ["correct"] });
const incorrect = await search_feedback({ category: "corrections", tags: ["incorrect"] });

// Step 4: Integrate into game
const feedbackAssets = {
  tap: { audioUrl: tap[0].audioUrl, type: 'sound' },
  correct: { audioUrl: correct[0].audioUrl, subtitle: correct[0].subtitle, type: 'stream' },
  incorrect: { audioUrl: incorrect[0].audioUrl, subtitle: incorrect[0].subtitle, type: 'stream' }
};

// Phase 4: Register & Publish
// Step 1: Get absolute path
const GAME_DIR = `$(pwd)/games/game-123`;

// Step 2: Register game
const game = await mathai_core__register_game({
  gameArtifactPath: `${GAME_DIR}/index.html`,
  metadata: {
    title: "Multiplication Quiz",
    concepts: ["multiplication"],
    difficulty: "medium",
    gradeLevel: { min: 3, max: 5 }
  }
});

// Step 4: Create content sets
const easySet = await mathai_core__create_content_set({
  gameId: game.gameId,
  name: "Easy Single-Digit",
  grade: 3,
  difficulty: "easy",
  concepts: ["multiplication", "single-digit"],
  content: { rounds: [...] },
  description: "Single-digit multiplication practice",
  metadata: {
    name: "Easy Single-Digit",
    grade: 3,
    difficulty: "easy",
    concepts: ["multiplication", "single-digit"],
    tags: ["practice", "foundational"],
    estimatedTime: 300,
    itemCount: 10,
    targetAccuracy: 75,
    customFields: {
      teacherNotes: "Start with single-digit problems",
      prerequisites: ["counting"],
      learningObjectives: ["Master single-digit multiplication"]
    }
  }
});

console.log('Play at:', easySet.url);
// Share URL immediately: https://learn.mathai.ai/game/{gameId}/{contentSetId}
```

## Best Practices

1. **Always get approval before searching feedback library**
2. **Search broadly, create specifically**
3. **Validate content before creating sets**
4. **Share URLs immediately after creation**
5. **Use absolute file paths for registration**
6. **Create new registrations for new games**
7. **Test games before publishing**
8. **Use semantic search for discovery**

## Related Documentation

- [Architecture](./architecture.md) - System overview
- [Troubleshooting](./error-messages.md) - Common issues
- [FeedbackManager Usage](../types/feedback-manager-usage.md) - Audio implementation
