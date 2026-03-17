# Using mathai-game-builder in Claude Code

This guide explains how to use the mathai-game-builder skill in **Claude Code** instead of Claude Desktop.

## Key Differences

| Aspect | Claude Desktop | Claude Code |
|--------|---------------|-------------|
| **File Operations** | Filesystem MCP server | Native tools (Read, Write, Edit, Glob, Grep) |
| **Tool Prefix** | `filesystem:` | No prefix (direct tool names) |
| **MCP Servers** | Configured in `claude_desktop_config.json` | Not used for file operations |
| **Skill Loading** | Skills directory | Load SKILL.md directly |
| **Working Directory** | Must use allowed directories | Current git repo directory |

## File Operation Tool Replacements

### Filesystem MCP → Claude Code Native Tools

| Filesystem MCP Tool | Claude Code Equivalent | Notes |
|---------------------|------------------------|-------|
| `filesystem:read_text_file(path)` | `Read(file_path)` | Native Read tool |
| `filesystem:write_file(path, content)` | `Write(file_path, content)` | Native Write tool |
| `filesystem:edit_file(path, edits[])` | `Edit(file_path, old_string, new_string)` | Native Edit tool |
| `filesystem:create_directory(path)` | `Bash("mkdir -p path")` | Use bash command |
| `filesystem:list_allowed_directories()` | N/A - Use current directory | Not needed in Claude Code |

### Example Conversions

**Reading a file:**
```javascript
// Claude Desktop (Filesystem MCP)
filesystem:read_text_file({
  path: "/Users/username/Documents/claude/game-123/index.html"
})

// Claude Code (Native Read tool)
Read({
  file_path: "/Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123/index.html"
})
```

**Writing a file:**
```javascript
// Claude Desktop (Filesystem MCP)
filesystem:write_file({
  path: "/Users/username/Documents/claude/game-123/index.html",
  content: "<!DOCTYPE html>..."
})

// Claude Code (Native Write tool)
Write({
  file_path: "/Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123/index.html",
  content: "<!DOCTYPE html>..."
})
```

**Editing a file:**
```javascript
// Claude Desktop (Filesystem MCP)
filesystem:edit_file({
  path: "/Users/username/Documents/claude/game-123/index.html",
  edits: [{
    oldText: "// TODO: Add validation",
    newText: "function validateAnswer() { ... }"
  }]
})

// Claude Code (Native Edit tool)
Edit({
  file_path: "/Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123/index.html",
  old_string: "// TODO: Add validation",
  new_string: "function validateAnswer() { ... }"
})
```

**Creating a directory:**
```javascript
// Claude Desktop (Filesystem MCP)
filesystem:create_directory({
  path: "/Users/username/Documents/claude/game-123"
})

// Claude Code (Bash command)
Bash({
  command: "mkdir -p /Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123"
})
```

## Setup Instructions

### 1. Working Directory Setup

Claude Code works from the current git repository. Create a games directory:

```bash
cd /Users/the-hw-app/skills/mathai/mathai-game-builder
mkdir -p games
```

### 2. Load the Skill

In Claude Code, load the skill by reading SKILL.md:

```
Hey Claude, please read /Users/the-hw-app/skills/mathai/mathai-game-builder/SKILL.md and help me build a math game.
```

### 3. Game Storage Location

**Claude Desktop:**
```
/Users/username/Documents/claude/
  └─ {gameId}/
      ├─ index.html
      ├─ metadata.json
      └─ checklists/
```

**Claude Code:**
```
/Users/the-hw-app/skills/mathai/mathai-game-builder/games/
  └─ {gameId}/
      ├─ index.html
      ├─ metadata.json
      └─ checklists/
```

### 4. MCP Servers Still Required

While **filesystem MCP is NOT needed**, the following MCPs are still required:

**mathai-core MCP:**
- `register_game` - Game registration
- `create_content_set` - Content creation
- `upload_game_folder` - CDN uploads
- `resource_manifest` - Fetch game metadata

**mathai-feedback MCP:**
- `search_feedback` - Search feedback library
- `create_feedback` - Create new feedback

These must be configured in Claude Code's MCP settings.

## Workflow Adaptations

### Phase 1: Core Gameplay

**Change Required:** Directory creation and file paths

```javascript
// OLD (Claude Desktop)
filesystem:list_allowed_directories() // Get allowed directories
filesystem:create_directory({ path: "/Users/username/Documents/claude/game-123" })
filesystem:write_file({ path: "/Users/username/Documents/claude/game-123/index.html", ... })

// NEW (Claude Code)
// No need for list_allowed_directories - use working directory
Bash({ command: "mkdir -p games/game-123" })
Write({ file_path: "games/game-123/index.html", ... })
```

**Note:** Use relative paths from skill repository root.

### Phase 2: Validation

**Change Required:** File editing

```javascript
// OLD (Claude Desktop)
filesystem:read_text_file({ path: "/Users/username/Documents/claude/game-123/index.html" })
filesystem:edit_file({ path: "...", edits: [...] })

// NEW (Claude Code)
Read({ file_path: "games/game-123/index.html" })
Edit({ file_path: "games/game-123/index.html", old_string: "...", new_string: "..." })
```

### Phase 3: Feedback

**Change Required:** File operations + MCP calls

```javascript
// File operations use Claude Code native tools
Read({ file_path: "games/game-123/index.html" })
Edit({ file_path: "games/game-123/index.html", ... })

// MCP calls stay the same
mathai-feedback:search_feedback({ category: "encouragement", ... })
```

### Phase 4: Registration

**Change Required:** File path references

```javascript
// OLD (Claude Desktop)
mathai-core:register_game({
  gameArtifactPath: "/Users/username/Documents/claude/game-123/index.html",
  ...
})

// NEW (Claude Code)
mathai-core:register_game({
  gameArtifactPath: "/Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123/index.html",
  ...
})
```

### Phase 5: Testing

**Testing URL:**
```
file:///Users/the-hw-app/skills/mathai/mathai-game-builder/games/game-123/index.html
```

## Common Patterns

### Path Resolution

**Always use absolute paths for MCP tools:**
```javascript
const absolutePath = `/Users/the-hw-app/skills/mathai/mathai-game-builder/games/${gameId}/index.html`;

mathai-core:upload_game_folder({
  gameId: gameId,
  files: [{
    filePath: absolutePath,
    targetPath: "index.html"
  }]
})
```

**Use relative paths for Claude Code native tools:**
```javascript
Read({ file_path: `games/${gameId}/index.html` })
Write({ file_path: `games/${gameId}/metadata.json`, content: ... })
Edit({ file_path: `games/${gameId}/index.html`, ... })
```

### Directory Creation

```javascript
// Create game directory
Bash({ command: `mkdir -p games/${gameId}/checklists` })

// Verify creation
Bash({ command: `ls -la games/${gameId}` })
```

### File Existence Check

```javascript
// Check if file exists
Bash({ command: `test -f games/${gameId}/index.html && echo "exists" || echo "missing"` })
```

## Checklist Storage

**Claude Desktop:**
```
/Users/username/Documents/claude/{gameId}/checklists/phase-1-checklists.md
```

**Claude Code:**
```
/Users/the-hw-app/skills/mathai/mathai-game-builder/games/{gameId}/checklists/phase-1-checklists.md
```

**Creating checklist directory:**
```javascript
Bash({ command: `mkdir -p games/${gameId}/checklists` })

Write({
  file_path: `games/${gameId}/checklists/phase-1-checklists.md`,
  content: "# Phase 1 Checklists\n\n..."
})
```

## CDN Uploads

**No changes needed** - CDN uploads use mathai-core MCP which works the same in both:

```javascript
mathai-core:upload_game_folder({
  gameId: gameId,
  files: [
    {
      filePath: `/Users/the-hw-app/skills/mathai/mathai-game-builder/games/${gameId}/index.html`,
      targetPath: "index.html"
    },
    {
      filePath: `/Users/the-hw-app/skills/mathai/mathai-game-builder/games/${gameId}/metadata.json`,
      targetPath: "metadata.json"
    }
  ]
})
```

## Game Resumption

**Fetch from CDN (same in both):**
```javascript
const cdnMetadata = mathai-core:resource_manifest({
  gameId: gameId
})
```

**Download to local (different paths):**
```javascript
// Claude Desktop
curl -f -o "/Users/username/Documents/claude/${gameId}/index.html" \
  "https://cdn.mathai.ai/mathai-games/game/${gameId}/index.html"

// Claude Code
curl -f -o "games/${gameId}/index.html" \
  "https://cdn.mathai.ai/mathai-games/game/${gameId}/index.html"
```

## Benefits of Claude Code

1. **No MCP Setup for Files** - Native file tools work out of the box
2. **Better Performance** - Direct file access without MCP overhead
3. **Simpler Paths** - Use relative paths from repo root
4. **Version Control** - Games stored in git-tracked directory
5. **Better Integration** - Works with existing Claude Code workflows

## Limitations

1. **MCP Servers Still Required** - mathai-core and mathai-feedback must be configured
2. **Different Paths** - Games stored in different location than Claude Desktop
3. **Tool Syntax** - Must adapt from `filesystem:` prefix to native tools

## Quick Reference Card

### File Operations
```javascript
// Read
Read({ file_path: "games/game-123/index.html" })

// Write
Write({ file_path: "games/game-123/index.html", content: "..." })

// Edit
Edit({ file_path: "games/game-123/index.html", old_string: "...", new_string: "..." })

// Create directory
Bash({ command: "mkdir -p games/game-123/checklists" })

// List files
Bash({ command: "ls -la games/game-123" })
```

### MCP Operations (Same in Both)
```javascript
// Register game
mathai-core:register_game({
  gameArtifactPath: "/absolute/path/to/index.html",
  metadata: { ... }
})

// Search feedback
mathai-feedback:search_feedback({
  category: "encouragement",
  query: "Great job!"
})

// Upload to CDN
mathai-core:upload_game_folder({
  gameId: gameId,
  files: [{ filePath: "/absolute/path", targetPath: "..." }]
})
```

## Migration Checklist

When adapting skill workflows for Claude Code:

```
File Operations:
[ ] Replace filesystem:read_text_file → Read
[ ] Replace filesystem:write_file → Write
[ ] Replace filesystem:edit_file → Edit
[ ] Replace filesystem:create_directory → mkdir -p
[ ] Remove filesystem:list_allowed_directories calls

Path Updates:
[ ] Change base directory from /Users/username/Documents/claude → games/
[ ] Use relative paths for Claude Code tools
[ ] Use absolute paths for MCP tools
[ ] Update test URLs to new file:// paths

Workflow Verification:
[ ] Phase 1: Directory creation works
[ ] Phase 2: File editing works
[ ] Phase 3: Feedback integration works
[ ] Phase 4: Registration with correct paths
[ ] Phase 5: Testing URL accessible
[ ] CDN uploads work with absolute paths
```

## Example: Complete Phase 1 in Claude Code

```javascript
// Step 1: No need to list_allowed_directories

// Step 2: Generate game ID and create directory
const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
Bash({ command: `mkdir -p games/${gameId}` })

// Step 3: Create index.html
Write({
  file_path: `games/${gameId}/index.html`,
  content: `<!DOCTYPE html>...`
})

// Create metadata.json
Write({
  file_path: `games/${gameId}/metadata.json`,
  content: JSON.stringify({
    game_id: gameId,
    version: "0.0.1",
    current_phase: "phase-1",
    files: ["/index.html", "/metadata.json"]
  }, null, 2)
})

// Upload to CDN (use absolute path)
const absolutePath = `/Users/the-hw-app/skills/mathai/mathai-game-builder/games/${gameId}`;
mathai-core:upload_game_folder({
  gameId: gameId,
  files: [
    { filePath: `${absolutePath}/index.html`, targetPath: "index.html" },
    { filePath: `${absolutePath}/metadata.json`, targetPath: "metadata.json" }
  ]
})
```

## Troubleshooting

### "File not found" errors
- Use `pwd` to check current directory
- Ensure using relative paths for Claude Code tools
- Use absolute paths for MCP tools

### "Permission denied" errors
- Check directory exists: `ls -la games/`
- Create with mkdir: `mkdir -p games/game-123`

### MCP tools not working
- Verify MCPs configured in Claude Code settings
- Check MCP server logs
- Ensure using correct tool names (mathai-core:, mathai-feedback:)

## Summary

**Key Changes for Claude Code:**
1. ✅ No filesystem MCP needed
2. ✅ Use native Read/Write/Edit tools
3. ✅ Use relative paths from repo root
4. ✅ Store games in `games/` directory
5. ✅ MCP tools (mathai-core, mathai-feedback) still required
6. ✅ Same CDN workflow, different local paths

**What Stays the Same:**
- Game structure (metadata.json, checklists, etc.)
- MCP tool usage (register_game, search_feedback, etc.)
- CDN upload workflow
- Phase workflows (just different file tools)
- Testing in browser (different file:// path)
