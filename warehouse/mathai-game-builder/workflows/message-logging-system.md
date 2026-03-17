# Message Logging System

## Overview

This system automatically logs all user messages to the game directory, ensuring complete conversation traceability and workflow compliance. Messages are logged at critical workflow points similar to how checklists track progress.

## Message Log File Structure

Messages are stored in: `games/{gameId}/message-log.md`

### Format

```markdown
# Message Log - Game {gameId}

Created: {timestamp}
Last Updated: {timestamp}

## Session: {session_timestamp}

### Message {sequential_number} - {message_timestamp}
**Intent:** {START_OR_CONTINUE|EDIT_REQUEST|APPROVAL_AND_ADVANCE}
**Phase:** {current_phase}
**Workflow Step:** {current_workflow_step}
**Context:** {brief_context_description}

**User Message:**
```
{full_user_message}
```

**System Response:** {brief_response_summary}
**Checklist Status:** {pre/post status if applicable}
---

### Message {sequential_number} - {message_timestamp}
...
```

## Logging Points

### 1. Prompt Dispatch (MANDATORY - Every Message)

**Location:** [prompt-dispatch.md](prompt-dispatch.md) - First step of every user interaction

**When Logged:** Immediately after intent classification

**Log Entry:**
```javascript
logMessage({
  intent: detectedIntent,
  phase: currentPhase,
  workflowStep: "prompt_dispatch",
  context: "User message received and classified",
  userMessage: fullUserMessage,
  response: "Intent classified, proceeding to workflow"
});
```

### 2. Checklist Verification Guard

**Location:** [checklist-verification-guard.md](checklist-verification-guard.md) - Before every response

**When Logged:** Before checklist verification check

**Log Entry:**
```javascript
logMessage({
  intent: "SYSTEM_CHECK",
  phase: currentPhase,
  workflowStep: "checklist_verification_guard",
  context: "Verifying checklist completion before response",
  userMessage: "(system check - no user message)",
  response: verificationResult ? "Checklists verified" : "Checklists incomplete - blocking response"
});
```

### 3. Phase Transitions

**Location:** End of each phase workflow

**When Logged:** When user approves phase completion

**Log Entry:**
```javascript
logMessage({
  intent: "APPROVAL_AND_ADVANCE",
  phase: currentPhase,
  workflowStep: `phase_${currentPhase}_approval`,
  context: `Phase ${currentPhase} approved, advancing to Phase ${nextPhase}`,
  userMessage: approvalMessage,
  response: `Phase ${currentPhase} complete, Phase ${nextPhase} ready`
});
```

### 4. Checklist Reset Events

**Location:** [checklist-reset-strategy.md](checklist-reset-strategy.md)

**When Logged:** When checklists are reset for edit requests

**Log Entry:**
```javascript
logMessage({
  intent: "EDIT_REQUEST",
  phase: currentPhase,
  workflowStep: "checklist_reset",
  context: `Resetting checklists for phases 1-${currentPhase} due to edit request`,
  userMessage: editRequestMessage,
  response: `Checklists reset, ready for modifications`
});
```

### 5. Error/Block Conditions

**Location:** Any blocking condition in guardrails

**When Logged:** When workflow is blocked

**Log Entry:**
```javascript
logMessage({
  intent: "SYSTEM_BLOCK",
  phase: currentPhase,
  workflowStep: "workflow_block",
  context: blockReason,
  userMessage: blockedMessage,
  response: `BLOCKED: ${blockReason} - Cannot proceed until resolved`
});
```

## Implementation Pattern

### Message Logging Function

```javascript
function logMessage({
  intent,
  phase,
  workflowStep,
  context,
  userMessage,
  response,
  checklistStatus = null
}) {
  const gameId = getCurrentGameId();
  const messageNumber = getNextMessageNumber(gameId);
  const timestamp = new Date().toISOString();

  const logEntry = `
### Message ${messageNumber} - ${timestamp}
**Intent:** ${intent}
**Phase:** ${phase}
**Workflow Step:** ${workflowStep}
**Context:** ${context}

**User Message:**
\`\`\`
${userMessage}
\`\`\`

**System Response:** ${response}
${checklistStatus ? `**Checklist Status:** ${checklistStatus}` : ''}
---
`;

  // Read existing log or create new one
  const logPath = `games/${gameId}/message-log.md`;
  let existingLog = '';

  try {
    existingLog = Read({ file_path: logPath });
  } catch (error) {
    // Create new log file
    existingLog = `# Message Log - Game ${gameId}

Created: ${timestamp}
Last Updated: ${timestamp}

## Session: ${timestamp}
`;
  }

  // Append new entry
  const updatedLog = existingLog.replace(
    /Last Updated: .*/,
    `Last Updated: ${timestamp}`
  ) + logEntry;

  Write({
    file_path: logPath,
    content: updatedLog
  });

  // Update message counter
  updateMessageCounter(gameId, messageNumber);
}
```

### Helper Functions

```javascript
function getCurrentGameId() {
  // Get from session state or extract from current game directory
  return window.currentGameId || extractGameIdFromPath();
}

function getNextMessageNumber(gameId) {
  // Read counter from metadata or calculate from existing log
  try {
    const metadata = Read({ file_path: `games/${gameId}/metadata.json` });
    return metadata.messageCount + 1;
  } catch (error) {
    // Count existing messages in log
    const log = Read({ file_path: `games/${gameId}/message-log.md` });
    const matches = log.match(/### Message \d+/g);
    return matches ? matches.length + 1 : 1;
  }
}

function updateMessageCounter(gameId, count) {
  try {
    const metadata = Read({ file_path: `games/${gameId}/metadata.json` });
    metadata.messageCount = count;
    metadata.lastMessageAt = new Date().toISOString();

    Write({
      file_path: `games/${gameId}/metadata.json`,
      content: JSON.stringify(metadata, null, 2)
    });
  } catch (error) {
    // Metadata doesn't exist yet, will be created later
  }
}
```

## Integration Points

### 1. Prompt Dispatch Integration

**File:** `workflows/prompt-dispatch.md`

**Add after intent classification:**
```javascript
// Log the message after intent classification
logMessage({
  intent: detectedIntent,
  phase: currentPhase,
  workflowStep: "prompt_dispatch",
  context: `Intent classified as ${detectedIntent}`,
  userMessage: userPrompt,
  response: `Proceeding with ${detectedIntent} workflow`
});
```

### 2. Checklist Verification Guard Integration

**File:** `workflows/checklist-verification-guard.md`

**Add at start of verification:**
```javascript
// Log system check
logMessage({
  intent: "SYSTEM_CHECK",
  phase: currentPhase,
  workflowStep: "checklist_verification_guard",
  context: "Pre-response checklist verification",
  userMessage: "(automated system check)",
  response: "Verifying checklist completion"
});
```

### 3. Phase Workflow Integration

**File:** Each phase workflow file

**Add at key decision points:**
```javascript
// Before presenting checklists
logMessage({
  intent: "START_OR_CONTINUE",
  phase: targetPhase,
  workflowStep: `phase_${targetPhase}_start`,
  context: `Starting Phase ${targetPhase} workflow`,
  userMessage: userMessage,
  response: `Presenting Phase ${targetPhase} checklists`
});

// After approval
logMessage({
  intent: "APPROVAL_AND_ADVANCE",
  phase: currentPhase,
  workflowStep: `phase_${currentPhase}_complete`,
  context: `Phase ${currentPhase} approved, advancing to Phase ${nextPhase}`,
  userMessage: approvalMessage,
  response: `Phase ${currentPhase} complete`
});
```

## Usage Examples

### Example Log Entry

```markdown
### Message 15 - 2024-01-15T14:30:25Z
**Intent:** EDIT_REQUEST
**Phase:** phase-3
**Workflow Step:** checklist_reset
**Context:** Resetting checklists for phases 1-3 due to edit request

**User Message:**
```
I want to change the feedback sounds - can you make the correct answer sound more exciting?
```

**System Response:** Checklists reset, ready for modifications
**Checklist Status:** Reset phases 1-3 checklists to [ ]
---
```

### Reading the Log

The message log can be read at any time to understand the complete conversation history:

```javascript
// Read complete message history
const messageLog = Read({
  file_path: `games/${gameId}/message-log.md`
});

console.log(messageLog); // Shows all logged messages
```

## Benefits

1. **Complete Traceability** - Every user message is logged with context
2. **Workflow Compliance** - Tracks adherence to guardrail rules
3. **Debugging Support** - Historical context for troubleshooting
4. **Audit Trail** - Complete record of all interactions
5. **Persistence** - Survives conversation resets and context loss
6. **Structured Format** - Easy to parse and analyze programmatically

## File Management

- **Location:** `games/{gameId}/message-log.md`
- **Naming:** Consistent with checklist naming pattern
- **Persistence:** Survives until game directory is deleted
- **Size Management:** No automatic truncation (logs are valuable)
- **Backup:** Included in CDN uploads like checklists

This system ensures no user message goes unrecorded, providing complete workflow transparency and debugging capability.
