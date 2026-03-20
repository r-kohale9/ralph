# Phase 4: Game Registration & Content Sets

This phase registers the game in the catalog and creates content variations.

## Prerequisites

- Phases 1-3 completed and approved
- Game HTML file exists on filesystem from Phase 1
- InputSchema extractable from game code

## Workflow Steps

### Step 0: Present Phase 4 Checklist (MANDATORY FIRST)

**Action:** Display the EXACT Checklist 1 format below to the user BEFORE starting development. Do NOT paraphrase or summarize - copy the checklist verbatim. Checklist 2 is internal only (for Claude's verification).

**Checklist 1 - User Requirements (Present to user EXACTLY as shown):**

```
📋 Phase 4 Checklist - User Requirements

Registration Requirements:
[ ] Phases 1-3 approved
[ ] Game title defined
[ ] Game concepts/tags identified
[ ] Difficulty level defined (easy/medium/hard)
[ ] Estimated time per session defined
[ ] Target grades identified
[ ] Content set variations defined (at least 1)
[ ] Game architecture documented (how the game works):
    - Lives system (if your game uses lives)
    - Retry option (if players can retry questions)
    - Play Again option (if players can restart)
    - How the game ends (all scenarios)
    - How stars are calculated (what players need for 1, 2, or 3 stars)
[ ] Content structure documented (what makes your game reusable with different content)

Note: Before you proceed, I'll analyze your game and show you how it works and what content structure makes it reusable. Review this information and request any changes before we start registration.
```

**Checklist 2 - Skill Pattern Requirements (Internal - DO NOT show to user):**

```
📋 Phase 4 Checklist - Skill Pattern Requirements (Internal)

During registration:
[ ] Game file path referenced - VERIFY: Uses absolute path from Phase 1 (e.g., games/{gameId}/index.html for relative, $(pwd)/games/{gameId}/index.html for absolute MCP paths)
[ ] InputSchema extracted - VERIFY: Matches game code structure, includes all required fields (see reference/inputschema-guide.md)
[ ] Registration preview presented - VERIFY: Shows metadata, capabilities, inputSchema for user review
[ ] Get explicit user approval before register_game
[ ] Call register_game - VERIFY: Uses file path (NOT content), includes metadata and capabilities (see reference/mcp-integration.md)
[ ] Create content set - VERIFY: Uses create_content_set with gameId, contentSetName, content matching InputSchema (see reference/mcp-integration.md)
[ ] Share test URLs - VERIFY: Learn URL provided in format https://learn.mathai.ai/game/{gameId}/{contentSetId}
[ ] Game architecture documented - VERIFY: Analyzed game code, showed only applicable features (lives/retry/play-again/game-end/stars/timer), used non-technical language, explained behavior clearly
[ ] Content schema table presented - VERIFY: Extracted actual InputSchema fields, translated types to plain language (array→List, number→Number, string→Text), added explanations column, showed field paths with >, included validation rules and examples
```

**After presenting Checklist 1, IMMEDIATELY proceed to Step 0.5 (DO NOT wait for user confirmation).**

**Write Phase 4 Checklists to Disk:**

- Reuse the absolute `gameDirectory` path from earlier phases (e.g., `const gameDirectory = \`/Users/username/Documents/claude/${gameId}\``)
- Add any extra registration requirements gathered during the conversation before writing
- Persist BOTH checklists exactly as presented using `Write` tool

```javascript
const gameDirectory = `games/${gameId}`; // tracked since Phase 1

Bash({
  command: `mkdir -p ${gameDirectory}/checklists`,
  description: "Create checklists directory if needed"
});

Write({
  file_path: `${gameDirectory}/checklists/phase-4-checklist.md`,
  content: `📋 Phase 4 Checklist - User Requirements

Registration Requirements:
[ ] Phases 1-3 approved
[ ] Game title defined
[ ] Game concepts/tags identified
[ ] Difficulty level defined (easy/medium/hard)
[ ] Estimated time per session defined
[ ] Target grades identified
[ ] Content set variations defined (at least 1)
[ ] Game architecture documented (how the game works):
    - Lives system (if your game uses lives)
    - Retry option (if players can retry questions)
    - Play Again option (if players can restart)
    - How the game ends (all scenarios)
    - How stars are calculated (what players need for 1, 2, or 3 stars)
[ ] Content structure documented (what makes your game reusable with different content)

Note: Before you proceed, I'll analyze your game and show you how it works and what content structure makes it reusable. Review this information and request any changes before we start registration.

📋 Phase 4 Checklist - Skill Pattern Requirements (Internal)

During registration:
[ ] Game file path referenced - VERIFY: Uses absolute path from Phase 1 (e.g., games/{gameId}/index.html for relative, $(pwd)/games/{gameId}/index.html for absolute MCP paths)
[ ] InputSchema extracted - VERIFY: Matches game code structure, includes all required fields (see reference/inputschema-guide.md)
[ ] Registration preview presented - VERIFY: Shows metadata, capabilities, inputSchema for user review
[ ] Get explicit user approval before register_game
[ ] Call register_game - VERIFY: Uses file path (NOT content), includes metadata and capabilities (see reference/mcp-integration.md)
[ ] Create content set - VERIFY: Uses create_content_set with gameId, contentSetName, content matching InputSchema (see reference/mcp-integration.md)
[ ] Share test URLs - VERIFY: Learn URL provided in format https://learn.mathai.ai/game/{gameId}/{contentSetId}
[ ] Game architecture documented - VERIFY: Analyzed game code, showed only applicable features (lives/retry/play-again/game-end/stars/timer), used non-technical language, explained behavior clearly
[ ] Content schema table presented - VERIFY: Extracted actual InputSchema fields, translated types to plain language (array→List, number→Number, string→Text), added explanations column, showed field paths with >, included validation rules and examples
`,
});
```

> If you add additional checklist rows (e.g., custom registration requirements), include them in the saved content and keep this file updated with `Edit` tool as items toggle to `[✅]` or `[❌]`.

**Checklist Communication Pattern:**

**TO USER (Simple status only):**

- ✅ "All checklist items completed" (when all ✅)
- ⏳ "Some checklist items remaining" (when any ❌ or [ ])

**INTERNAL (Detailed tracking with SPECIFIC details):**

- Create checklist file locally with `Write` tool
- Update with `Edit` tool as items complete
- Mark items: `[ ]` → `[✅]` (done) or `[❌]` (needs fix)
- **CRITICAL: When marking [✅], add SPECIFIC implementation details:**

**❌ BAD (Ambiguous):**

```
[✅] Game registered
[✅] Content set created
```

**✅ GOOD (Specific, Verifiable):**

```
[✅] Registration: mathai-core:register_game({gameArtifactPath:"/path/to/file", metadata:{title, concepts, difficulty, estimatedTime, minGrade, maxGrade, type}, capabilities:{tracks, provides}, inputSchema:{type:"object", properties:{...}}}) - VERIFIED file path used (not content)
[✅] InputSchema: {type:"object", properties:{questions:{type:"array", items:{type:"object", properties:{operand1:number, operand2:number, answer:number}}}}} - VERIFIED structure matches game code
[✅] Content set: mathai-core:create_content_set({gameId, name:"Grade 3 Easy", grade:3, difficulty:"easy", concepts:["multiplication"], content:{questions:[...]}, metadata:{name, grade, difficulty, concepts, tags, estimatedTime, itemCount, customFields}}) - VERIFIED structure matches inputSchema AND metadata included
```

**Template for marking registration complete:**

```
[✅] MCP tool: mathai-core:toolName({param:value, param:value}) - VERIFIED params match requirements
[✅] InputSchema: exact structure {type, properties} - VERIFIED against game code
[✅] Content: structure matches inputSchema - VERIFIED validation passed
```

- Verify ALL items `[✅]` before user notification
- Fix ALL `[❌]` items immediately

**NEVER show checklist marks to user. Only show simple status.**

**🚨 IMPORTANT**: This workflow is for NEW games only. Always create a NEW registration with `register_game`. Never check for or reuse existing game registrations.

---

### Step 0.5: Analyze Game Architecture & Content Structure (AUTOMATIC - DO NOT WAIT FOR USER)

**Action:** IMMEDIATELY analyze the game and present architecture and content structure to the user. This happens automatically after showing Checklist 1.

**Important:** This section is dynamic - Claude should:
1. **FIRST: Present previously gathered metadata** (title, concepts, difficulty, grades, etc.)
2. Read the game HTML file from `games/{gameId}/index.html`
3. Identify which features are present (lives, retry, timer, stars, etc.)
4. Extract InputSchema fields from the game code
5. Identify hardcoded values that should be dynamic
6. Present ONLY relevant items to the user in non-technical language
7. Skip items that don't apply to this specific game

---

#### 📋 Game Metadata (from previous phases)

**Claude presents previously gathered information:**

```
📋 Game Metadata:

Title: [e.g., "Fraction Addition Practice" or "Not added yet"]
Concepts: [e.g., "fractions, addition" or "Not added yet"]
Difficulty: [e.g., "easy" or "Not added yet"]
Estimated Time: [e.g., "300 seconds (5 minutes)" or "Not added yet"]
Target Grades: [e.g., "3-5" or "Not added yet"]
Game Type: [e.g., "practice" or "Not added yet"]

💡 Note: If any information shows "Not added yet", you'll provide it during registration.
```

---

#### 🏗️ Game Architecture

**Claude presents how the game works:**

```
How Your Game Works:

1. Lives System (if applicable):
   - Available: [Yes/No]
   - Starting amount: [e.g., 3]
   - What happens: [e.g., "Lose 1 per wrong answer, game ends at 0"]

2. Retry Feature (if applicable):
   - Available: [Yes/No]
   - When: [e.g., "After wrong answers"]
   - What resets: [e.g., "Question stays same, inputs clear"]
   - Costs a life: [Yes/No]

3. Play Again Feature (if applicable):
   - Available: [Yes/No]
   - When: [e.g., "After all questions done"]
   - What happens: [e.g., "Reloads and waits for new questions"]

4. Game Ends When:
   - Platform notified: [Yes/No]
   - Scenarios: [e.g., "All questions done", "Lives lost", "Timer expired", "Quit button"]

5. Star Calculation (if applicable):
   - Available: [Yes/No]
   - Formula: [e.g., "3★: 100%, 2★: 60-99%, 1★: <60%"]
   - Based on: [e.g., "Accuracy only" or "Accuracy + time"]

6. Timer System (if applicable):
   - Type: [e.g., "Counts up" or "Counts down from 5 min"]
   - Starts from: [e.g., "0" or "300 seconds"]
   - What happens at end: [e.g., "Shows time only" or "Game ends"]
   - Can pause: [e.g., "Yes, when tab switches"]
```

---

#### 📊 Content Structure

**Claude extracts actual InputSchema and architecture variables, showing ONLY what's used in this game:**

```
| Variable | Type | Required? | Default | Example | Explanation | Currently |
|----------|------|-----------|---------|---------|-------------|-----------|
| totalQuestions | Number | No | 5 | 10 | How many questions in the game | Hardcoded ⚠️ |
| retryAllowed | Yes/No | No | true | false | Whether students can retry wrong answers | Hardcoded ⚠️ |
| timerType | Text | No | "countup" | "countdown" | Timer counts up from 0 or down from a time | Hardcoded ⚠️ |
| startTime | Number | No | 0 | 300 | What time the timer starts at (in seconds) | Hardcoded ⚠️ |
| starThresholds | Group | No | {3:100,2:60,1:0} | {3:90,2:70,1:50} | Score percentages needed for 1, 2, or 3 stars | Hardcoded ⚠️ |
| questions | List | Yes | - | [{...}] | The list of all questions for the game | Hardcoded ⚠️ |
| questions > num1 | Number | Yes | - | 1 | Top number of the first fraction | Hardcoded ⚠️ |
| questions > den1 | Number | Yes | - | 4 | Bottom number of the first fraction | Hardcoded ⚠️ |
| questions > num2 | Number | Yes | - | 1 | Top number of the second fraction | Hardcoded ⚠️ |
| questions > den2 | Number | Yes | - | 2 | Bottom number of the second fraction | Hardcoded ⚠️ |
| questions > answerNum | Number | Yes | - | 3 | Top number of the correct answer | Hardcoded ⚠️ |
| questions > answerDen | Number | Yes | - | 4 | Bottom number of the correct answer | Hardcoded ⚠️ |
```

**Instructions for Claude:**

**Architecture Analysis Process:**
1. Read game HTML from `games/{gameId}/index.html`
2. Search for patterns to identify features:
   - **Lives**: Look for `let lives`, `livesRemaining`, `lives--`, `lives = `, `updateLives()`
   - **Retry**: Look for `retry button`, `tryAgain()`, `resetQuestion()`, `retryButton`
   - **Play Again**: Look for `playAgain()`, `restart button`, `restartGame()`, `play-again-btn`
   - **Game End**: Look for `window.parent.postMessage`, `gameOver`, `endGame()`, `type: 'game-end'`
   - **Stars**: Look for `calculateStars()`, `stars =`, `getStarRating()`, `starCount`
   - **Timer**: Look for `new TimerComponent`, `timerDuration`, `countdown`, `timer =`
3. Present ONLY found features in the architecture section
4. Explain in simple, non-technical terms

**Content Schema Translation Process:**
1. **FIRST: Load Phase 0 metadata to get ALL architecture variables:**
   ```javascript
   const metadata = Read({ file_path: `games/${gameId}/metadata.json` });
   const meta = JSON.parse(metadata);
   const architecture = meta.architecture;
   ```
2. Find InputSchema definition in game code
3. **Extract ALL architecture variables from Phase 0 metadata - include everything defined:**
   - If `timerType` exists in metadata: MUST include `timerType` and `startTime`
   - If `lives.enabled` is true in metadata: MUST include `lives` (starting count)
   - If `retryAllowed` exists in metadata: MUST include `retryAllowed`
   - If `starSystem.enabled` is true in metadata: MUST include `starThresholds`
   - Always include: `totalQuestions`, `difficulty` (these vary per content set)
4. **Check if each variable is in InputSchema:**
   - If variable IS in InputSchema → mark "Currently: Dynamic ✅"
   - If variable is NOT in InputSchema (hardcoded in game) → mark "Currently: Hardcoded ⚠️"
   - This shows teachers the FULL configuration surface, not just what's already dynamic
5. **Ensure variables are comprehensive - add related variables:**
   - If `timerType` exists, MUST also include `startTime`
   - If `lives` exists, MAY include `livesLostPerWrong`
   - If `starThresholds` exists, MAY include `starBasis` ("accuracy", "time", "both")
   - If `retryAllowed` exists, MAY include `maxRetries` (number or "unlimited")
6. **Create ONE table with game variables at TOP, question fields below:**
   - Translate types: `array`→`List`, `number`→`Number`, `string`→`Text`, `boolean`→`Yes/No`
   - Show nested paths with `>`: `questions[].field` → `questions > field`
   - Write explanations in plain language that non-developers can understand (5-10 words)
   - Explain WHAT it is and WHY it matters, not technical jargon
   - Examples: "How many questions in the game", "Whether students can retry wrong answers", "Top number of the first fraction"
   - Add "Currently" column: `Dynamic ✅`, `Hardcoded ⚠️`
   - DO NOT include `Not used ❌` - only show what's actually used

**Language Guidelines:**
- ❌ Avoid: "schema", "properties", "items", "boolean", "array"
- ✅ Use: "structure", "fields", "list items", "Yes/No", "List"
- Explain WHY, not just WHAT (e.g., "This makes your game work with any multiplication problems")

**After presenting metadata, architecture, and content structure, ask user:**

```
Review the game information above:
- Game metadata (title, concepts, difficulty, etc.)
- Game architecture (how it works)
- Content structure (what makes it reusable)

If you want to make any changes to how the game works, let me know now.
Otherwise, reply "start" to proceed with registration.
```

---

## Part 1: Game Registration

### Step 1: User Says "start" - Verify Local Files (IF NEEDED)

**When:** User says "start" after reviewing architecture and content structure.

**Action:** Verify local game files are up-to-date with CDN ONLY if continuing work in a different chat session.

```javascript
// 1. Read local metadata to get gameId
const localMeta = Read({
  file_path: `games/${gameId}/metadata.json`
});

// 2. Fetch CDN metadata
const cdnMeta = mathai-core:resource_manifest({
  gameId: gameId
});

// 3. Compare versions
if (cdnMeta.version > localMeta.version) {
  // CDN has newer version - download it
  // See game-resumption.md for download steps
}
```

**Status Messages:**

✅ **Local up-to-date:**
```
✅ Local files verified (v${localVersion})
Proceeding with registration...
```

📥 **Downloading from CDN:**
```
📥 Updating from CDN (v${cdnVersion} > v${localVersion})
Downloaded ${fileCount} files
Proceeding with registration...
```

**See:** [workflows/game-resumption.md](game-resumption.md) for complete verification workflow

---

### Change Requests After Phase Approval

**MANDATORY WORKFLOW:** (Triggered automatically by [prompt-dispatch.md](prompt-dispatch.md) before you reach this section.)

1. **Analyze the latest user prompt.** If it requests _any_ change after Phase 4 (or earlier phases) was approved, treat it as a change request.
2. **STOP** – do **not** modify game or registration files yet.
3. **Reset every checklist up to Phase 4**—including support docs like `feedback-plan.md`—so all `[✅]` become `[ ]` using `replace_all: true` edits.
4. **Then** perform the requested updates.
5. **Re-verify** every reset checklist until each item is `[✅]` again.
6. **Request approval** only after verification passes.

Execute the sequence in [checklist-reset-strategy.md](checklist-reset-strategy.md) before touching any files.

```javascript
const gameDirectory = `games/${gameId}`;

for (const file of [
  "phase-1-checklists.md",
  "phase-2-checklist.md",
  "phase-3-checklist.md",
  "feedback-plan.md",
  "phase-4-checklist.md",
]) {
  Edit({
    file_path: `${gameDirectory}/checklists/${file}`,
    old_string: "[✅]",
    new_string: "[ ]",
    replace_all: true
  });
}
```

> Skipping the reset step breaks the workflow. Only restart registration work once all reset checklists show `[✅]` again.

### Step 2: Read Metadata & Setup

**Read metadata.json to get game info:**

```javascript
Read({
  file_path: `games/${gameId}/metadata.json`
});
// This gives you game_id, current version, and files
```

**Reference existing file path** from Phase 1 (file already exists). This avoids token limits by passing file path instead of HTML content to mathai-core MCP.

```javascript
// The game HTML file should already exist from Phase 1
// Example relative path: games/${gameId}/index.html
// For MCP tools, use absolute path: $(pwd)/games/${gameId}/index.html
```

**🚨 Note:** Use mathai-core MCP `register_game` with file path (not HTML content). Claude Code filesystem tools (Read, Write, Edit) are used in all phases.

### Step 3: Extract InputSchema

Extract the `inputSchema` from your game code. This defines what content structure the game expects.

**🎯 CRITICAL: Include ALL variables from Content Structure table (Step 0.5)**

The InputSchema MUST include:
1. **Game configuration variables** (totalQuestions, retryAllowed, timerType, startTime, starThresholds, etc.)
2. **Question data structure** (questions array with field definitions)

**Example InputSchema (COMPLETE with config variables):**

```javascript
{
  type: "object",
  properties: {
    // Game configuration variables
    totalQuestions: {
      type: "number",
      description: "Number of questions to show in the game",
      default: 5
    },
    retryAllowed: {
      type: "boolean",
      description: "Whether students can retry wrong answers",
      default: true
    },
    timerType: {
      type: "string",
      enum: ["countup", "countdown", "none"],
      description: "Timer behavior (counts up, down, or disabled)",
      default: "countup"
    },
    startTime: {
      type: "number",
      description: "Timer start value in seconds",
      default: 0
    },
    starThresholds: {
      type: "object",
      description: "Score percentages needed for 1, 2, or 3 stars",
      properties: {
        3: { type: "number", default: 100 },
        2: { type: "number", default: 70 },
        1: { type: "number", default: 50 }
      },
      default: { 3: 100, 2: 70, 1: 50 }
    },

    // Question data
    questions: {
      type: "array",
      description: "List of all questions for the game",
      items: {
        type: "object",
        properties: {
          operand1: { type: "number" },
          operand2: { type: "number" },
          answer: { type: "number" }
        },
        required: ["operand1", "operand2", "answer"]
      }
    }
  },
  required: ["questions"]
}
```

**Why include config variables?**
- Platform can customize game behavior per content set
- Teachers can adjust difficulty (more/fewer questions, enable/disable retry, etc.)
- Same game template works for different grade levels with different configs

### Step 4: Registration Preview

**Claude shows** registration details and asks for approval:

```
📋 Ready to Register

Metadata:
- Title: Multiplication Quiz
- Concepts: multiplication, times-tables
- Difficulty: medium
- Estimated Time: 300s
- Grades: 3-5
- Type: practice

Capabilities:
- Tracks: accuracy, time, stars
- Provides: score, stars

Game Architecture & Content Structure:
✅ Reviewed in Step 0.5 (see above for complete details)

Register this game in the catalog?
```

### Step 5: Register Game

**After approval**, Claude calls `register_game` with **absolute file path** and metadata:

```javascript
// CRITICAL: MCP tools need absolute paths
const gamePath = `$(pwd)/games/${gameId}/index.html`;

const gameResult = await mathai-core:register_game({
  gameArtifactPath: gamePath,
  metadata: {
    title: "Multiplication Quiz",
    concepts: ["multiplication", "times-tables"],
    difficulty: "medium",
    estimatedTime: 300,
    minGrade: 3,
    maxGrade: 5,
    type: "practice"
  },
  capabilities: {
    tracks: ["accuracy", "time", "stars"],
    provides: ["score", "stars"]
  },
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            operand1: { type: "number" },
            operand2: { type: "number" },
            answer: { type: "number" }
          },
          required: ["operand1", "operand2", "answer"]
        }
      }
    },
    required: ["questions"]
  }
});

const gameId = gameResult.id;  // Store this for content set creation!

// Inject registered game ID into the game HTML
const gameHtmlContent = Read({ file_path: `games/${gameId}/index.html` });
const gameIdScript = `<script>window.registered_game_id = '${gameId}';</script>`;
const updatedHtml = gameHtmlContent.replace('</head>', `${gameIdScript}</head>`);

Write({
  file_path: `games/${gameId}/index.html`,
  content: updatedHtml
});

// Update metadata.json with registration
Edit({
  file_path: `games/${gameId}/metadata.json`,
  old_string: '"version": "0.0.3"',
  new_string: '"version": "0.0.4"'
});
Edit({
  file_path: `games/${gameId}/metadata.json`,
  old_string: '"current_phase": "phase-3"',
  new_string: '"current_phase": "phase-4"'
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
const GAME_DIR = `$(pwd)/games/${gameId}`;
const allFiles = Glob({
  pattern: "**/*",
  path: `games/${gameId}`
});

// Build files array for upload (use absolute paths for MCP tool)
const files = [
  { filePath: `${GAME_DIR}/index.html`, targetPath: "index.html" },
  { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },
  { filePath: `${GAME_DIR}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" },
  { filePath: `${GAME_DIR}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-3-checklist.md`, targetPath: "checklists/phase-3-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" },
  { filePath: `${GAME_DIR}/checklists/phase-4-checklist.md`, targetPath: "checklists/phase-4-checklist.md" }
];

// Upload to CDN
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**Verify if all files in game directory are uploaded to CDN (Including checklists and any other files)**

## Part 2: Content Set Creation (Interactive)

This section uses an interactive, single-content-set-at-a-time workflow. Users create content sets one by one, reviewing each before registration.

### Step 1: Enter Content Set Mode

**After game registration is approved**, show:

```
✅ Game registered successfully!

🆔 Game ID: {gameId}
📦 Version: 0.0.4
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/{gameId}/index.html

Ready to create content sets. Type "create" to start.
```

**Initialize tracking variables:**
```javascript
let contentSetCount = 0;
let createdContentSets = [];  // Array of { id, name, grade, difficulty, items, url }
```

---

### Step 2: Generate Content Set Preview (on "create" command)

**When user says "create":**

1. **Load metadata to determine defaults:**
```javascript
const metadata = Read({ file_path: `games/${gameId}/metadata.json` });
const meta = JSON.parse(metadata);
const gameDifficulty = meta.difficulty;
const minGrade = meta.minGrade;
const maxGrade = meta.maxGrade;
const concepts = meta.concepts;
```

2. **Determine next grade to generate:**
```javascript
// Start with minGrade, increment for each new content set
const nextGrade = minGrade + contentSetCount;
// If exceeded maxGrade, still allow but use maxGrade as default
const targetGrade = Math.min(nextGrade, maxGrade);
```

3. **Auto-generate content based on grade:**

| Grade | Content Range | Description |
|-------|---------------|-------------|
| 1 | Sums 1-10 | Single digit, basic addition |
| 2 | Sums 1-20 | Larger single digit sums |
| 3 | Sums 1-50 | Two-digit addition |
| 4+ | Sums 1-100 | Larger numbers |

4. **Write preview file:** `games/{gameId}/content-preview-{n}.md`

```javascript
const previewNumber = contentSetCount + 1;
const previewPath = `games/${gameId}/content-preview-${previewNumber}.md`;

Write({
  file_path: previewPath,
  content: `# Content Set Preview: Grade ${targetGrade} ${gameDifficulty} - [Description]

## Configuration

\`\`\`json
{
  "name": "Grade ${targetGrade} ${gameDifficulty} - [Description]",
  "grade": ${targetGrade},
  "difficulty": "${gameDifficulty}",
  "concepts": ${JSON.stringify(concepts)},
  "totalRounds": 3,
  "pairsPerRound": 5,
  "totalLives": 3,
  "starThresholds": {
    "3": 30,
    "2": 40,
    "1": 41
  },
  "numberOfSets": 4
}
\`\`\`

## Question Sets

\`\`\`json
{
  "A": [
    { "id": 0, "expression": "1 + 2", "sum": 3 },
    { "id": 1, "expression": "2 + 1", "sum": 3 },
    // ... 15 questions per set
  ],
  "B": [ /* 15 questions */ ],
  "C": [ /* 15 questions */ ],
  "D": [ /* 15 questions */ ]
}
\`\`\`

## Summary

- **Total questions:** 60 (4 sets × 15 questions)
- **Sum range:** 1-10
- **Suitable for:** Grade ${targetGrade} students
`
});
```

5. **Display preview table to user:**

```
📋 Content Set Preview #1

| Variable | Value |
|----------|-------|
| name | Grade 1 Easy - Sums to 10 |
| grade | 1 |
| difficulty | easy |
| concepts | addition, number sense |
| totalRounds | 3 |
| pairsPerRound | 5 |
| totalLives | 3 |
| starThresholds | { "3": 30, "2": 40, "1": 41 } |
| numberOfSets | 4 |
| questionSets | 📄 [View full content](games/{gameId}/content-preview-1.md) |

Commands:
- "modify [variable] to [value]" - Change a value
- "create" - Register this content set
- "cancel" - Discard and start over
```

---

### Step 3: Handle User Commands

#### Command: "modify [variable] to [value]"

1. Parse the variable name and new value
2. Update the preview data
3. Update the preview file
4. Show updated table with change indicator:

```
📋 Content Set Preview #1 (updated)

| Variable | Value |
|----------|-------|
| name | Grade 1 Easy - Sums to 10 |
| grade | 1 |
| difficulty | easy |
| concepts | addition, number sense |
| totalRounds | 3 |
| pairsPerRound | 5 |
| totalLives | **5** ← changed |
| starThresholds | { "3": 30, "2": 40, "1": 41 } |
| numberOfSets | 4 |
| questionSets | 📄 [View full content](games/{gameId}/content-preview-1.md) |

Commands:
- "modify [variable] to [value]" - Change a value
- "create" - Register this content set
- "cancel" - Discard and start over
```

#### Command: "create" (register content set)

1. **Call `mathai-core:create_content_set`:**

```javascript
const contentResult = await mathai-core:create_content_set({
  gameId: gameId,
  name: previewData.name,
  grade: previewData.grade,
  difficulty: previewData.difficulty,
  concepts: previewData.concepts,
  description: `Content set for grade ${previewData.grade} students`,
  content: {
    // All config variables from preview
    totalRounds: previewData.totalRounds,
    pairsPerRound: previewData.pairsPerRound,
    totalLives: previewData.totalLives,
    starThresholds: previewData.starThresholds,
    numberOfSets: previewData.numberOfSets,
    questionSets: previewData.questionSets
  },
  metadata: {
    name: previewData.name,
    grade: previewData.grade,
    difficulty: previewData.difficulty,
    concepts: previewData.concepts,
    tags: ["practice", "arithmetic"]
  }
});

const contentSetId = contentResult.id;
```

2. **Track created content set:**
```javascript
contentSetCount++;
createdContentSets.push({
  id: contentSetId,
  name: previewData.name,
  grade: previewData.grade,
  difficulty: previewData.difficulty,
  items: previewData.numberOfSets * 15,  // or calculate from actual content
  url: `https://learn.mathai.ai/game/${gameId}/${contentSetId}`
});
```

3. **Show cumulative table** (see Step 4)

#### Command: "cancel"

1. Delete preview file
2. Return to "Ready to create content sets" state:

```
Preview discarded.

Ready to create content sets. Type "create" to start.
```

---

### Step 4: Show Cumulative Table (after each creation)

After each content set is created, show cumulative table:

```
✅ Content set created!

📊 Content Sets ({n} total):

| # | Name | Grade | Difficulty | Items | Test URL |
|---|------|-------|------------|-------|----------|
| 1 | Grade 1 Easy - Sums to 10 | 1 | easy | 60 | https://learn.mathai.ai/game/{gameId}/{csId1} |
| 2 | Grade 2 Easy - Sums to 20 | 2 | easy | 60 | https://learn.mathai.ai/game/{gameId}/{csId2} |

Commands:
- "add another" - Create another content set
- "done" - Finish and proceed to Phase 5
```

**When user says "add another":**
- Go back to Step 2 (Generate Content Set Preview)
- Increment preview number
- Auto-suggest next grade in range

---

### Step 5: Handle "done" Command

#### If 0 content sets created:

```
⚠️ Warning: No content sets created yet.
   The game is registered but won't be playable without at least 1 content set.

Are you sure you want to proceed to Phase 5?
- "done" - Yes, proceed anyway
- "create" - Create a content set first
```

#### If content sets exist:

```
✅ Phase 4 Complete!

Game Registration:
- Game ID: {gameId}
- Version: 0.0.4

📊 Content Sets ({n} total):

| # | Name | Grade | Difficulty | Items | Test URL |
|---|------|-------|------------|-------|----------|
| 1 | Grade 1 Easy - Sums to 10 | 1 | easy | 60 | https://learn.mathai.ai/game/{gameId}/{csId1} |
| 2 | Grade 2 Easy - Sums to 20 | 2 | easy | 60 | https://learn.mathai.ai/game/{gameId}/{csId2} |

Test your content sets and approve to proceed to Phase 5.
```

---

### Step 6: Verify Checklists (MANDATORY BEFORE PHASE 5)

**Action:** Verify BOTH checklists are complete BEFORE requesting final approval.

**Checklist 1 Verification - User Requirements:**

```
[✅/❌] Game title registered
[✅/❌] Game concepts/tags included
[✅/❌] Difficulty level set
[✅/❌] Estimated time set
[✅/❌] Target grades set
[✅/❌] Content sets created (or warning acknowledged if 0)
```

**Checklist 2 Verification - Skill Pattern Requirements:**

```
[✅/❌] Game file path used (not content)
[✅/❌] InputSchema extracted
[✅/❌] Registration preview shown
[✅/❌] User approval received before register_game
[✅/❌] mathai-core MCP register_game called with file path
[✅/❌] Content set preview shown before each creation
[✅/❌] Test URLs shared in cumulative table
```

**Wait for explicit "approve" before Phase 5.**

---

### Content Preview File Template

**File:** `games/{gameId}/content-preview-{n}.md`

```markdown
# Content Set Preview: {name}

## Configuration

\`\`\`json
{
  "name": "{name}",
  "grade": {grade},
  "difficulty": "{difficulty}",
  "concepts": [{concepts}],
  "totalRounds": {totalRounds},
  "pairsPerRound": {pairsPerRound},
  "totalLives": {totalLives},
  "starThresholds": {
    "3": {threshold3},
    "2": {threshold2},
    "1": {threshold1}
  },
  "numberOfSets": {numberOfSets}
}
\`\`\`

## Question Sets

\`\`\`json
{
  "A": [
    { "id": 0, "expression": "...", "sum": ... },
    ...
  ],
  "B": [...],
  "C": [...],
  "D": [...]
}
\`\`\`

## Summary

- **Total questions:** {totalQuestions}
- **Sum range:** {range}
- **Suitable for:** Grade {grade} students learning {concepts}
```

## Error Handling

**Common Errors:**

| Error                               | Cause                                           | Fix                                             |
| ----------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| "ENOENT: no such file or directory" | File not in MCP-accessible directory            | Use absolute paths from allowed directories     |
| Content validation fails            | Content doesn't match inputSchema               | Verify content structure matches schema exactly |
| Preview file not found              | User modified path or file was deleted          | Regenerate preview with "create" command        |

**Critical Rules Checklist:**

```
Required Actions:
[ ] Reuse Phase 1 artifact HTML
[ ] VERIFY: No game content regeneration
[ ] Use absolute paths from allowed directories
[ ] Content MUST match inputSchema exactly
[ ] Write preview file before showing preview table
[ ] Show cumulative table after each content set creation

Prohibited Actions:
[ ] VERIFY: No /tmp/ or /home/claude/ paths (not MCP-accessible)
[ ] VERIFY: No batch content set creation (one at a time only)
[ ] VERIFY: No auto-creating content sets without user "create" command
```

**Content Set Creation Flow:**

```
Interactive Commands:
[ ] "create" - Generate preview OR register content set (context-dependent)
[ ] "modify [var] to [val]" - Update preview before registration
[ ] "cancel" - Discard current preview
[ ] "add another" - Start new content set preview
[ ] "done" - Finish content set creation, proceed to Phase 5
```

**⚠️ CRITICAL Permission Checklist:**

```
MCP Tool Usage:
[ ] Get human approval BEFORE calling register_game
[ ] User must say "create" to register each content set
[ ] VERIFY: No game registration without explicit user permission
[ ] VERIFY: No content set registration without user "create" command
[ ] VERIFY: Show preview and allow modifications before registration
```

```
URL Sharing Rules:
[ ] After each content set creation: Show cumulative table with ALL URLs
[ ] Include Test URL column in cumulative table
[ ] On "done": Show final summary with all content sets and URLs
```

**Warning Handling:**

```
Zero Content Sets Warning:
[ ] If user says "done" with 0 content sets: Show warning
[ ] Warn that game won't be playable without content sets
[ ] Allow user to confirm "done" again or "create" instead
```
