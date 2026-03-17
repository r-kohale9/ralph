# Prompt Dispatcher & Checklist Reset Guard

This module runs **before every phase workflow**. It classifies the latest user prompt, resets checklists when needed, and only then routes control to the appropriate phase instructions.

---

## 1. Intent Classification

Treat each incoming user message as one of three intents:

| Intent | Description | Typical Keywords / Signals |
|--------|-------------|-----------------------------|
| `START_OR_CONTINUE` | Begin a phase or continue planned work | "start", "continue", "next step", no reference to previous deliverables |
| `EDIT_REQUEST` | Modify previously delivered work in the current or prior phases | Verbs such as **update, modify, change, adjust, tweak, redo, revise, fix, edit, replace**, references like "the previous file", "the last version" |
| `APPROVAL_AND_ADVANCE` | Approve current phase and move forward | "approved", "looks good", "go to phase X", "proceed" |

Implementation tips:
- Use lightweight keyword/regex matching first; escalate to a small LLM completion only if ambiguous.
- Maintain session state (e.g., `currentPhase`, `awaitingApproval`). If the state expects approval but the prompt instead requests changes, force the intent to `EDIT_REQUEST`.
- Log the detected intent for debugging ("Intent: EDIT_REQUEST").

## 2. Message Logging (MANDATORY)

**Log every user message immediately after intent classification:**

```javascript
// Log the message to game directory
logMessage({
  intent: detectedIntent,
  phase: currentPhase,
  workflowStep: "prompt_dispatch",
  context: `User message classified as ${detectedIntent}`,
  userMessage: fullUserMessage,
  response: `Proceeding with ${detectedIntent} workflow`
});
```

**Message log location:** `games/{gameId}/message-log.md`

**Purpose:** Ensures complete conversation traceability and workflow compliance.

---

## 3. Checklist Reset Guard (Runs on `EDIT_REQUEST`)

Before editing **any** game file:

1. Retrieve the highest phase that has been completed (store in metadata or session state).
2. Generate the list of checklist files that must reset (see mapping below).
3. For each file, convert every `[✅]` to `[ ]` using `Edit` with `replace_all: true`.
4. Optionally read back each file and surface the cleared state to the user (recommended for transparency).
5. Set `state.checklistsResetForCurrentEdit = true` so the guard is not re-run mid-edit.
6. Continue with the requested modifications.

Pseudo-code:

```javascript
function handleChangeRequest({ gameId, currentPhase }) {
  const checklistFiles = getChecklistFilesUpToPhase(currentPhase);

  for (const file of checklistFiles) {
    Edit({
      file_path: `games/${gameId}/checklists/${file}`,
      old_string: "[✅]",
      new_string: "[ ]",
      replace_all: true
    });

    Read({
      file_path: `games/${gameId}/checklists/${file}`
    });
  }

  state.checklistsResetForCurrentEdit = true;
}
```

Important rules:
- **Never** call `Edit` on game assets until this guard completes.
- If another edit request arrives later, clear the flag so the guard re-runs.
- If the user declines the reset, abort the operation and ask them to confirm.

---

## 4. Checklist Mapping

Use this helper to determine which files reset for each phase:

| Phase | Checklist files to reset (relative to `/checklists`) |
|-------|-------------------------------------------------------|
| Phase 0 | `phase-0-checklist.md` |
| Phase 1 | Phase 0 + `phase-1-checklists.md` |
| Phase 2 | Phase 1 + `phase-2-checklist.md` |
| Phase 3 | Phase 2 + `phase-3-checklist.md`, `feedback-plan.md` |
| Phase 4 | Phase 3 + `phase-4-checklist.md` |
| Phase 5 | Phase 4 + `phase-5-checklist.md` |

Example helper:

```javascript
const checklistMap = {
  "phase-0": ["phase-0-checklist.md"],
  "phase-1": ["phase-0-checklist.md", "phase-1-checklists.md"],
  "phase-2": ["phase-0-checklist.md", "phase-1-checklists.md", "phase-2-checklist.md"],
  "phase-3": [
    "phase-0-checklist.md",
    "phase-1-checklists.md",
    "phase-2-checklist.md",
    "phase-3-checklist.md",
    "feedback-plan.md"
  ],
  "phase-4": [
    "phase-0-checklist.md",
    "phase-1-checklists.md",
    "phase-2-checklist.md",
    "phase-3-checklist.md",
    "feedback-plan.md",
    "phase-4-checklist.md"
  ],
  "phase-5": [
    "phase-0-checklist.md",
    "phase-1-checklists.md",
    "phase-2-checklist.md",
    "phase-3-checklist.md",
    "feedback-plan.md",
    "phase-4-checklist.md",
    "phase-5-checklist.md"
  ]
};

function getChecklistFilesUpToPhase(currentPhase) {
  return checklistMap[currentPhase] ?? checklistMap["phase-0"];
}
```

Keep this mapping synced with workflow docs.

---

## 5. Session State Recommendations

Track at minimum:
- `gameId`
- `currentPhase`
- `gameType` (e.g., "standard", "story-only")
- `awaitingApproval`
- `checklistsResetForCurrentEdit`

Reset `checklistsResetForCurrentEdit` to `false` once re-verification and approval succeed so the next edit request re-triggers the guard.

### Game Type Detection

Detect game type from user prompt:

**Story-Only Game** when user requests:
- "Show a story"
- "Display interactive story"
- "Story-based game without questions"
- "Just show StoriesComponent"
- Any game that mentions ONLY story display (no questions/answers)

Set `gameType = "story-only"` and use modified phase workflow:
- Phase 1: Story Display (see [workflows/story-only-games.md](story-only-games.md))
- Phase 2: Registration (skip validation/feedback)
- Phase 3: Testing

**Standard Game** (default):
- Phase 1: Core Gameplay
- Phase 2: Validation
- Phase 3: Feedback
- Phase 4: Registration
- Phase 5: Testing

---

## 6. Conversation Flow Summary

1. **Dispatch**: Determine intent (`START_OR_CONTINUE`, `EDIT_REQUEST`, `APPROVAL_AND_ADVANCE`).
2. **Guard**: If `EDIT_REQUEST` and `checklistsResetForCurrentEdit` is false → run the reset guard.
3. **Phase Execution**: Invoke the appropriate phase instructions.
4. **Verification**: Ensure all checklists are `[✅]` before requesting approval.
5. **Approval Handling**: On approval, update `currentPhase`, reset flags, and proceed.

This keeps the STOP → Reset → Edit → Re-verify → Request sequence automatic and consistent across phases.

