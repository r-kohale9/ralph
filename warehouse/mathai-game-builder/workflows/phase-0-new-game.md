# Phase 0: New Game Metadata Collection

Collect game metadata before development begins. This phase creates the game directory and stores all game information.

## Critical Rules

Phase 0 collects metadata to inform all subsequent phases:

- Game identity (title, description, concepts)
- Configuration (grades, difficulty, time, type)
- Architecture (timer, lives, retry, stars)
- Creates game directory and metadata.json
- NO code development yet - just information gathering

## Workflow

### Step 0: Present Checklists

**Parse user prompt for game type and initial requirements.**

**Present User Requirements Checklist:**

```
📋 Phase 0 - User Requirements

Game Identity:
[ ] Game title defined
[ ] Game description written (1-2 sentences)
[ ] Educational concepts identified
[ ] Target subject/topic clear

Game Configuration:
[ ] Target grades defined (min and max)
[ ] Difficulty level chosen (easy/medium/hard)
[ ] Estimated time per session defined
[ ] Game type selected (assessment/practice/drill/challenge)

Game Architecture:
[ ] Timer requirement determined (countup/countdown/none)
[ ] Lives system defined (if applicable)
[ ] Retry option determined (yes/no)
[ ] Star system defined (if applicable)
[ ] Custom mechanics identified (if any)

Ready to start collecting metadata? (Reply "start")
```

**Present Pattern Requirements Checklist (Internal):**

```
📋 Phase 0 - Pattern Requirements

[ ] Game ID generated (game_timestamp_random)
[ ] Game directory created (games/{gameId})
[ ] Checklists directory created (games/{gameId}/checklists)
[ ] metadata.json created with version 0.0.0, current_phase "phase-0"
[ ] Phase 0 checklist written to disk
[ ] All metadata collected and validated
[ ] User confirmed metadata before Phase 1
[ ] Files uploaded to CDN via upload_game_folder
```

### Step 1: User Says "start" - Analyze Game Concept & Present Defaults

**When:** User says "start" after reviewing checklist.

**Action:** Analyze the user's game description and generate complete metadata with intelligent defaults.

**Default Generation Rules:**

Based on game concept, infer:
- Title: Extract or generate from description
- Description: Use user's description or create concise 1-2 sentence version
- Concepts: Identify educational concepts from game type
- Grades: Default based on complexity (e.g., addition → 1-3, multiplication → 2-4, fractions → 3-5)
- Difficulty: Start with "easy" unless specified
- Time: Default 5 minutes (300 seconds)
- Type: Default "practice" (most common)
- Timer: Default "decrease" (countdown timer - time limit adds engagement)
- Lives: Default "No" (less stressful)
- Retry: Default "Yes" for practice/drill, "No" for assessment
- Stars: Default "Yes" with standard thresholds (3★=100%, 2★=70%, 1★=50%)
- Custom Mechanics: Default "None"

IMPORTANT: timerType must use TimerComponent API terms:
- "decrease" = countdown timer (counts down from startTime to 0)
- "increase" = countup timer (counts up from 0)
- "none" = no timer

**Present all defaults immediately:**

```
Based on your game concept, here's the complete metadata:

Game Identity:
- Title: [inferred title]
- Description: [user's description or generated]
- Concepts: [inferred concepts]

Game Configuration:
- Target Grades: [inferred min]-[inferred max]
- Difficulty: easy
- Estimated Time: 5 minutes
- Game Type: practice

Game Architecture:
- Timer: decrease (countdown from 5 minutes)
- Lives: No
- Retry: Yes
- Star System: Yes (3★=100%, 2★=70%, 1★=50%)
- Custom Mechanics: None

Reply "approved" to use these defaults, or specify what you'd like to change.
Example: "change difficulty to medium, add 3 lives, change timer to increase"
```

Wait for user response. If approved, proceed to Step 2. If changes requested, update specific fields and re-present.

### Step 2: Generate Game ID & Create Directory

**After approval**, generate game ID and create directory structure.

```javascript
// Generate unique game ID
const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Create game directory with checklists subdirectory
Bash({
  command: `mkdir -p games/${gameId}/checklists`,
  description: 'Create game directory and checklists subdirectory'
});
```

Save gameId for all future operations.

**Important:** Folder name is the gameId (e.g., `game_1234567890_abc123`), not a descriptive name.

### Step 3: Create metadata.json

**Action:** Write metadata.json with all collected information.

```javascript
const gameDirectory = `games/${gameId}`;

Write({
  file_path: `${gameDirectory}/metadata.json`,
  content: JSON.stringify({
    game_id: gameId,
    version: "0.0.0",
    current_phase: "phase-0",

    // Game Identity
    title: "[user's title]",
    description: "[user's description]",
    concepts: ["concept1", "concept2", "concept3"],

    // Game Configuration
    minGrade: 3,  // from user input
    maxGrade: 5,  // from user input
    difficulty: "easy",  // from user input
    estimatedTime: 300,  // minutes * 60
    type: "practice",  // from user input

    // Game Architecture
    architecture: {
      timerType: "decrease",  // "decrease" (countdown) | "increase" (countup) | "none"
      timerStart: 300,  // starting seconds (for decrease: counts down from this; for increase: starts at 0)
      lives: {
        enabled: false,  // from user input
        startingCount: 0  // from user input (0 if disabled)
      },
      retryAllowed: true,  // from user input
      starSystem: {
        enabled: true,  // from user input
        thresholds: {
          3: 100,  // % for 3 stars
          2: 70,   // % for 2 stars
          1: 50    // % for 1 star
        }
      },
      customMechanics: []  // from user input, empty array if none
    },

    // Files
    files: ["/metadata.json"]
  }, null, 2)
});
```

### Step 3.5: Write Phase 0 Checklists

**Action:** Write both checklists to disk for persistence.

```javascript
Write({
  file_path: `${gameDirectory}/checklists/phase-0-checklist.md`,
  content: `📋 Phase 0 - User Requirements

Game Identity:
[✅] Game title defined: ${title}
[✅] Game description written: ${description}
[✅] Educational concepts identified: ${concepts.join(", ")}
[✅] Target subject/topic clear

Game Configuration:
[✅] Target grades defined: ${minGrade}-${maxGrade}
[✅] Difficulty level chosen: ${difficulty}
[✅] Estimated time per session defined: ${estimatedTime / 60} minutes
[✅] Game type selected: ${type}

Game Architecture:
[✅] Timer requirement determined: ${architecture.timerType}
[✅] Lives system defined: ${architecture.lives.enabled ? "Yes, " + architecture.lives.startingCount : "No"}
[✅] Retry option determined: ${architecture.retryAllowed ? "Yes" : "No"}
[✅] Star system defined: ${architecture.starSystem.enabled ? "Yes" : "No"}
[✅] Custom mechanics identified: ${architecture.customMechanics.length > 0 ? architecture.customMechanics.join(", ") : "None"}

📋 Phase 0 - Pattern Requirements

[✅] Game ID generated: ${gameId}
[✅] Game directory created: games/${gameId}
[✅] Checklists directory created: games/${gameId}/checklists
[✅] metadata.json created with version 0.0.0, current_phase "phase-0"
[✅] Phase 0 checklist written to disk
[✅] All metadata collected and validated
[✅] User confirmed metadata before Phase 1
`
});
```

### Step 4: Upload Files to CDN

**Action:** Upload metadata.json and checklists to CDN.

```javascript
// Get absolute path for MCP tool
const GAME_DIR = `$(pwd)/games/${gameId}`;

// Upload all files
mathai-core:upload_game_folder({
  gameId: gameId,
  files: [
    { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },
    { filePath: `${GAME_DIR}/checklists/phase-0-checklist.md`, targetPath: "checklists/phase-0-checklist.md" }
  ]
});
```

### Step 5: Request Approval for Phase 1

**Action:** Show completion message and request approval to proceed to Phase 1.

```
✅ Phase 0 complete!

🆔 Game ID: [gameId]
📦 Version: 0.0.0
📋 Metadata: games/[gameId]/metadata.json
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/[gameId]/metadata.json

Game Summary:
- Title: [title]
- Concepts: [concepts]
- Grades: [minGrade]-[maxGrade]
- Difficulty: [difficulty]
- Type: [type]
- Timer: [timerType]
- Lives: [enabled? "Yes (" + startingCount + ")" : "No"]
- Retry: [retryAllowed? "Yes" : "No"]
- Stars: [enabled? "Yes" : "No"]

Current Status:
0. [✓] Metadata Collection ← Completed
1. [ ] Core Gameplay ← Start here next
2. [ ] Validation
3. [ ] Feedback
4. [ ] Registration
5. [ ] Testing

Ready to start Phase 1 (Core Gameplay)?
```

**Wait for explicit "approve" or "approved" before Phase 1.**

---

## If the User Requests Changes After Approval

**MANDATORY WORKFLOW:**

1. **Analyze the new user prompt first.** If it asks for any change after Phase 0 approval, treat it as a change request.
2. **STOP** – do not touch files yet.
3. **Reset the Phase 0 checklist** using Edit tool so every [✅] becomes [ ].
4. **Then** make the requested edits to metadata.json and checklist.
5. **Re-verify** all checklist items until they are [✅] again.
6. **Re-upload** to CDN.
7. **Request approval** only after verification passes.

```javascript
// Reset checklist
Edit({
  file_path: `games/${gameId}/checklists/phase-0-checklist.md`,
  old_string: '[✅]',
  new_string: '[ ]',
  replace_all: true
});

// Make requested changes to metadata.json
Edit({
  file_path: `games/${gameId}/metadata.json`,
  old_string: '"title": "Old Title"',
  new_string: '"title": "New Title"'
});

// Re-verify checklist items and mark [✅]
// Re-upload to CDN
// Request approval again
```

---

## Reference

- [Checklist System](checklist-reset-strategy.md)
