# Game Resumption Workflow

Resume working on an existing game by providing its gameId.

## When to Use

**This workflow is used in TWO scenarios:**

### Scenario 1: Explicit Resumption

User explicitly provides a gameId to continue:

- "Continue game game_1234567890_abc123"
- "Resume gameId: game_1234567890_abc123"
- "I want to work on game game_1234567890_abc123"

**Note:** For duplicating games (creating a new game from existing one), see [Game Duplication Checklist](checklists/game-duplication.md).

### Scenario 2: Pre-Phase Verification (AUTOMATIC)

**CRITICAL:** Before starting ANY phase (2-5) or making changes to existing game:

- User is continuing work in a different chat session
- User references existing gameId in their request
- Must verify local files are up-to-date with CDN before proceeding

**This check is MANDATORY and AUTOMATIC before Phases 2-5.**

## Pre-Phase Verification (Quick Reference)

**Use this section when verifying before phase operations:**

1. Read metadata.json to get gameId
2. Call `mathai-core:resource_manifest({ gameId })`
3. Check local filesystem for game
4. Compare versions
5. Download from CDN if needed

**See full workflow below for complete steps.**

## Workflow Steps

### Step 1: Fetch CDN Metadata

**Action:** Get game metadata from CDN

```javascript
const cdnMetadata = await mathai-core:resource_manifest({
  gameId: gameId
});
```

**Possible outcomes:**

- **Success**: Returns metadata.json object with `game_id`, `version`, `current_phase`, `files`
- **Not found**: Returns null (game doesn't exist on CDN)

**If not found:**

```
❌ Game not found: [gameId]

The game doesn't exist on CDN. Please check the gameId or start a new game.
```

---

### Step 2: Check Local Filesystem

**Action:** Check if game exists locally and get its version

```javascript
// Try to read local metadata
const localPath = `games/${gameId}/metadata.json`;

Read({
  file_path: localPath
});
```

**Possible outcomes:**

- **Exists**: Returns local metadata.json content
- **Not exists**: File not found error

---

### Step 3: Version Comparison & Decision

**Compare versions and decide action:**

#### **Case A: Local doesn't exist**

```
📥 Downloading game from CDN...

🆔 Game ID: [gameId]
📦 CDN Version: [cdnVersion]
📍 Local Status: Not found
🎯 Action: Downloading all files from CDN

Downloading [N] files...
```

**Action:** Download all files from CDN using Bash tool with curl

#### **Case B: CDN version > Local version**

```
📥 Updating game from CDN...

🆔 Game ID: [gameId]
📦 CDN Version: [cdnVersion]
📍 Local Version: [localVersion]
🎯 Action: Local version outdated, downloading latest from CDN

Deleting local folder...
Downloading [N] files...
```

**Action:**

1. Delete local folder using Bash tool
2. Download all files from CDN using Bash tool with curl

#### **Case C: Local version >= CDN version**

```
✅ Using local game files

🆔 Game ID: [gameId]
📦 Local Version: [localVersion]
📦 CDN Version: [cdnVersion]
🎯 Action: Local version is up-to-date, using existing files

Current Phase: [current_phase]
```

**Action:** Use existing local files, no download needed

---

### Step 4: Download Files from CDN (if needed)

**Action:** Download all files listed in metadata.json

```bash
# Create game directory
GAME_DIR="games/${gameId}"
mkdir -p "${GAME_DIR}"

# Download each file from metadata.json files array
# Example files: ["/index.html", "/metadata.json", "/checklists/feedback-plan.md"]

# For each file in metadata.json.files:
for file in files:
  CDN_URL="https://cdn.mathai.ai/mathai-games/game/${gameId}${file}"
  LOCAL_PATH="${GAME_DIR}${file}"

  # Create subdirectories if needed
  mkdir -p "$(dirname ${LOCAL_PATH})"

  # Download file
  curl -f -o "${LOCAL_PATH}" "${CDN_URL}"
```

**Implementation:**

```bash
# Full download script using Bash tool
GAME_DIR="games/[gameId]"

# Delete old folder if exists and outdated
if [ -d "${GAME_DIR}" ]; then
  rm -rf "${GAME_DIR}"
fi

# Create fresh game directory
mkdir -p "${GAME_DIR}"

# Download each file
curl -f -o "${GAME_DIR}/index.html" "https://cdn.mathai.ai/mathai-games/game/[gameId]/index.html"
curl -f -o "${GAME_DIR}/metadata.json" "https://cdn.mathai.ai/mathai-games/game/[gameId]/metadata.json"

# Create checklists directory if needed
mkdir -p "${GAME_DIR}/checklists"
curl -f -o "${GAME_DIR}/checklists/feedback-plan.md" "https://cdn.mathai.ai/mathai-games/game/[gameId]/checklists/feedback-plan.md" 2>/dev/null || true

# Show completion
echo "✅ Downloaded [N] files successfully"
```

**Note:** Use `-f` flag to fail on HTTP errors, and `|| true` for optional files

---

### Step 5: Resume from Current Phase

**Action:** Read current phase and resume work

```javascript
// Read metadata to get current phase
const metadata = Read({
  file_path: `games/${gameId}/metadata.json`
});

const { current_phase, version } = JSON.parse(metadata);
```

**Show status:**

```
🆔 Game ID: [gameId]
📦 Version: [version]
🌐 Test: file://$(pwd)/games/[gameId]/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [✓] Feedback
4. [CURRENT] Registration ← Continue from here
5. [ ] Testing
```

**Resume based on phase:**

- `phase-1`: Continue with Phase 1 checklist
- `phase-2`: Continue with Phase 2 checklist
- `phase-3`: Continue with Phase 3 checklist
- `phase-4`: Continue with Phase 4 checklist
- `phase-5`: Game is complete, offer testing/modifications

---

## Complete Example Flow

### Example 1: Game doesn't exist locally, download from CDN

```
User: "Continue game game_1234567890_abc123"

Claude:
📥 Downloading game from CDN...

🆔 Game ID: game_1234567890_abc123
📦 CDN Version: 0.0.3
📍 Local Status: Not found
🎯 Action: Downloading all files from CDN

Downloading files...
✅ Downloaded 3 files successfully

✅ Game loaded successfully!

🆔 Game ID: game_1234567890_abc123
📦 Version: 0.0.3
🌐 Test: file://$(pwd)/games/game_1234567890_abc123/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [✓] Feedback
4. [CURRENT] Registration ← Continue from here
5. [ ] Testing
```

### Example 2: Local version outdated, download from CDN

```
User: "Continue game game_1234567890_abc123"

Claude:
📥 Updating game from CDN...

🆔 Game ID: game_1234567890_abc123
📦 CDN Version: 0.0.4
📍 Local Version: 0.0.2
🎯 Action: Local version outdated, downloading latest from CDN

Deleting local folder...
Downloading files...
✅ Downloaded 3 files

🆔 Game ID: game_1234567890_abc123
📦 Version: 0.0.4
🌐 Test: file://$(pwd)/games/game_1234567890_abc123/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [✓] Feedback
4. [✓] Registration
5. [CURRENT] Testing ← Continue from here
```

### Example 3: Local version up-to-date, use local files

```
User: "Continue game game_1234567890_abc123"

Claude:
✅ Using local game files

🆔 Game ID: game_1234567890_abc123
📦 Version: 0.0.3
🌐 Test: file://$(pwd)/games/game_1234567890_abc123/index.html

Current Status:
1. [✓] Core Gameplay
2. [✓] Validation
3. [✓] Feedback
4. [CURRENT] Registration ← Continue from here
5. [ ] Testing
```

---

## Error Handling

### Game not found on CDN

```
❌ Game not found: game_1234567890_abc123

The game doesn't exist on CDN. Possible reasons:
- Invalid gameId
- Game was never uploaded
- Game was deleted

Please check the gameId or start a new game.
```

### Download failed

```
❌ Download failed for: /index.html

Failed to download file from CDN. Please try again or check your internet connection.
```

### Local folder access denied

```
❌ Cannot access local folder: games/game_1234567890_abc123/

Permission denied. Please check folder permissions or choose a different location.
```

---

## Important Notes

1. **Folder naming**: Always use `gameId` as the folder name (e.g., `game_1234567890_abc123`)
2. **Version format**: Semantic versioning (e.g., `0.0.3`)
3. **File paths**: All paths in metadata.json are relative (start with `/`)
4. **CDN URL pattern**: `https://cdn.mathai.ai/mathai-games/game/{gameId}/{relativePath}`
5. **Optional files**: Use `|| true` to handle missing optional files (e.g., checklists)
6. **Always show status**: Keep user informed of actions being taken

---

## Tools Used

- `mathai-core:resource_manifest` - Fetch metadata from CDN
- `Read` - Read local metadata
- `Bash` - Download files with curl, manage directories
- `Write` - (Not needed for CDN downloads, curl writes directly)
