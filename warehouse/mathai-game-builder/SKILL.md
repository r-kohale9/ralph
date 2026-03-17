---
name: mathai-game-builder-lokesh
description: Build educational math games for the MathAI platform using a two-stage workflow - define gameplay first, then add comprehensive feedback (audio, stickers, subtitles). Games are templates that receive runtime content via postMessage, enabling unlimited variations. Use this skill when creating interactive learning games with event tracking, multi-type answer validation, and rich multimedia feedback.
platform: claude-code
---



# MathAI Game Builder

## Guardrail Enforcement & Prompt Dispatch (MANDATORY - HIGHEST PRIORITY)

> **CRITICAL**: Before processing ANY user request, you MUST follow the [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md) system for guardrail enforcement and intent classification.

**Guardrail Process:**
1. **ALWAYS** apply the [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md) guardrail rules first
2. **CHECKLIST VERIFICATION GUARD**: Run [workflows/checklist-verification-guard.md](workflows/checklist-verification-guard.md) before EVERY response to verify complete checklist coverage for current phase
3. **BLOCK** requests that violate workflow requirements (missing checklists, incomplete checklists, phase violations, etc.)
4. **RESET checklists** for edit requests as specified in prompt-dispatch.md
5. **Only provide responses** after checklist verification passes

**Key Guardrail Rules:**
- **Checklist Verification**: BEFORE each response, verify ALL appropriate checklists exist and are properly filled for every phase up to current phase
- **Intent Classification**: Follow prompt-dispatch.md for START_OR_CONTINUE, EDIT_REQUEST, APPROVAL_AND_ADVANCE
- **Phase Ordering**: Must follow proper sequence (1→2→3→4→5)
- **Edit Protection**: Automatic checklist reset for change requests
- **Completion Requirement**: ALL checklists must be [✅] with notes or [ ] with explanations before proceeding

Build interactive educational games as reusable templates with comprehensive feedback systems and intelligent answer validation.

## Overview

**Games are templates**, not static content:

- **One game → unlimited content variations** (e.g., same quiz template, different problems)
- **Runtime content** delivered via postMessage from platform
- **Comprehensive feedback** via audio, Lottie stickers, and subtitles (resolved through MCP server)
- **Multi-type validation** supporting fixed answers, function-based rules, and LLM evaluation
- **Full event tracking** for teacher/parent replay and analytics
- **Platform integration** - works integrated with learn.mathai.ai platform
- **Story-only games** - Games that only display StoriesComponent without questions/validation/feedback

Games are accessed via `mathai/game/{id}` URLs and can be embedded in sessions.

## Game Types

### Standard Games

Full 6-phase workflow with questions, validation, and feedback:

0. New Game → 1. Core Gameplay → 2. Validation → 3. Feedback → 4. Registration → 5. Testing

### Story-Only Games

Simplified 3-phase workflow for story display only:

1. Story Display → 2. Registration → 3. Testing

See [Story-Only Games Workflow](workflows/story-only-games.md) for complete guide.

## Getting Started

**Each phase has a comprehensive checklist.** Follow the workflow files for detailed requirements.

All rules, requirements, and patterns are in the phase checklists - not duplicated here.

## Setup

Before using this skill, configure MCP servers. See [MCP Server Setup Guide](reference/mcp-server-setup.md) for instructions.

Required MCP servers:

- `mathai-core` - Game registration, CDN uploads
- `mathai-feedback` - Feedback library, audio generation

## Tools Used

- **File Operations**: Read, Write, Edit, Bash (Claude Code native tools)
- **MCP Servers**: mathai-core, mathai-feedback (see [Setup Guide](reference/mcp-server-setup.md))

### Checklist System

Each phase uses **dual checklists** that are written to your local game directory:

**Checklist 1 - User Requirements** (from your game description):

- Game-specific needs
- User interactions
- Visual requirements
- Dynamic based on your requirements

**Checklist 2 - Skill Pattern Requirements** (technical verification):

- Package loading order
- API usage patterns
- File operation rules
- Static requirements

**Checklist Workflow:**

1. Present BOTH checklists before starting phase
2. Wait for your "start" confirmation
3. **Write checklists to local directory using Write tool**
4. Develop according to checklists
5. Verify BOTH checklists before notifying you (all ✅)
6. Fix any ❌ items immediately
7. Request approval only when all ✅

**Prompt Dispatch & Change Guard:** Before any phase work begins, the agent classifies your message using [workflows/prompt-dispatch.md](workflows/prompt-dispatch.md). If the intent is an edit request, it must STOP, reset all relevant checklists ([✅] → [ ] with `replaceAll: true`), optionally show the cleared state, and only then proceed with edits and re-verification.

**Checklist Storage:**

- Written to game directory using Write tool (like index.html)
- Example: `games/{gameId}/checklists/phase-1-checklists.md`
- Available even in new chat contexts where conversation context is lost
- Updated using Edit tool as checklist items are completed

**Checklist Reset on Edit:**

- When you request changes during any phase, all checklists up to and including the current phase are reset (`[✅]` → `[ ]`)
- Claude analyzes the prompt, **stops editing**, resets the relevant checklists first, makes the requested edits, re-verifies each checklist, and only then requests approval
- Claude re-verifies all reset checklists sequentially (Phase 1 → Phase 2 → ... → Current Phase)
- This ensures edits don't break previously completed work
- Progresses only when all reset checklists are verified as `[✅]` again
- The reset happens **before any new edits** using `Edit` with `replace_all: true` (see [checklist-reset-strategy.md](workflows/checklist-reset-strategy.md) for ready-to-run snippets)
- See [checklist-reset-strategy.md](workflows/checklist-reset-strategy.md) for complete details

## Response Style

Keep responses concise (3-4 sentences). Show code, not explanations.

## Development Phases

Follow these phases in sequence. Each phase has a detailed workflow guide.

### Phase 0: New Game Metadata

**Goal:** Collect game information before development

**Workflow:** [workflows/phase-0-new-game.md](workflows/phase-0-new-game.md)

**Pattern:** Checklist → Collect metadata → Validate → Approve → Create directory

---

### Phase 1: Core Gameplay

**Goal:** Create playable game with working interactions

**Workflow:** [workflows/phase-1-core-gameplay.md](workflows/phase-1-core-gameplay.md)

**Pattern:** Load metadata → Checklist → Get directories → Create directory → Write index.html → Verify → Test → Approve

---

### Phase 2: Validation

**Goal:** Add answer checking logic

**Workflow:** [workflows/phase-2-validation.md](workflows/phase-2-validation.md)

**Pattern:** Checklist → Choose validation type → Edit file → Verify → Test → Approve

---

### Phase 3: Feedback Integration

**Goal:** Add audio, subtitles, and stickers

**Workflow:** [workflows/phase-3-feedback.md](workflows/phase-3-feedback.md)

**Pattern:** Checklist → Plan table → Get approval → Search DB → Edit file → Verify → Test → Approve

---

### Phase 4: Content Sets & Registration

**Goal:** Register game and create content variations

**Workflow:** [workflows/phase-4-registration.md](workflows/phase-4-registration.md)

**Pattern:** Checklist → Extract schema → Preview registration → Register → Create content sets → Share URLs → Approve

---

### Phase 5: Testing & Polish

**Goal:** Verify all functionality works

**Workflow:** [workflows/phase-5-testing.md](workflows/phase-5-testing.md)

**Pattern:** Checklist → Visual test → Console check → Debug functions → Gameplay test → Platform test → Approve

---

## Components Available

**Package Loading Order (CRITICAL):**

```html
<!-- 1. FeedbackManager MUST load first -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>

<!-- 2. Components MUST load second -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>

<!-- 3. Helpers MUST load third -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

<!-- 4. Analytics Package (optional - config loads automatically) -->
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/analytics/index.js"></script>
```

**Notes:**

- Error tracking (Sentry) is added in Phase 5 - Production Readiness, not during development (Phases 1-4). See [workflows/phase-5-testing.md](workflows/phase-5-testing.md) for Sentry integration.
- Analytics config loads automatically - no separate config.js script tag needed
- SignalCollector loads automatically via Helpers package - no extra script tag needed. Poll for it in `waitForPackages()`: `while (typeof SignalCollector === 'undefined') { ... }`

**HTML Components (Package-Based):**

| Component                  | Purpose                                    | Quick Reference                                                                    |
| -------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| **ScreenLayoutComponent**  | Game wrapper structure with slots          | [workflows/choices/screenlayout-options.md](workflows/choices/screenlayout-options.md)         |
| **ProgressBarComponent**   | Rounds/levels progress with hearts        | [workflows/choices/progressbar-options.md](workflows/choices/progressbar-options.md)           |
| **TransitionScreenComponent** | Start/end/victory screens (inline)      | [workflows/choices/transitionscreen-options.md](workflows/choices/transitionscreen-options.md) |
| **Gameplay Colors**        | Answer feedback color variables            | [workflows/choices/gameplay-colors-options.md](workflows/choices/gameplay-colors-options.md)   |

**Detailed Documentation (Optional):** [workflows/html-components/](workflows/html-components/) - Redundant detailed references

**Feedback & Interaction Components:**

| Component                | Purpose                                                        | Documentation                                                                                  |
| ------------------------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **FeedbackManager**      | Audio + subtitle + sticker unified system                      | [components/feedback-manager.md](components/feedback-manager.md)                               |
| **StoriesComponent**     | Interactive story sequences with branching logic               | [components/stories-component.md](components/stories-component.md)                             |
| **TimerComponent**       | All timer functionality (count up/down)                        | [components/timer-component.md](components/timer-component.md)                                 |
| **SubtitleComponent**    | Text feedback (auto-loaded by FeedbackManager)                 | [components/subtitle-component.md](components/subtitle-component.md)                           |
| **VisibilityTracker**    | Pause/resume on tab switch (MANDATORY)                         | [components/visibility-tracker.md](components/visibility-tracker.md)                           |
| **SubjectiveEvaluation** | AI-powered evaluation for open-ended questions                 | [workflows/checklists/subjective-evaluation.md](workflows/checklists/subjective-evaluation.md) |
| **AnalyticsManager**     | Multi-platform event tracking (Mixpanel, Amplitude, CleverTap) | [components/analytics-manager.md](components/analytics-manager.md)                             |
| **SignalCollector**      | Raw input capture + problem-level signals (auto-loaded via Helpers) | [components/signal-collector.md](components/signal-collector.md)                           |

**Quick API Reference:** [reference/component-props.md](reference/component-props.md)

---

## Key Concepts

- **Games as Templates** - Receive runtime content via postMessage → [reference/architecture.md](reference/architecture.md)
- **Feedback System** - Resolved through mathai-feedback MCP server → [reference/mcp-integration.md](reference/mcp-integration.md)
- **Answer Validation** - Fixed, function-based, or LLM evaluation → [reference/validation-types.md](reference/validation-types.md)

---

## Quick Links

### Workflows

**Standard Games:**

- [Phase 0: New Game Metadata](workflows/phase-0-new-game.md)
- [Phase 1: Core Gameplay](workflows/phase-1-core-gameplay.md)
- [Phase 2: Validation](workflows/phase-2-validation.md)
- [Phase 3: Feedback](workflows/phase-3-feedback.md) ⭐ **CRITICAL**
- [Phase 4: Registration](workflows/phase-4-registration.md)
- [Phase 5: Testing](workflows/phase-5-testing.md)

**Story-Only Games:**

- [Story-Only Games Workflow](workflows/story-only-games.md) ⭐ **NEW** - Simplified workflow for story display

**Game Management:**

- [Game Resumption](workflows/game-resumption.md) - Resume existing games from CDN
- [Game Duplication](workflows/checklists/game-duplication.md) ⭐ **NEW** - Duplicate existing games with new game_id

### Guardrails

- [Prompt Dispatch & Checklist Reset Guard](workflows/prompt-dispatch.md) ⭐ **MANDATORY**
- [Checklist Verification Guard](workflows/checklist-verification-guard.md) ⭐ **MANDATORY** and ⭐ **CRITICAL**

### HTML Components (Quick Reference)

- [ScreenLayout Options](workflows/choices/screenlayout-options.md) - Slot configuration
- [ProgressBar Options](workflows/choices/progressbar-options.md) - Rounds/lives tracker
- [TransitionScreen Options](workflows/choices/transitionscreen-options.md) - Screen types
- [Gameplay Colors Options](workflows/choices/gameplay-colors-options.md) - Answer feedback colors

### Detailed Documentation (Optional)

- [ScreenLayout Details](workflows/html-components/screen-layout.md) - Full context (redundant)
- [ProgressBar Details](workflows/html-components/progress-bar.md) - Full context (redundant)
- [TransitionScreens Details](workflows/html-components/transition-screens.md) - All 9 types (redundant)
- [CSS Variables Reference](reference/css-variables-reference.md) - Complete palette (redundant for gameplay colors)

### Feedback & Interaction Components

- [FeedbackManager](components/feedback-manager.md) - Audio + subtitle + sticker
- [SubjectiveEvaluation](workflows/checklists/subjective-evaluation.md) - AI evaluation for open-ended questions
- [TimerComponent](components/timer-component.md) - Timer management
- [VisibilityTracker](components/visibility-tracker.md) - Pause/resume system
- [Component Props Reference](reference/component-props.md) - Quick API lookup

### Reference

- [Sentry Integration](reference/sentry-integration.md) ⭐ **NEW** - Error tracking & monitoring
- [Architecture Guide](reference/architecture.md) - Games as templates, concepts
- [Validation Types](reference/validation-types.md) - Fixed, function-based, LLM
- [File Operations](reference/file-operations.md) - Filesystem workflows
- [InputSchema Guide](reference/inputschema-guide.md) - Schema patterns
- [Debug Functions](reference/debug-functions.md) - Testing utilities
- [Error Messages](reference/error-messages.md) - Troubleshooting
- [MCP Integration](reference/mcp-integration.md) - Feedback & core service tools

### Examples

- [Correct Patterns](examples/correct-patterns.md) ✅ - Complete working examples
- [Anti-Patterns](examples/anti-patterns.md) ❌ - Common mistakes & fixes
- [Quick Reference](examples/QUICK-REFERENCE.md) - 30-second answers
- [Story-Only Game Example](examples/story-only-game-example.md) 📖 - Complete story game template
- [Signal Capture Patterns](examples/signal-capture-patterns.md) - Raw signal capture integration

### Helpers

- [API Helper](helpers/api-helper.md) - Backend communication
- [Case Converter](helpers/case-converter.md) - camelCase ↔ snake_case
- [Tracker Helper](helpers/tracker-helper.md) - Session tracking

---

## Troubleshooting

See [reference/error-messages.md](reference/error-messages.md) for complete troubleshooting guide.
