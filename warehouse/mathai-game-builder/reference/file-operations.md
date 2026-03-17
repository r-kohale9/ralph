# File Operations

This skill uses Claude Code native tools for all file operations.

## Reading Files

```javascript
Read({ file_path: "games/game-123/index.html" })
```

Returns file contents as string. Supports line offset and limit for large files.

## Writing Files

```javascript
Write({
  file_path: "games/game-123/index.html",
  content: "<!DOCTYPE html>..."
})
```

Creates new file or overwrites existing. Creates parent directories if needed.

## Editing Files

```javascript
// Single edit (first occurrence)
Edit({
  file_path: "games/game-123/index.html",
  old_string: "const timer = 60;",
  new_string: "const timer = 90;"
})

// Replace all occurrences
Edit({
  file_path: "games/game-123/checklists/phase-1-checklist.md",
  old_string: "[✅]",
  new_string: "[ ]",
  replace_all: true
})
```

**Important**: `old_string` must be unique unless using `replace_all: true`.

## Directory Operations

```javascript
// Create directories
Bash({
  command: "mkdir -p games/game-123/checklists",
  description: "Create game directory structure"
})

// List files
Glob({ pattern: "games/game-123/**/*" })

// Find files
Bash({ command: "find games/game-123 -type f" })

// Get file info
Bash({ command: "ls -la games/game-123/index.html" })
```

## Path Patterns

**All file operations use relative paths from skill root:**

✅ **Correct:**
```javascript
Read({ file_path: "games/game-123/index.html" })
Write({ file_path: "games/game-123/metadata.json", content: "{}" })
Edit({ file_path: "games/game-123/index.html", ... })
```

❌ **Incorrect:**
```javascript
Read({ file_path: "/Users/username/Documents/claude/game-123/index.html" })
```

**Exception**: MCP tools (mathai-core) require absolute paths:

```bash
# Get absolute path
GAME_DIR=$(pwd)/games/game-123

# Use in MCP tool
mathai-core:upload_game_folder({
  gameId: "game-123",
  files: [
    { filePath: "${GAME_DIR}/index.html", targetPath: "index.html" }
  ]
})
```

## Best Practices

1. **Always use relative paths** (from skill root: `games/...`)
2. **Use Write for new files**, Edit for modifications
3. **Use Bash for shell operations** (mkdir, curl, find, etc.)
4. **Create parent directories first** (`mkdir -p`)
5. **Resolve to absolute only for MCP tools** (using `pwd`)

## Common Patterns

**Phase 1 - Create game:**
```javascript
Bash("mkdir -p games/game-123/checklists")
Write("games/game-123/index.html", htmlContent)
Write("games/game-123/metadata.json", metadataJson)
Write("games/game-123/checklists/phase-1-checklist.md", checklistContent)
```

**Phase 2-5 - Update game:**
```javascript
const html = Read("games/game-123/index.html")
Edit("games/game-123/index.html", oldCode, newCode)
Edit("games/game-123/metadata.json", oldVersion, newVersion)
```

**Reset checklists:**
```javascript
Edit({
  file_path: "games/game-123/checklists/phase-1-checklist.md",
  old_string: "[✅]",
  new_string: "[ ]",
  replace_all: true
})
```

**Download from CDN:**
```bash
Bash("curl -f https://cdn.mathai.ai/mathai-games/game/game-123/index.html -o /tmp/game.html")
const content = Read("/tmp/game.html")
Write("games/game-123/index.html", content)
```

## Related Documentation

- [Phase 1: Core Gameplay](../workflows/phase-1-core-gameplay.md)
- [Phase 2: Input Evaluation & Validation](../workflows/phase-2-validation.md)
- [SKILL.md - File System Operations](../SKILL.md)
