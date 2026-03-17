# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this skill repository.

## Repository Purpose

This is the **mathai-game-builder** Claude Code skill for building educational math games. Games are **templates** (not static content) that receive runtime content via postMessage.

**For skill usage**: See [SKILL.md](SKILL.md) - the main entry point for building games.

**Game Types:**
- **Standard Games**: Full workflow with questions, validation, and feedback (6 phases)
- **Story-Only Games**: Simplified workflow for story display only (3 phases) - see [workflows/story-only-games.md](workflows/story-only-games.md)

## Prompt Dispatch & Change-Request Guard (MANDATORY)

**Every user message starts here.** Immediately after receiving a prompt, read [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md) and follow it before doing anything else. This applies even if the user simply says “approved” or “continue.”

Before you touch any phase instructions:

1. **Dispatch the prompt.** Use the classifier defined in [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md) to label the message as `START_OR_CONTINUE`, `EDIT_REQUEST`, or `APPROVAL_AND_ADVANCE`.
2. **Intercept edit requests.** If the intent is `EDIT_REQUEST` and `state.checklistsResetForCurrentEdit` is false, call the reset guard from the same document (STOP → reset checklists with `replaceAll: true` → optionally read back).
3. **Resume normal flow.** Only after the guard finishes do you run the phase workflow steps (write/edit files, etc.).
4. **State management.** Update the session flags described in `prompt-dispatch.md` so every subsequent edit re-triggers the guard.
5. **User visibility.** Mention in the response that checklists were reset before continuing, especially for edit flows.

This dispatcher/guard pair is the enforced entry point for **every** user prompt.

## Development vs Usage Workflow

**CRITICAL DISTINCTION:**

### Skill Development (Claude Code)
- **Where**: This repository, using Claude Code (claude.ai/code)
- **Purpose**: Develop, improve, and optimize the skill itself
- **Tools**: Read, Write, Edit, Bash (for skill files)
- **Output**: Updated skill repository
- **User**: Skill developer (maintaining patterns, workflows, examples)

### Game Generation (Claude Code)
- **Where**: Claude Code with skill loaded
- **Purpose**: Generate games using the skill
- **Tools**: Skill workflows (SKILL.md → workflows/*.md)
- **Output**: Game HTML files in `games/` directory
- **User**: Game creator (teachers, developers, content creators)

**Important:** When testing/verifying fixes:
1. Update skill files in Claude Code (this repo)
2. Open skill folder in Claude Code
3. Generate new game using updated skill
4. Test generated game in browser

**Game files are created in the `games/` directory within the skill folder.**

## Common Clarifications

### Q: A generated game has errors. Should I fix the game file directly?
**A:** No. Fix the skill patterns/workflows in Claude Code, then regenerate the game. This ensures all future games have the fix.

### Q: Should I test fixes by generating games in Claude Code?
**A:** Yes. Open the skill folder in Claude Code and generate games to test the skill workflows.

### Q: Checklists persist across chat sessions?
**A:** Yes. Checklists are written to the checklists subdirectory using Write tool (e.g., `games/{gameId}/checklists/phase-1-checklists.md`). They're accessible even when conversation context is lost.

### Q: What's the difference between Claude Code tools and mathai-core MCP?
**A:**
- **Claude Code native tools** (Read, Write, Edit, Bash): Used in ALL phases for game HTML and checklists
- **mathai-core MCP** (`register_game`, `upload_game_folder`): ONLY for CDN uploads and game registration
- **mathai-feedback MCP**: ONLY for feedback library search and audio generation

### Q: The lottie-player "already been used with this registry" error?
**A:** This is a race condition in the packages themselves (both FeedbackManager and Components try to register lottie-player). This will be fixed at the package level, not in the skill.

### Q: How do I verify the skill was updated correctly?
**A:**
1. Open skill folder in Claude Code
2. Generate a NEW game using the skill
3. Test the new game in browser
4. Check for presence of `waitForPackages()` function in generated HTML

### Q: When do I update the skill vs when does Claude Code need updating?
**A:**

**Update Skill (in Claude Code) when:**
- Generated games have errors (e.g., missing `waitForPackages()`, wrong API usage)
- Workflow patterns need improvement (e.g., better initialization, clearer instructions)
- Documentation has errors or is missing critical information
- Examples show incorrect patterns
- New components or features need to be documented
- Token optimization needed (remove duplication)
- **Action**: Edit skill files → Test by generating new game

**Claude Code needs updating when:**
- Tool calls fail (native tools not working)
- Permission issues accessing directories
- MCP servers not connecting properly
- Claude Code bug (e.g., tool execution issues)
- Infrastructure issue (not skill pattern issue)
- **Action**: User reports to Claude Code team, not a skill fix

**How to diagnose:**
- **Skill issue**: Generated game code is wrong/incomplete → Fix skill patterns
- **Claude Code issue**: Tool calls fail, paths inaccessible → Report to Claude team
- **Package issue**: lottie-player race condition → Fix in packages, not skill

**Example diagnostics:**
- ❌ "TimerComponent is not defined" → **Skill issue** (missing `waitForPackages()`) → Fixed in skill
- ❌ "File operation failed" → **Claude Code issue** (tool execution error) → Report to Claude team
- ❌ "lottie-player already used" → **Package issue** (race condition) → Will be fixed in packages

## Development Patterns

### Token Conservation Strategy

This skill uses **progressive disclosure** to prevent context overload:

**Response Style:**
- Maximum 3-4 sentences per response unless asked for detail
- No preamble or postamble - get straight to the point
- Show code/commands, not descriptions
- Minimal docs - JSON for registration, bullet points for testing
- NO README files unless explicitly requested

**Documentation Architecture:**
```
SKILL.md (navigation hub, ~160 lines)
  ├─→ workflows/ (phase checklists + minimal steps)
  ├─→ components/ (API quick reference)
  ├─→ reference/ (technical deep-dives)
  ├─→ examples/ (working code patterns)
  └─→ helpers/ (utility docs)
```

**Key Principle**: SKILL.md is a thin orchestrator that links to detailed files. Never duplicate content between files.

### Checklist System

Each phase uses **dual checklists** written to local directory:

**Checklist 1 - User Requirements** (generated from user prompts):
- Game-specific needs
- User interactions
- Visual requirements
- Dynamic based on conversation

**Checklist 2 - Skill Pattern Requirements** (from skill patterns):
- Package loading order
- API usage patterns
- File operation rules
- Static requirements

**Checklist Workflow:**
1. Present BOTH checklists before starting phase
2. Wait for user "start" confirmation
3. **Write checklists to local directory using Write tool**
4. Develop according to checklists
5. Verify BOTH checklists before notifying user (all ✅)
6. Fix any ❌ items immediately
7. Request approval only when all ✅
8. When a later prompt asks for **any** change after a phase is complete: analyze the prompt, **STOP editing**, reset every checklist up to the current phase (all `[✅]` → `[ ]`), make the edits, re-verify each checklist, then request approval (see [workflows/checklist-reset-strategy.md](workflows/checklist-reset-strategy.md))

### Prompt Dispatch & Change-Request Guard (MANDATORY)

Before you touch any phase instructions:

1. **Dispatch the prompt.** Use the classifier defined in [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md) to label the message as `START_OR_CONTINUE`, `EDIT_REQUEST`, or `APPROVAL_AND_ADVANCE`.
2. **Intercept edit requests.** If the intent is `EDIT_REQUEST` and `state.checklistsResetForCurrentEdit` is false, call the reset guard from the same document (STOP → reset checklists with `replaceAll: true` → optionally read back).
3. **Resume normal flow.** Only after the guard finishes do you run the phase workflow steps (write/edit files, etc.).
4. **State management.** Update the session flags described in `prompt-dispatch.md` so every subsequent edit re-triggers the guard.
5. **User visibility.** Mention in the response that checklists were reset before continuing, especially for edit flows.

This dispatcher/guard pair is the enforced entry point for **every** user prompt.

**Checklist Storage:**
- Written to game directory using Write tool (like index.html)
- Example: `games/{gameId}/checklists/phase-1-checklists.md`
- Available even in new chat contexts where conversation context is lost
- Update using Edit tool as checklist items are completed
- Create checklists directory first using Bash (`mkdir -p`)

### File Operations

**Claude Code Native Tools**

All file operations use Claude Code's native tools. No filesystem MCP needed.

**Read files:**
```javascript
Read({ file_path: "games/game-123/index.html" })
```

**Write files:**
```javascript
Write({
  file_path: "games/game-123/index.html",
  content: "<!DOCTYPE html>..."
})
```

**Edit files:**
```javascript
Edit({
  file_path: "games/game-123/index.html",
  old_string: "const timer = 60;",
  new_string: "const timer = 90;"
})

// Replace all occurrences
Edit({
  file_path: "games/game-123/index.html",
  old_string: "[✅]",
  new_string: "[ ]",
  replace_all: true
})
```

**Shell operations:**
```javascript
Bash({
  command: "mkdir -p games/game-123/checklists",
  description: "Create game directory"
})
```

**Directory Structure Pattern:**
```
games/
  └─ {gameId}/                     # Folder name is the gameId
      ├─ index.html                # Game file
      ├─ metadata.json             # Game metadata (game_id, version, phase, files)
      └─ checklists/               # Checklist files directory
          ├─ phase-1-checklist.md  # Phase 1 checklists (optional)
          ├─ phase-2-checklist.md  # Phase 2 checklists (optional)
          ├─ feedback-plan.md      # Phase 3 feedback plan (optional)
          └─ ...
```

**Important:** The folder name MUST be the gameId (e.g., `game_1234567890_abc123`), not a descriptive name.

**File Operations:**
- Phase 1: Use `Write` (create game HTML and metadata.json)
- Phase 2-5: Use `Edit` (modify game HTML and metadata.json)
- Phase 4: Use mathai-core MCP `register_game` (pass absolute file path)
- All phases: Use native tools for checklist storage (Read, Write, Edit)
- **All phases: Use mathai-core MCP `upload_game_folder` after file changes**

### Metadata Management

**metadata.json tracks game information across all phases:**

```json
{
  "game_id": "game_1234567890_abc123def",
  "version": "0.0.1",
  "current_phase": "phase-1",
  "files": [
    "/index.html",
    "/metadata.json"
  ]
}
```

**Metadata Fields:**
- `game_id`: Unique identifier generated in Phase 1 (format: `game_{timestamp}_{random}`)
- `version`: Semantic version starting at 0.0.1, incremented with each phase or user change
- `current_phase`: Current phase (phase-0, phase-1, phase-2, phase-3, phase-4, phase-5)
- `files`: Array of all files with relative paths

**Version Increments:**
- Phase 0 → 0.0.0 (metadata collection)
- Phase 1 → 0.0.1 (initial creation)
- Phase 2 → 0.0.2 (validation added)
- Phase 3 → 0.0.3 (feedback integrated)
- Phase 4 → 0.0.4 (game registered)
- Phase 5 → 0.0.5 (testing complete)
- User changes → increment minor version (e.g., 0.0.5 → 0.0.6)

**Always show game_id in every response:**
- Phase completions
- User change confirmations
- Status updates
- Error messages

**Example response format:**
```
🆔 Game ID: game_1234567890_abc123def
📦 Version: 0.0.3
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/game_1234567890_abc123def/index.html

[Rest of message...]
```

### CDN File Uploads

**🚨 CRITICAL: Upload ALL files in game directory**

**Step-by-step process:**

1. **Get absolute path of game directory:**
```bash
GAME_DIR=$(pwd)/games/${gameId}
```

2. **List all files to upload:**
```bash
# Use find to get all files
find games/${gameId} -type f
```

3. **Manually build files array:**

**YOU MUST MANUALLY LIST EVERY FILE.** Look at the find output and create entries for each file:

```javascript
const files = [
  // Root files
  { filePath: `${GAME_DIR}/index.html`, targetPath: "index.html" },
  { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },

  // Checklist files (if they exist)
  { filePath: `${GAME_DIR}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" },
  { filePath: `${GAME_DIR}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-3-checklist.md`, targetPath: "checklists/phase-3-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" },

  // Add more files as you see them in the find output
];
```

4. **Upload all files:**
```javascript
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**CRITICAL RULES:**
- Use `find` or Bash to list all files FIRST
- Examine the file list carefully
- Build the `files` array by MANUALLY adding each file you see
- Include ALL files (index.html, metadata.json, all checklists/*.md files)
- Skip hidden files (starting with `.`)
- Use absolute paths for filePath (resolve with `$(pwd)/games/...`)
- Always use `path/to/file` for targetPath (relative path)

**What gets uploaded:**
- `index.html` - Game file
- `metadata.json` - Game metadata
- `checklists/*.md` - All checklist files (phase-1, phase-2, phase-3, feedback-plan, etc.)
- Any other files in the game directory (images, assets, etc.)

**CDN URL Structure:**
- Base: `https://cdn.mathai.ai/mathai-games/game/{gameId}/`
- Files are uploaded to GCS bucket: `mathai-games`
- Max 100 files, 50MB per file
- Supports all web file types (HTML, CSS, JS, images, fonts, audio, video)

**Upload After:**
- Every phase completion
- Any user-requested changes

**Always show CDN URL in responses:**
```
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/[gameId]/index.html
```

### Game Resumption

**When user provides a gameId to continue an existing game:**

**Note:** For duplicating games (creating a new game from existing one), see [Game Duplication Checklist](workflows/checklists/game-duplication.md).

**Step 1: Fetch CDN metadata**
```javascript
const cdnMetadata = await mathai-core:resource_manifest({
  gameId: gameId
});

if (!cdnMetadata) {
  // Game doesn't exist on CDN
  return "❌ Game not found: [gameId]";
}
```

**Step 2: Check local filesystem**
```javascript
const localPath = `games/${gameId}/metadata.json`;

try {
  const localMetadata = Read({ file_path: localPath });
  const local = JSON.parse(localMetadata);
} catch (error) {
  // Local doesn't exist
}
```

**Step 3: Version comparison**

**Case A: Local doesn't exist** → Download from CDN
```
📥 Downloading game from CDN...

🆔 Game ID: [gameId]
📦 CDN Version: [version]
📍 Local Status: Not found
🎯 Action: Downloading all files from CDN
```

**Case B: CDN version > Local version** → Delete local, download from CDN
```
📥 Updating game from CDN...

🆔 Game ID: [gameId]
📦 CDN Version: [cdnVersion]
📍 Local Version: [localVersion]
🎯 Action: Local version outdated, downloading latest from CDN
```

**Case C: Local version >= CDN version** → Use local
```
✅ Using local game files

🆔 Game ID: [gameId]
📦 Local Version: [localVersion]
📦 CDN Version: [cdnVersion]
🎯 Action: Local version is up-to-date, using existing files
```

**Step 4: Download from CDN (if needed)**
```bash
# Delete old folder if outdated
rm -rf "games/${gameId}"

# Create fresh directory
mkdir -p "games/${gameId}"

# Download each file from metadata.json.files array
curl -f -o "${LOCAL_PATH}" "https://cdn.mathai.ai/mathai-games/game/${gameId}${relativePath}"
```

**Step 5: Resume from current phase**
```
✅ Game loaded successfully!

🆔 Game ID: [gameId]
📦 Version: [version]
📂 Location: games/[gameId]/
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/[gameId]/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [✓] Feedback
4. [CURRENT] Registration ← Continue from here
5. [ ] Testing

Ready to continue with Phase 4 (Registration)?
```

**See detailed workflow:** [workflows/game-resumption.md](workflows/game-resumption.md)

### Package Loading Order (CRITICAL)

⚠️ **Loading packages in wrong order causes critical errors**

**Correct Order:**
```html
<!-- 1. FeedbackManager MUST load first -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load second -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load third -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

<!-- 4. Analytics Config (optional - load before Analytics) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/config.js"></script>

<!-- 5. Analytics Package (optional - reads config) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**Why this order?** FeedbackManager loads SubtitleComponent first. If Components loads before FeedbackManager, it tries to load SubtitleComponent again → duplicate registration errors.

**Initialization Pattern:**
```javascript
// ✅ CRITICAL: Wait for ALL packages to load before initializing
async function waitForPackages() {
  // Wait for FeedbackManager
  while (typeof FeedbackManager === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  // Wait for Components (if using timer)
  while (typeof TimerComponent === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  // Wait for Helpers (if using VisibilityTracker)
  while (typeof VisibilityTracker === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  // Wait for Analytics if using tracking (optional)
  while (typeof AnalyticsConfig === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  while (typeof AnalyticsManager === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  // Wait for SignalCollector (auto-loaded via Helpers)
  while (typeof SignalCollector === 'undefined') {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  console.log('✅ All packages loaded');
}

window.addEventListener('DOMContentLoaded', async () => {
  // ✅ Wait for packages to load first
  await waitForPackages();

  // ✅ Now safe to initialize and use components
  await FeedbackManager.init();
  const timer = new TimerComponent(...);
  const tracker = new VisibilityTracker(...);

  // ✅ Initialize analytics if using tracking (optional)
  const analytics = new AnalyticsManager();
  await analytics.init();

  // ✅ Initialize signal collector for raw input capture
  const signalCollector = new SignalCollector({
    containerSelector: '.game-play-area',
    sessionId: window.gameVariableState?.sessionId,
    studentId: window.gameVariableState?.studentId
  });
  window.signalCollector = signalCollector;
});
```

**Why this is critical:** Script tags with `src` load asynchronously. Even with `DOMContentLoaded`, external packages might not be loaded yet. The `waitForPackages()` function explicitly waits for each package to be available before proceeding.

### Phase Separation

**Phase 1 (Core Gameplay):**
- Load packages in correct order
- Call `FeedbackManager.init()` in DOMContentLoaded
- NO feedback integration (audio URLs, preload, play)

**Phase 2 (Validation):**
- Add validation logic via `Edit`

**Phase 3 (Feedback):**
- NOW integrate feedback (audio URLs, preload, play)
- 4-step blocking workflow: Analyze → Plan → Approve → Integrate

**Phase 4 (Registration):**
- Use mathai-core MCP for registration (register_game, create_content_set)
- Pass file path to register_game (not HTML content)
- Extract InputSchema, register game, create content sets

**Phase 5 (Testing):**
- Run debug functions, verify functionality

### Example Loading Pattern

**Before implementing any code**, load reference examples:

```javascript
// Phase 1: Load package order + initialization examples
Read: examples/QUICK-REFERENCE.md

// Phase 3: Load feedback integration patterns
Read: examples/correct-patterns.md (Pattern 1 & 2)
Read: examples/QUICK-REFERENCE.md

// Copy exact patterns - do NOT improvise API usage
```

### Approval Pattern

**Claude CANNOT mark phases complete without user approval:**

```
Claude: "Phase N complete! [Features list]

📁 File [saved to / updated at]: /path/to/file.html

🌐 Testing instructions:
   1. [Action to test]
   2. [What to verify]

Current Status:
1. [✓] Phase 1
2. [PENDING APPROVAL] Phase 2 ← Please test
3. [ ] Phase 3

[Test/refresh] and approve if working well."
```

Wait for explicit "approve" or "approved" before proceeding.

## Documentation Philosophy

**Progressive Disclosure Pattern:**
- SKILL.md = High-level navigation (160 lines)
- workflows/ = Phase-specific checklists + steps (loaded on-demand)
- components/ = API quick reference (links to full docs)
- reference/ = Deep technical details (loaded as needed)
- examples/ = Production-ready code (copy-paste ready)

**Never duplicate content.** Always link to the authoritative source.

When instructions are needed, load the relevant workflow file using links in SKILL.md rather than duplicating content inline.

## Skill Development Guidelines

When developing or improving this skill:

1. **Token Conservation**
   - Remove duplication across files
   - Keep SKILL.md as thin navigation hub
   - Move detailed content to phase workflows
   - Use links instead of repeating content

2. **Checklist-Driven**
   - Every phase has dual checklists
   - Checklists written to local directory
   - Verification step before notifying user
   - All items must be ✅ before approval

3. **Modular Architecture**
   - Separate concerns: SKILL.md (nav), workflows/ (steps), reference/ (details)
   - Progressive disclosure prevents context overload
   - Load docs on-demand, not all at once

4. **Pattern-Based**
   - Provide complete working examples (examples/correct-patterns.md)
   - Show anti-patterns with fixes (examples/anti-patterns.md)
   - Inline critical patterns in workflows to prevent improvisation

5. **Explicit Over Implicit**
   - Clear tool mentions (Write, Edit, Bash for mkdir)
   - Explicit approval required at phase boundaries
   - Blocking points clearly marked (🚨)

6. **Skill Distribution**

   **Usage:**
   - Clone or download repository
   - Open directory in Claude Code
   - Skill loaded from SKILL.md automatically

   **No installation needed** - Direct repository usage in Claude Code.

   **For distribution:**
   ```bash
   rm -f mathai-game-builder.zip
   zip -r mathai-game-builder.zip . -x "*.DS_Store" "*/node_modules/*" "*/.git/*" "*/games/*"
   ```

## Quick Reference

**For skill workflows**: See [SKILL.md](SKILL.md)

**For phase details**: See `workflows/phase-[0-5]-*.md`

**For component APIs**: See `components/*.md`

**For troubleshooting**: See `reference/error-messages.md`

**For examples**: See `examples/correct-patterns.md` and `examples/QUICK-REFERENCE.md`
