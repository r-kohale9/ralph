# Game Duplication Checklist

## When to Use

When a user wants to duplicate an existing game to create a new variation with a different game ID.

## Overview

Game duplication allows users to:
1. Copy an existing game from CDN
2. Create a new game with a fresh game_id
3. Reset version and phase tracking
4. Preserve game HTML and functionality
5. Continue development as a new independent game

## Pre-Duplication Verification

**Before starting duplication:**

- [ ] User provided source game_id to duplicate
- [ ] Confirmed source game exists on CDN using `resource_manifest`
- [ ] Explained duplication creates NEW game (independent from source)
- [ ] Confirmed user wants to proceed with duplication

## Step 1: Fetch Source Game from CDN

**Use mathai-core MCP to fetch source game metadata:**

```javascript
const sourceMetadata = await mathai-core:resource_manifest({
  gameId: sourceGameId
});

if (!sourceMetadata) {
  return "❌ Source game not found on CDN: [sourceGameId]";
}
```

**Verification:**
- [ ] Source game exists on CDN
- [ ] metadata.json fetched successfully
- [ ] Files array contains all game files
- [ ] Showed user source game info (version, phase, file count)

**Source Game Information to Display:**
```
📋 Source Game Information:
🆔 Source ID: [sourceGameId]
📦 Version: [sourceMetadata.version]
📍 Phase: [sourceMetadata.current_phase]
📄 Files: [sourceMetadata.files.length] files
```

## Step 2: Generate New Game ID

**Create unique game ID for duplicated game:**

```javascript
const newGameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
```

**Verification:**
- [ ] Generated new game_id using timestamp + random string
- [ ] Format matches: `game_{timestamp}_{9_char_random}`
- [ ] Confirmed new ID is unique (different from source)
- [ ] Showed user new game_id

**New Game Information to Display:**
```
🆕 New Game Created:
🆔 New ID: [newGameId]
📂 Directory: games/[newGameId]/
```

## Step 3: Create Local Directory Structure

**Create new game directory:**

```bash
mkdir -p games/${newGameId}
mkdir -p games/${newGameId}/checklists
```

**Verification:**
- [ ] Created `games/{newGameId}/` directory
- [ ] Created `games/{newGameId}/checklists/` subdirectory
- [ ] Verified directories exist using ls or Bash
- [ ] Used newGameId (not descriptive name) for folder

## Step 4: Download All Files from CDN

**Download each file from source game's CDN location:**

**Step 4.1: List all files to download**

```javascript
// From sourceMetadata.files array
const filesToDownload = sourceMetadata.files;
// Example: ["/index.html", "/metadata.json", "/checklists/phase-1-checklists.md", ...]
```

**Step 4.2: Download each file**

```bash
# Base CDN URL pattern
CDN_BASE="https://cdn.mathai.ai/mathai-games/game/${sourceGameId}"
NEW_GAME_DIR="games/${newGameId}"

# Download index.html
curl -f -o "${NEW_GAME_DIR}/index.html" \
  "${CDN_BASE}/index.html"

# Download metadata.json (will be modified in next step)
curl -f -o "${NEW_GAME_DIR}/metadata.json" \
  "${CDN_BASE}/metadata.json"

# Download each checklist file (if exists)
curl -f -o "${NEW_GAME_DIR}/checklists/phase-1-checklists.md" \
  "${CDN_BASE}/checklists/phase-1-checklists.md" 2>/dev/null || true

curl -f -o "${NEW_GAME_DIR}/checklists/phase-2-checklist.md" \
  "${CDN_BASE}/checklists/phase-2-checklist.md" 2>/dev/null || true

curl -f -o "${NEW_GAME_DIR}/checklists/phase-3-checklist.md" \
  "${CDN_BASE}/checklists/phase-3-checklist.md" 2>/dev/null || true

curl -f -o "${NEW_GAME_DIR}/checklists/feedback-plan.md" \
  "${CDN_BASE}/checklists/feedback-plan.md" 2>/dev/null || true

curl -f -o "${NEW_GAME_DIR}/checklists/phase-4-checklist.md" \
  "${CDN_BASE}/checklists/phase-4-checklist.md" 2>/dev/null || true

curl -f -o "${NEW_GAME_DIR}/checklists/phase-5-checklist.md" \
  "${CDN_BASE}/checklists/phase-5-checklist.md" 2>/dev/null || true

# Download any other files in the files array
# (images, assets, etc.)
```

**Verification:**
- [ ] Downloaded ALL files listed in sourceMetadata.files
- [ ] index.html downloaded successfully
- [ ] metadata.json downloaded successfully
- [ ] All checklist files downloaded (if they exist)
- [ ] Created subdirectories as needed (checklists/)
- [ ] Verified files exist locally using Read or ls

**Files Downloaded:**
```
📥 Downloaded [N] files from CDN:
- index.html
- metadata.json
- checklists/*.md (if present)
- [other files...]
```

## Step 5: Update metadata.json with New Game ID

**Modify metadata.json to reflect new game:**

**Step 5.1: Read downloaded metadata**

```javascript
const downloadedMetadata = Read({
  file_path: `games/${newGameId}/metadata.json`
});
const metadata = JSON.parse(downloadedMetadata);
```

**Step 5.2: Update metadata fields**

**CRITICAL: What to update:**

```javascript
// Update game_id to new ID
metadata.game_id = newGameId;

// Reset version to 0.0.1 (fresh start)
metadata.version = "0.0.1";

// Reset phase to phase-1 (start workflow from beginning)
metadata.current_phase = "phase-1";

// Clear registration fields (if present)
delete metadata.registered_game_id;
delete metadata.content_set_id;

// Keep files array as-is (same structure as source)
// Files array already has correct relative paths
```

**Step 5.3: Write updated metadata**

```javascript
Write({
  file_path: `games/${newGameId}/metadata.json`,
  content: JSON.stringify(metadata, null, 2)
});
```

**Verification:**
- [ ] Read downloaded metadata.json
- [ ] Updated game_id to newGameId
- [ ] Reset version to "0.0.1"
- [ ] Reset current_phase to "phase-1"
- [ ] Removed registered_game_id (if present)
- [ ] Removed content_set_id (if present)
- [ ] Preserved files array structure
- [ ] Wrote updated metadata.json
- [ ] Verified updated content using Read

**Updated Metadata Example:**
```json
{
  "game_id": "game_1234567890_newrandom",
  "version": "0.0.1",
  "current_phase": "phase-1",
  "files": [
    "/index.html",
    "/metadata.json",
    "/checklists/phase-1-checklists.md",
    "/checklists/phase-2-checklist.md",
    "/checklists/phase-3-checklist.md",
    "/checklists/feedback-plan.md"
  ]
}
```

## Step 6: Reset Checklists (Optional but Recommended)

**If checklists were downloaded, reset them for new workflow:**

**Option A: Delete checklist files (recommended for fresh start)**

```bash
rm -f games/${newGameId}/checklists/phase-*-checklist*.md
rm -f games/${newGameId}/checklists/feedback-plan.md
```

**Option B: Reset checklist checkboxes to unchecked**

```javascript
// For each checklist file
Edit({
  file_path: `games/${newGameId}/checklists/phase-1-checklists.md`,
  old_string: "[✅]",
  new_string: "[ ]",
  replace_all: true
});

Edit({
  file_path: `games/${newGameId}/checklists/phase-1-checklists.md`,
  old_string: "[✓]",
  new_string: "[ ]",
  replace_all: true
});
```

**Verification:**
- [ ] Decided on checklist reset strategy (delete or reset)
- [ ] If deleting: Removed all phase checklist files
- [ ] If resetting: Replaced all [✅] and [✓] with [ ]
- [ ] Updated metadata.json files array if checklists deleted

**Checklist Strategy:**
```
♻️ Checklist Reset:
Strategy: [Delete / Reset checkboxes]
Reason: [Fresh workflow / Preserve progress visibility]
```

## Step 7: Upload New Game to CDN

**Upload all files to CDN with new game_id:**

**Step 7.1: Get absolute path**

```bash
GAME_DIR=$(pwd)/games/${newGameId}
```

**Step 7.2: Build files array**

**CRITICAL: List ALL files manually**

```javascript
// Use find to see all files
// find games/${newGameId} -type f

const files = [
  // Root files (ALWAYS required)
  { filePath: `${GAME_DIR}/index.html`, targetPath: "index.html" },
  { filePath: `${GAME_DIR}/metadata.json`, targetPath: "metadata.json" },

  // Checklist files (if they exist)
  { filePath: `${GAME_DIR}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" },
  { filePath: `${GAME_DIR}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/phase-3-checklist.md`, targetPath: "checklists/phase-3-checklist.md" },
  { filePath: `${GAME_DIR}/checklists/feedback-plan.md`, targetPath: "checklists/feedback-plan.md" },
  { filePath: `${GAME_DIR}/checklists/phase-4-checklist.md`, targetPath: "checklists/phase-4-checklist.md" },

  // Add any other files from find output
];
```

**Step 7.3: Upload to CDN**

```javascript
await mathai-core:upload_game_folder({
  gameId: newGameId,
  files: files
});
```

**Verification:**
- [ ] Used find to list all local files
- [ ] Built files array with BOTH absolute and relative paths
- [ ] Included ALL files (index.html, metadata.json, checklists)
- [ ] Used absolute paths for filePath
- [ ] Used relative paths for targetPath
- [ ] Called upload_game_folder with newGameId
- [ ] Upload completed successfully

**Files Uploaded:**
```
📤 Uploaded [N] files to CDN:
- index.html
- metadata.json
- checklists/*.md (if present)
- [other files...]
```

## Step 8: Verify Duplication Success

**Confirm new game is independent and accessible:**

**Step 8.1: Test CDN access**

```
🌐 CDN URL: https://cdn.mathai.ai/mathai-games/game/[newGameId]/index.html
```

**Step 8.2: Verify local files**

```bash
ls -la games/${newGameId}/
cat games/${newGameId}/metadata.json
```

**Step 8.3: Compare source vs new**

```
📊 Duplication Summary:

Source Game:
🆔 ID: [sourceGameId]
📦 Version: [sourceMetadata.version]
📍 Phase: [sourceMetadata.current_phase]

New Game (Duplicated):
🆔 ID: [newGameId]
📦 Version: 0.0.1 (reset)
📍 Phase: phase-1 (reset)
📂 Location: games/[newGameId]/
🌐 CDN: https://cdn.mathai.ai/mathai-games/game/[newGameId]/index.html

✅ Duplication Complete!
```

**Verification:**
- [ ] CDN URL accessible (shows game)
- [ ] Local files exist and valid
- [ ] metadata.json has correct newGameId
- [ ] Version reset to 0.0.1
- [ ] Phase reset to phase-1
- [ ] New game is independent from source
- [ ] Showed user comparison (source vs new)

## Step 9: Continue as Normal (Phase-1 Workflow)

**After duplication, continue with standard Phase-1 workflow:**

**Step 9.1: Load current game state**

```javascript
const metadata = Read({
  file_path: `games/${newGameId}/metadata.json`
});
const { game_id, version, current_phase } = JSON.parse(metadata);
```

**Step 9.2: Resume from Phase-1**

```
✅ Game duplicated successfully!

Current Status:
1. [CURRENT] Core Gameplay (Phase 1) ← Start here
2. [ ] Validation (Phase 2)
3. [ ] Feedback Integration (Phase 3)
4. [ ] Registration (Phase 4)
5. [ ] Testing (Phase 5)

Ready to continue with Phase 1?
```

**Verification:**
- [ ] Loaded game metadata
- [ ] Confirmed current_phase is "phase-1"
- [ ] Ready to follow phase-1-core-gameplay.md workflow
- [ ] User can make changes to game HTML
- [ ] Changes will be versioned independently

**Next Steps:**
- User can modify game HTML/content
- Follow phase-1 workflow for validation
- Progress through phases independently
- Source game remains unchanged

## Common Duplication Scenarios

### Scenario A: Duplicate for New Content Variation

**Use case:** Same game mechanics, different content (e.g., different difficulty level)

**After duplication:**
1. Modify game HTML (different questions, assets, etc.)
2. Keep same game structure/mechanics
3. Progress through phases normally
4. Register as separate game in Phase 4

### Scenario B: Duplicate for Major Changes

**Use case:** Fork existing game to try experimental changes

**After duplication:**
1. Make structural changes to game HTML
2. Test new game mechanics
3. Keep original game untouched
4. Both games can coexist independently

### Scenario C: Duplicate from Different Phase

**Use case:** Duplicate a Phase-5 game to restart workflow

**After duplication:**
1. All files downloaded (including all checklists)
2. Reset to Phase-1
3. Can re-do validation, feedback, registration
4. Previous registration (registered_game_id) cleared

## Anti-Patterns (DO NOT USE)

```javascript
// ❌ WRONG - Keeping same game_id
metadata.game_id = sourceGameId; // Will overwrite source!

// ❌ WRONG - Not resetting version
metadata.version = sourceMetadata.version; // Should start at 0.0.1

// ❌ WRONG - Not resetting phase
metadata.current_phase = sourceMetadata.current_phase; // Should start at phase-1

// ❌ WRONG - Keeping registration IDs
// registered_game_id and content_set_id should be deleted

// ❌ WRONG - Not uploading to CDN
// New game must be uploaded with new game_id

// ❌ WRONG - Using same folder name
mkdir -p games/${sourceGameId}-copy // Use newGameId instead
```

**Verification:**
- [ ] VERIFY: New game_id is unique (not source ID)
- [ ] VERIFY: Version is 0.0.1 (not source version)
- [ ] VERIFY: Phase is phase-1 (not source phase)
- [ ] VERIFY: Registration fields cleared
- [ ] VERIFY: Uploaded to CDN with new game_id
- [ ] VERIFY: Folder name matches new game_id

## Final Verification Checklist

**Before marking duplication complete:**

- [ ] Source game fetched from CDN successfully
- [ ] New game_id generated and unique
- [ ] All files downloaded from source game CDN
- [ ] metadata.json updated with new game_id
- [ ] Version reset to 0.0.1
- [ ] Phase reset to phase-1
- [ ] Registration fields cleared (if present)
- [ ] Checklists reset or deleted (as appropriate)
- [ ] All files uploaded to CDN with new game_id
- [ ] CDN URL accessible and shows game
- [ ] Local files verified and valid
- [ ] User shown duplication summary
- [ ] Ready to continue with Phase-1 workflow

## Reference

**Related Workflows:**
- [workflows/game-resumption.md](../game-resumption.md) - Loading existing games
- [workflows/phase-1-core-gameplay.md](../phase-1-core-gameplay.md) - Continue after duplication

**MCP Tools:**
- `mathai-core:resource_manifest` - Fetch game from CDN
- `mathai-core:upload_game_folder` - Upload duplicated game

**File Operations:**
- Read - Read downloaded files
- Write - Write updated metadata.json
- Edit - Reset checklists (optional)
- Bash - Create directories, download files
