# Spec Creation Workflow

How to build game specs using Claude Desktop + Ralph MCP.

---

## Overview

Building a game is a two-stage process:

```
Stage 1: User idea + Warehouse knowledge → Game spec (assembly book)
Stage 2: Game spec → Ralph pipeline → Tested HTML game
```

**Stage 1** happens in Claude Desktop with the help of warehouse MCP tools.
**Stage 2** is fully automated by the Ralph pipeline.

---

## Prerequisites

1. **Claude Desktop** with Ralph MCP configured:

```json
{
  "mcpServers": {
    "ralph": {
      "type": "streamableHttp",
      "url": "http://YOUR_SERVER_IP/mcp"
    }
  }
}
```

2. **Ralph server** running with the warehouse directory deployed.

---

## Step-by-Step Workflow

### Step 1: Describe the Game

Tell Claude what you want. Be specific about:

- **Game concept** — What does the player do?
- **Input method** — Tap, drag, type, or a combination?
- **Rounds** — How many? Do they increase in difficulty?
- **Timer** — Is there time pressure? Countdown or count-up?
- **Validation** — How are answers checked? Exact match, rule-based, or open-ended?
- **Win/lose conditions** — Stars? Lives? Score thresholds?
- **Visual style** — Grid layout? Cards? Number line? Free-form?

**Example prompt:**

> Build me a "Number Bonds" game. The player sees a target number (e.g. 10) and two parts, one is filled in and the other is blank. The player types the missing number. 8 rounds, no timer, fixed validation (exact match). 3 stars if all correct, 2 stars if 6+ correct, 1 star otherwise. Simple clean layout with the target number prominent at the top.

If your description is ambiguous, Claude should ask clarifying questions before proceeding.

### Step 2: Claude Reads the Warehouse

Claude calls the Ralph MCP tools in this order:

1. **`get_warehouse_guide`** — Returns the SPEC.md router, capability matrix, and rules list. This tells Claude how the warehouse works and which parts exist.

2. **`list_warehouse_parts`** — Shows all 37 parts with their categories (MANDATORY / CONDITIONAL / EXTENSION / POST_GEN).

3. **Part selection** — Based on your game description, Claude maps features to parts using the capability matrix:

   | Your Feature | Capability Key | Parts Added |
   |---|---|---|
   | Every game | `any_game` | 17 mandatory parts |
   | Timer | `has_timer` | PART-006 |
   | Stories/narrative | `has_stories` | PART-016 |
   | Exact answer check | `has_fixed_validation` | PART-013 |
   | Rule-based check | `has_function_validation` | PART-014 |
   | Open-ended/LLM check | `has_llm_validation` | PART-015 |
   | Progress bar | `has_progress_bar` | PART-023, PART-025 |
   | Start/victory screens | `has_transition_screen` | PART-024, PART-025 |
   | Drag and drop | `has_drag_drop` | PART-033 |
   | Grid interaction | `has_grid_interaction` | PART-033 |

4. **`read_warehouse_part`** — Claude reads each selected part to get the exact code blocks, rules, and anti-patterns. Only selected parts are loaded (keeps context small).

5. **`read_warehouse_rule`** — Claude reads all 7 universal rules:

   | Rule | Name | Severity |
   |------|------|----------|
   | RULE-001 | Global Scope for HTML Handlers | CRITICAL |
   | RULE-002 | Async/Await | CRITICAL |
   | RULE-003 | Error Handling | CRITICAL |
   | RULE-004 | Structured Logging | REQUIRED |
   | RULE-005 | Cleanup on End | REQUIRED |
   | RULE-006 | No Custom Implementations | CRITICAL |
   | RULE-007 | Single File Architecture | REQUIRED |

### Step 3: Claude Generates the Spec

Claude writes a complete spec (assembly book) following the template-schema format. The spec has **15 required sections**:

| # | Section | What It Contains |
|---|---------|-----------------|
| 1 | Game Identity | Title, ID, type, description |
| 2 | Parts Selected | Table of all parts with YES/NO and config |
| 3 | Game State | Exact `gameState` object with all fields |
| 4 | Input Schema | JSON Schema for content + fallback test data (3+ rounds) |
| 5 | Screens & HTML | Exact HTML for each screen with element IDs |
| 6 | CSS | Complete styles for all screens and states |
| 7 | Game Flow | Step-by-step from page load to game end |
| 8 | Functions | Every function with signatures and logic |
| 9 | Event Schema | Which events fire when |
| 10 | Scaffold Points | Where learning scaffolds can be injected |
| 11 | Feedback Triggers | Audio/visual feedback moments |
| 12 | Visual Specifications | Colors, typography, spacing, responsive |
| 14 | Test Scenarios | Exact Playwright test scenarios with real selectors |
| 15 | Verification Checklist | Structural + functional + design + rules checks |

**Key principles:**

- **Be explicit.** Every function, every element ID, every CSS property. Leave zero decisions for the HTML generation stage.
- **Copy code from parts.** Don't paraphrase — use the exact code blocks from part files with game-specific values filled in.
- **Include test content.** Fallback content must have 3+ rounds of realistic data so the game works standalone.
- **Test scenarios must use real selectors.** Not "click the correct cell" but `click .grid-cell[data-row='0'][data-col='2']`.

### Step 4: Review the Spec

Before submitting, verify:

- [ ] All 15 sections are present
- [ ] Parts Selected table matches the game's actual features
- [ ] Game State has all mandatory fields from PART-007 plus game-specific fields
- [ ] Input Schema has a valid JSON Schema with 3+ rounds of fallback data
- [ ] Functions section includes setupGame, handleAnswer, nextRound, endGame, showResults
- [ ] Test scenarios have exact selectors and exact assertions (not vague descriptions)
- [ ] Verification checklist covers all selected parts
- [ ] No anti-patterns from PART-026

### Step 5: Submit to Ralph

Claude calls `register_spec` with the complete spec:

```
register_spec({
  game_id: "number-bonds",
  title: "Number Bonds",
  description: "Find the missing part to make a target number",
  spec_content: "<full markdown spec>"
})
```

Ralph responds with a build ID and queues the build.

### Step 6: Monitor the Build

Claude calls `get_build_status` to track progress:

```
get_build_status({ game_id: "number-bonds" })
```

The build goes through these stages:

```
queued → running → [generate HTML] → [static validation] → [contract validation]
  → [generate tests] → [test/fix loop x5] → [review] → APPROVED or FAILED
```

**Build timeline:** Typically 8-15 minutes depending on complexity and fix iterations.

**Possible outcomes:**

| Status | Meaning | Next Step |
|--------|---------|-----------|
| APPROVED | HTML passes all tests and review | Game is ready, GCP URL available |
| FAILED | Tests didn't pass after 5 iterations | Check test_results, refine spec, rebuild |
| REJECTED | Review found spec compliance issues | Check review_result, fix spec, rebuild |

### Step 7: Iterate if Needed

If the build fails, check the `test_results` and `error_message` fields. Common issues:

| Issue | Fix |
|-------|-----|
| Static validation failed | Spec may be missing `id="gameContent"` or package scripts |
| Tests 0 passed / 0 failed | Playwright can't run — check server has browsers installed |
| Tests fail on selectors | Test scenarios in spec used wrong selectors — update Section 14 |
| Fix loop produces empty responses | Simplify the spec or break into smaller pieces |
| Contract validation warnings | Missing gameState fields or postMessage protocol issues |

To rebuild with a refined spec, call `register_spec` again with the same `game_id`.

---

## Quick Reference: MCP Tools

### Warehouse Knowledge Tools

| Tool | When to Use |
|------|-------------|
| `get_warehouse_guide` | First call — get the routing guide and capability matrix |
| `list_warehouse_parts` | See all available parts |
| `read_warehouse_part` | Read a specific part's code and rules |
| `read_warehouse_rule` | Read a specific universal rule |

### Build Tools

| Tool | When to Use |
|------|-------------|
| `register_spec` | Submit a spec and start a build |
| `get_build_status` | Check build progress or results |
| `list_games` | See all registered games |

### Learning Tools

| Tool | When to Use |
|------|-------------|
| `add_learning` | Record an insight from a build |
| `get_learnings` | Retrieve accumulated learnings |

---

## MCP Resources (Advanced)

For direct access to warehouse files, these resources are available:

| Resource URI | Content |
|---|---|
| `warehouse://spec` | SPEC.md — the main router |
| `warehouse://parts/manifest` | Parts manifest with capability matrix |
| `warehouse://templates/template-schema` | Assembly book format |
| `warehouse://rules/manifest` | Rules manifest |
| `warehouse://templates/adjustment-strategy/spec` | Example complete spec |
| `warehouse://parts/{partId}` | Individual part (e.g. `PART-006-timer`) |
| `warehouse://rules/{ruleId}` | Individual rule (e.g. `RULE-001-global-scope`) |
| `warehouse://contracts/{name}` | Contract schema (e.g. `game-state`) |

---

## Example: Full Conversation Flow

```
User: Build me a multiplication grid game. 3x3 grid, player taps cells
       to select factors that multiply to a target. 6 rounds, 60-second
       countdown timer, function-based validation. Progress bar showing
       rounds completed.

Claude: [calls get_warehouse_guide]
        [calls list_warehouse_parts]
        [calls read_warehouse_part("PART-006-timer")]
        [calls read_warehouse_part("PART-014-validation-function")]
        [calls read_warehouse_part("PART-023-progress-bar")]
        [calls read_warehouse_part("PART-025-screen-layout-component")]
        [calls read_warehouse_part("PART-033-interaction-patterns")]
        [calls read_warehouse_rule("RULE-001-global-scope")]
        ... reads all 7 rules ...

Claude: Here's the spec I've generated for "Multiplication Grid":
        [shows complete 15-section spec]

        Shall I submit this to Ralph for building?

User: Looks good, submit it.

Claude: [calls register_spec with full spec]
        Build #3 queued for "multiplication-grid".
        [calls get_build_status after a few minutes]

        Build is running — HTML generated (28KB), now in test/fix loop
        iteration 2/5, 8 passed, 2 failed...

        [calls get_build_status again]

        Build APPROVED! 10/10 tests passing.
        GCP URL: https://storage.googleapis.com/mathai-temp-assets/games/multiplication-grid/...
```

---

## Spec Quality Checklist

Before submitting, score your spec against these criteria:

| Criteria | Weight | Check |
|----------|--------|-------|
| All 15 sections present | Required | Missing sections = build failure |
| Fallback content has 3+ rounds | Required | No content = game can't render |
| Test scenarios use exact selectors | High | Vague selectors = tests can't be generated |
| Functions have step-by-step logic | High | Vague logic = HTML generation guesses |
| CSS covers all interactive states | Medium | Missing hover/active/disabled = visual bugs |
| Event schema lists all custom events | Medium | Missing events = incomplete analytics |
| Verification checklist is complete | Medium | Missing checks = issues slip through review |

---

## Troubleshooting

### "MCP not available" error

The server doesn't have `@modelcontextprotocol/sdk` installed. Run `npm install` on the server.

### Claude doesn't read warehouse parts

Make sure the `warehouse/` directory exists on the server with all parts, rules, and contracts. Check `RALPH_REPO_DIR` in `.env` points to the correct location.

### Build keeps failing on the same issue

Use `add_learning` to record what went wrong. Future builds will benefit from accumulated learnings. Also consider simplifying the spec — smaller games succeed more reliably.

### Spec too large for register_spec

Very detailed specs (50KB+) may hit context limits. Focus on being precise, not verbose. Code blocks should be exact but not duplicated across sections.
