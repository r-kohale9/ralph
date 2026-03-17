# Checklist Reset and Re-verification Strategy

## Overview

When a user requests an edit during any phase, ALL checklists up to and including the current phase must be reset to `[ ]` and then re-verified sequentially. The dispatcher/guard workflow in [prompt-dispatch.md](prompt-dispatch.md) enforces this automatically before any edits occur.

---

## Trigger Condition

**Reset happens when:**

- User requests ANY edit/modification during an active phase
- User requests changes after approval but before next phase starts
- User reports issues that require code changes

**Reset does NOT happen when:**

- User approves and moves to next phase (normal progression)
- User requests clarification or information only
- User requests testing instructions

---

## Reset Scope

### Which Checklists Reset

**Rule:** Reset ALL checklists from Phase 0 through the CURRENT phase.

**Examples:**

| Current Phase | Checklists That Reset                                     |
| ------------- | --------------------------------------------------------- |
| Phase 0       | Phase 0 only                                              |
| Phase 1       | Phase 0 + Phase 1                                         |
| Phase 2       | Phase 0 + Phase 1 + Phase 2                               |
| Phase 3       | Phase 0 + Phase 1 + Phase 2 + Phase 3                     |
| Phase 4       | Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4           |
| Phase 5       | Phase 0 + Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 |

**Note:** Checklists for phases AFTER the current phase are not reset (they haven't been started yet).

---

## Reset Process

### Mandatory Change-Request Flow

For every user prompt that seeks **any** modification after a phase was marked complete:

1. **Analyze the prompt first.** Confirm it is a change request (not just a question or clarification).
2. **STOP** – do **not** edit game files yet.
3. **Reset all relevant checklists** (Phases 0→current, plus support docs) so every `[✅]` becomes `[ ]` using `Edit` with `replace_all: true` when possible.
4. **Log the reset event:**
   ```javascript
   logMessage({
     intent: 'EDIT_REQUEST',
     phase: currentPhase,
     workflowStep: 'checklist_reset_initiated',
     context: `Checklist reset triggered for edit request - phases 1-${currentPhase}`,
     userMessage: editRequestPrompt,
     response: 'Initiating checklist reset before modifications'
   });
   ```
5. **Then** implement the requested edits.
6. **Log reset completion:**
   ```javascript
   logMessage({
     intent: 'SYSTEM_RESET',
     phase: currentPhase,
     workflowStep: 'checklist_reset_completed',
     context: `Checklists reset for phases 1-${currentPhase}`,
     userMessage: '(automated checklist reset)',
     response: 'Checklists reset - ready for modifications',
     checklistStatus: `Reset: phases 1-${currentPhase} checklists to [ ]`
   });
   ```
7. **Re-verify** the reset checklists sequentially until they all return to `[✅]`.
8. **Request approval** only after all verifications pass.

Skipping the reset step breaks the workflow; always follow this sequence before modifying files.

### When to Trigger This Reset

- User requests changes after approving any phase (starting with Phase 1)
- You reopen a prior phase to modify behavior or add features
- You detect regressions that invalidate previously verified checklists

Run the reset steps **before** making file edits so verification restarts with fresh `[ ]` states.

### Step 1: Reset Checklist Files

**Action:** Use `Edit` tool to reset all `[✅]` back to `[ ]` in affected checklist files.

**Pattern:**

```javascript
// Reset Phase 1 checklist
Edit({
  file_path: `games/${gameId}/checklists/phase-1-checklists.md`,
  old_string: '[✅]',
  new_string: '[ ]',
  replace_all: true
});

// Reset Phase 2 checklist (if current phase >= 2)
Edit({
  file_path: `games/${gameId}/checklists/phase-2-checklist.md`,
  old_string: '[✅]',
  new_string: '[ ]',
  replace_all: true
});

// Continue for all phases up to current phase
```

**Automation Note:** Use `replace_all: true` to reset all `[✅]` to `[ ]` in one operation per file.

---

### Step 2: Sequential Re-verification

**Order:** Must verify checklists sequentially from Phase 1 → Current Phase

**Process for Each Phase:**

1. **Read checklist file** using `Read` tool
2. **Read game file** using `Read` tool to verify current state
3. **Check each checklist item** against actual code/file state
4. **Mark items as `[✅]`** if still valid, `[❌]` if broken
5. **Fix any `[❌]` items immediately** using `Edit` tool
6. **Update checklist file** with verification results using `Edit` tool
7. **Only proceed to next phase** when current phase checklist is all `[✅]`

---

## Verification Criteria by Phase

### Phase 1 Verification

**What to verify:**

- Game file exists at expected path
- Packages loaded in correct order (FeedbackManager → Components → Helpers)
- `waitForPackages()` function exists
- `FeedbackManager.init()` called in DOMContentLoaded
- VisibilityTracker initialized (MANDATORY)
- TimerComponent initialized (if timer required)
- NO feedback integration (no feedbackAssets, preload, play calls)
- Game mechanics functional (interactions, flow, win/lose conditions)
- Custom metrics implemented (if specified)

**Verification method:**

- Read game HTML file
- Search for required patterns
- Verify structure matches Phase 1 requirements

---

### Phase 2 Verification

**What to verify:**

- All Phase 1 items still valid (don't skip Phase 1 verification)
- Validation function exists and is correct type (fixed/function/LLM)
- Validation logic handles edge cases (trim, lowercase, etc.)
- Attempt tracking implemented correctly
- Max attempts logic working
- Response time tracked

**Verification method:**

- Read game HTML file
- Verify Phase 1 patterns still present
- Verify Phase 2 patterns added correctly
- Check validation function implementation

---

### Phase 3 Verification

**What to verify:**

- All Phase 1 items still valid
- All Phase 2 items still valid
- Feedback assets defined
- `FeedbackManager.sound.preload()` called
- All feedback uses `FeedbackManager.sound.play(id, { subtitle, sticker })`
- VisibilityTracker pauses/resumes audio correctly
- Debug functions included

**Verification method:**

- Read game HTML file
- Verify Phase 1 & 2 patterns still present
- Verify Phase 3 feedback integration
- Check FeedbackManager API usage

---

### Phase 4 Verification

**What to verify:**

- All Phase 1-3 items still valid
- Game registered (check via MCP or user confirmation)
- InputSchema extracted correctly
- At least one content set created
- Test URLs shared

**Verification method:**

- Read game HTML file (verify Phases 1-3)
- Check registration status (may require user confirmation)
- Verify content sets exist

---

### Phase 5 Verification

**What to verify:**

- All Phase 1-4 items still valid
- Debug functions work
- Console clean (no errors)
- Gameplay tested and functional

**Verification method:**

- Read game HTML file (verify Phases 1-4)
- Request user to run debug functions
- Check console output

---

## Complete Workflow Example

### Scenario: User in Phase 3 requests edit

**User:** "Change the correct answer subtitle to 'Excellent work!'"

**Claude's Process:**

```
1. RESET CHECKLISTS:
   - Reset phase-1-checklists.md: [✅] → [ ]
   - Reset phase-2-checklist.md: [✅] → [ ]
   - Reset phase-3-checklist.md: [✅] → [ ]

2. MAKE THE REQUESTED EDIT:
   - Read game file
   - Edit subtitle text
   - Save changes

3. RE-VERIFY PHASE 1:
   - Read phase-1-checklists.md
   - Read game file
   - Check each Phase 1 item
   - Mark [✅] or [❌]
   - Fix any [❌] items
   - Update phase-1-checklists.md
   - Confirm all Phase 1 items are [✅]

4. RE-VERIFY PHASE 2:
   - Read phase-2-checklist.md
   - Read game file
   - Check each Phase 2 item
   - Mark [✅] or [❌]
   - Fix any [❌] items
   - Update phase-2-checklist.md
   - Confirm all Phase 2 items are [✅]

5. RE-VERIFY PHASE 3:
   - Read phase-3-checklist.md
   - Read game file
   - Check each Phase 3 item (including the new subtitle)
   - Mark [✅] or [❌]
   - Fix any [❌] items
   - Update phase-3-checklist.md
   - Confirm all Phase 3 items are [✅]

6. NOTIFY USER:
   - "Edit complete. All checklists re-verified."
   - "Refresh Chrome to test: Cmd+Shift+R"
   - Show current status
```

---

## Implementation Notes

### Efficient Reset Pattern

**Replace All Pattern (Recommended)**

```javascript
// Reset entire checklist file at once
Edit({
  file_path: 'games/${gameId}/checklists/phase-1-checklists.md',
  old_string: '[✅]',
  new_string: '[ ]',
  replace_all: true
});
```

**Note:** The `replace_all: true` parameter is the most efficient way to reset all checkboxes in a file.

### Verification Speed

**Optimization:** For phases where no code changes were made, verification can be faster:

- Phase 1 edit → Only verify Phase 1
- Phase 2 edit → Verify Phase 1 + Phase 2 (Phase 1 might be affected)
- Phase 3 edit → Verify Phase 1 + Phase 2 + Phase 3 (earlier phases might be affected)

**But:** Always verify sequentially, don't skip phases.

---

## Error Handling

### If Verification Fails

**If any checklist item is `[❌]`:**

1. **STOP** - Do not proceed to next phase
2. **Fix immediately** using `Edit` tool
3. **Re-verify** the fixed item
4. **Continue** only when all items are `[✅]`

### If Checklist File Missing

**If checklist file doesn't exist:**

- Create it with all items as `[ ]`
- Then proceed with verification

### If Game File Missing

**If game file doesn't exist:**

- This is a critical error
- Cannot verify any phase
- Must recreate from Phase 1

---

## User Communication

### When Reset Happens

**Claude should inform user:**

```
"Making requested change. Re-verifying all checklists up to Phase 3 to ensure nothing broke."
```

### During Verification

**Claude can show progress:**

```
"Re-verifying Phase 1... ✅
Re-verifying Phase 2... ✅
Re-verifying Phase 3... ✅
All checklists verified. Edit complete."
```

### If Issues Found

**Claude should report:**

```
"Found issue in Phase 1: Package loading order incorrect. Fixing now...
Fixed. Re-verifying...
All checklists verified. Edit complete."
```

---

## Integration Points

This strategy integrates with:

1. **CLAUDE.md** - Checklist Workflow section (lines 136-149)
2. **workflows/phase-2-validation.md** - Edit handling (lines 77-126)
3. **workflows/phase-3-feedback.md** - Edit handling
4. **workflows/phase-4-registration.md** - Edit handling
5. **workflows/phase-5-testing.md** - Edit handling
6. **reference/file-operations.md** - Edit patterns (lines 115-248)

Each workflow file should reference this strategy when edits are requested.
