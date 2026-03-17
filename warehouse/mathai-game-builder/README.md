# mathai-game-builder

Educational math game builder skill for Claude Code.

Build interactive math games with validation, feedback, and deployment to CDN - all through conversational AI.

## Features

- 🎮 **Interactive Games** - Drag-and-drop, multiple choice, input-based
- ✅ **Smart Validation** - Automatic answer checking and feedback
- 🎯 **Rich Feedback** - Audio, animations, stickers from MathAI library
- 🌐 **CDN Deployment** - Automatic upload and hosting
- 📝 **Checklist Tracking** - Progress tracking across sessions
- 🔄 **Game Resumption** - Continue from where you left off

## Quick Start

### 1. Clone Repository

```bash
git clone <repo-url>
cd mathai-game-builder
```

### 2. Configure MCP Servers

```bash
# Copy example configuration
cp .mcp.json.example .mcp.json

# Edit and add your USER_SECRET
nano .mcp.json
```

See [MCP Server Setup Guide](reference/mcp-server-setup.md) for detailed instructions.

### 3. Open in Claude Code

```bash
claude-code .
```

Or from Claude Code: File → Open Folder → Select `mathai-game-builder`

### 4. Build Your First Game

In Claude Code chat:

```
I want to build a multiplication game for grade 3 students
```

Follow the 5-phase workflow:
1. **Core Gameplay** - Build game mechanics
2. **Validation** - Add answer checking
3. **Feedback** - Integrate audio/animations
4. **Registration** - Deploy to platform
5. **Testing** - Verify functionality

## Usage

### Starting a New Game

```
Build a [topic] game for grade [N]
```

Example:
```
Build a fractions game for grade 4
```

### Resuming an Existing Game

```
Continue working on game_1234567890_abc
```

### Making Changes

```
Change the timer to 90 seconds
Add a difficulty selector
Update the instructions
```

## Documentation

- **[SKILL.md](SKILL.md)** - Main skill documentation and workflow
- **[Setup Guide](reference/mcp-server-setup.md)** - MCP server configuration
- **[Workflows](workflows/)** - Detailed phase-by-phase instructions
- **[Components](components/)** - API reference for MathAI components
- **[Examples](examples/)** - Code patterns and examples

## Generated Files

Games are created in the `games/` directory:

```
games/
  └─ game_1234567890_abc/
      ├─ index.html           # Your game
      ├─ metadata.json        # Game metadata
      └─ checklists/          # Progress tracking
```

## Requirements

- **Claude Code** (latest version)
- **Node.js** and **npm** (for MCP servers)
- **USER_SECRET** (contact admin)

## Support

- **Documentation**: See [SKILL.md](SKILL.md)
- **Issues**: [GitHub Issues](link-to-issues)
- **Contact**: [Your contact]

## License

[Your license]
