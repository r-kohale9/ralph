# MCP Server Setup

This skill requires two MCP servers to function:

1. **mathai-core** - Game registration, CDN uploads, content management
2. **mathai-feedback** - Feedback library search, audio generation

## Quick Setup

### Step 1: Create Configuration File

Create `.mcp.json` in the skill root directory:

```json
{
  "mcpServers": {
    "mathai-core": {
      "command": "npx",
      "args": ["-y", "@beingtmk/core-mcp"],
      "env": {
        "USER_SECRET": "your-secret-here"
      }
    },
    "mathai-feedback": {
      "command": "npx",
      "args": ["-y", "@beingtmk/feedback-mcp"],
      "env": {
        "USER_SECRET": "your-secret-here"
      }
    }
  }
}
```

### Step 2: Get Your USER_SECRET

Contact your MathAI administrator or team lead to obtain your USER_SECRET.

**Do not share your USER_SECRET** - it's unique to you.

### Step 3: Update Configuration

Replace `"your-secret-here"` in `.mcp.json` with your actual USER_SECRET.

### Step 4: Restart Claude Code

Close and reopen Claude Code to load the MCP servers.

## Verification

### Check Server Status

1. Open Claude Code settings (Cmd/Ctrl + ,)
2. Navigate to "MCP Servers" section
3. Verify both servers appear and show "Connected" status

### Test MCP Tools

In Claude Code chat:

```
Test mathai-core connection: mathai-core:list_games()
```

Should return list of games (or empty array if none exist).

## Alternative: User-Level Configuration

Instead of project-level (`.mcp.json`), you can configure globally in Claude Code settings.

**Advantage**: Available across all projects
**Disadvantage**: Must configure manually (not in repo)

## Troubleshooting

### Server Not Found

**Symptom**: "MCP server 'mathai-core' not found"

**Solutions**:
1. Verify `.mcp.json` exists in skill root directory
2. Check JSON syntax is valid
3. Restart Claude Code
4. Verify NPM package accessible: `npx -y @beingtmk/core-mcp --version`

### Authentication Failed

**Symptom**: "Authentication failed" or "Invalid USER_SECRET"

**Solutions**:
1. Verify USER_SECRET is correct (no extra spaces/quotes)
2. Contact admin for new USER_SECRET
3. Check USER_SECRET hasn't expired

### Tools Not Working

**Symptom**: "Tool 'register_game' not available"

**Solutions**:
1. Check MCP server status in settings
2. Restart Claude Code
3. Check console for errors (Help → Toggle Developer Tools)
4. Verify network connection (MCP servers need internet)

### NPM Package Issues

**Symptom**: "Package '@beingtmk/core-mcp' not found"

**Solutions**:
1. Check internet connection
2. Clear NPM cache: `npm cache clean --force`
3. Try manual install: `npm install -g @beingtmk/core-mcp`

## Security Notes

- **Never commit `.mcp.json` with real USER_SECRET to git**
- Add `.mcp.json` to `.gitignore`
- Use `.mcp.json.example` with placeholder for sharing
- Rotate USER_SECRET if compromised

## MCP Server Capabilities

### mathai-core Tools

- `register_game` - Register game in MathAI platform
- `create_content_set` - Create content sets for games
- `upload_game_folder` - Upload game files to CDN
- `resource_manifest` - Fetch game metadata from CDN
- `validate_content` - Validate content against schema
- `list_games` - Browse registered games

### mathai-feedback Tools

- `search_feedback` - Search feedback library by category/emotion
- `create_feedback` - Create custom feedback
- `generate_dynamic_audio` - Generate runtime audio from text
- `update_feedback_subtitle` - Update feedback subtitles
- `update_feedback_sticker` - Update feedback stickers
- `get_categories` - List available feedback categories

## Getting Help

For MCP server access or issues:
- Contact: [Your team/admin contact]
- Documentation: [MathAI internal docs]
- Slack: [Your slack channel]
