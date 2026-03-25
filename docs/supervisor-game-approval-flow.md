# Supervisor Game Approval Flow
**For use in Claude Desktop**

---

## Overview

A 3-step flow for approving new game specs before they enter the Ralph build pipeline.

```
Clarification -> Visualization -> Register Spec
```

The supervisor runs this entirely inside **Claude Desktop**. Once a spec is registered it is live in the warehouse and ready to queue for a build.

---

## Prerequisites

Claude Desktop must have the Ralph MCP server connected. Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`.

Two headers are required:
- **`Authorization: Bearer <token>`** — authenticates you to the Ralph MCP endpoint. The token is shared by the team (stored in `/opt/ralph/.env` as `MCP_SECRET`).
- **`X-Ralph-Notify-User: <slack-user-id>`** — tells Ralph which Slack user to notify for approvals and build updates. To find your Slack user ID: go to your Slack profile → click the three-dot menu → "Copy member ID".

Each team member gets their own config file in `configs/claude-desktop/` in this repo (gitignored). Copy the relevant file to `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Mithilesh (U0242GULG48):**
```json
{
  "mcpServers": {
    "ralph": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://34.93.153.206/mcp",
        "--allow-http",
        "--header",
        "Authorization: Bearer a71e5bfbd4f681455ad98d7bf1df7826466db8567b7eb7879b5351c451f35b0a",
        "--header",
        "X-Ralph-Notify-User: U0242GULG48"
      ]
    }
  }
}
```

**Sammit (U06KHJU96Q4):**
```json
{
  "mcpServers": {
    "ralph": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://34.93.153.206/mcp",
        "--allow-http",
        "--header",
        "Authorization: Bearer a71e5bfbd4f681455ad98d7bf1df7826466db8567b7eb7879b5351c451f35b0a",
        "--header",
        "X-Ralph-Notify-User: U06KHJU96Q4"
      ]
    }
  }
}
```

**Harshvardhan (UBWLNMXJA):**
```json
{
  "mcpServers": {
    "ralph": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://34.93.153.206/mcp",
        "--allow-http",
        "--header",
        "Authorization: Bearer a71e5bfbd4f681455ad98d7bf1df7826466db8567b7eb7879b5351c451f35b0a",
        "--header",
        "X-Ralph-Notify-User: UBWLNMXJA"
      ]
    }
  }
}
```

**Rishabh (U02EVUX8A4Q):**
```json
{
  "mcpServers": {
    "ralph": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://34.93.153.206/mcp",
        "--allow-http",
        "--header",
        "Authorization: Bearer a71e5bfbd4f681455ad98d7bf1df7826466db8567b7eb7879b5351c451f35b0a",
        "--header",
        "X-Ralph-Notify-User: U02EVUX8A4Q"
      ]
    }
  }
}
```

> **Slack user ID:** Go to your Slack profile → click the three-dot menu (⋯) → "Copy member ID".

After saving, quit Claude Desktop (Cmd+Q) and reopen it.

---

## Step 1 -- Game Clarification

**What the supervisor does:** Describe the game idea in plain language.

**Prompt to use:**
```
I want to create a new math game. Here is my idea:

[Describe the game -- topic, grade level, what students do,
how they win/lose, how many rounds]
```

**What Claude does:**
1. Asks up to 5 clarifying questions (one at a time):
   - What grade / curriculum level?
   - What is the specific learning objective? (e.g. "recognise acute vs obtuse angles")
   - How many rounds / questions per game?
   - Lives system or time-based?
   - Any example questions or round data?
2. Looks up the matching curriculum standard via the Knowledge Graph MCP
3. Produces a structured spec draft for review

**Output:** A draft spec the supervisor can read and correct before moving to Step 2.

---

## Step 2 -- Visualization

**What the supervisor does:** Ask Claude to show a preview.

**Prompt to use:**
```
Show me a visual preview of this game.
```

**What Claude does:**
1. Generates a minimal interactive HTML prototype (rendered as an Artifact)
2. The prototype includes:
   - Start screen with the game title and "Let's go!" button
   - One sample round (using example data from Step 1)
   - Answer buttons or input that respond to clicks
   - A simple results screen
3. Supervisor can interact with it directly in the Artifact pane

**What to check:**
- [ ] Does the interaction feel right? (tap to answer, drag, fill in blank, etc.)
- [ ] Is the round structure correct? (number of options, number of rounds)
- [ ] Is the difficulty appropriate for the target grade?
- [ ] Are the example questions representative?

**To revise:** Tell Claude what to change -- it updates the preview in place.

---

## Step 3 -- Register Spec

**What the supervisor does:** Approve the spec and register it.

**Prompt to use:**
```
This looks good. Register the spec for [gameId].
```

**What Claude does:**
1. Calls `register_spec` MCP tool -- writes final spec to `warehouse/templates/<gameId>/spec.md` on the Ralph server
2. Returns a confirmation with the spec path

The spec is now live in the warehouse and can be queued for a build.

---

## Example: Two Games

### Game A -- Adjustment Strategy

**Clarification prompt:**
```
A mental addition game. Two numbers are shown with +/- buttons.
Students adjust the numbers to make addition easier (e.g. 47+33
becomes 50+30), then type the sum. 9 rounds, 3 lives, 3 difficulty
levels. Grade 5-6.
```

**Expected spec output:** `warehouse/templates/adjustment-strategy/spec.md`

> Real example: live at `games/adjustment-strategy/`.

---

### Game B -- Addition MCQ Blitz

**Clarification prompt:**
```
A multiple-choice addition quiz. Students see an addition problem
and pick the correct answer from 4 options. 30-second countdown
per question, 3 lives, 10 questions per session. Grade 3-4.
```

**Expected spec output:** `warehouse/templates/addition-mcq/spec.md`

> Real example: live at `games/addition-mcq/`.

---

## Flow Summary

| Step | Action | Tool used | Output |
|------|--------|-----------|--------|
| 1. Clarify | Describe game idea | Knowledge Graph MCP | Draft spec |
| 2. Visualize | Ask for preview | Claude Artifacts | Interactive HTML prototype |
| 3. Register | Approve + register | `register_spec` MCP tool | Spec file in warehouse |

---

## MCP Tools Required

| Tool | Description | Status |
|------|-------------|--------|
| `list_games` | List all games with status | live |
| `get_spec` | Read a game's current spec | live |
| `register_spec` | Write spec to warehouse | live |
| `queue_build` | Queue a build for a gameId | live |
| `plan_session` | Plan a full session from a teaching objective | live |

---

## Notes for Supervisor

- **You can correct at any step** -- if the spec draft is wrong, just say what to fix. Claude will update and re-show.
- **Visualization is a sketch, not the final game** -- the actual Ralph build will produce a fully polished version following all CDN rules and the complete spec.
- **Register spec is the final step** -- once registered, the spec is ready to queue for a build via `queue_build`.
