# Phase 2: Input Evaluation & Validation

This phase adds answer validation logic to the core gameplay created in Phase 1. The game will now be able to detect correct/incorrect answers and handle edge cases.

## Prerequisites

- Phase 1 completed and approved
- Game file exists at known location (e.g., `games/{gameId}/index.html`)
- Understanding of validation type needed (fixed/function/LLM)

## Workflow Steps

### Change Requests After Phase Approval

**MANDATORY WORKFLOW:** (Triggered automatically by [prompt-dispatch.md](prompt-dispatch.md) before you reach this section.)

1. **Analyze the new user prompt.** If it requests _any_ change after Phase 2 (or earlier phases) was approved, treat it as a change request.
2. **STOP** – do **not** touch game files yet.
3. **Reset every checklist up to Phase 2** so all `[✅]` become `[ ]` using `Edit` with `replace_all: true`.
4. **Then** make the requested edits.
5. **Re-verify** every reset checklist until each item returns to `[✅]`.
6. **Request approval** only after verification passes.

Run the full process in [checklist-reset-strategy.md](checklist-reset-strategy.md) before modifying any files.

```javascript
for (const file of ["phase-1-checklists.md", "phase-2-checklist.md"]) {
  Edit({
    file_path: `games/${gameId}/checklists/${file}`,
    old_string: "[✅]",
    new_string: "[ ]",
    replace_all: true
  });
}
```

> Skipping the reset step breaks the workflow. Only continue once all reset checklists show `[✅]` again.

### Step 0: Present Phase 2 Checklist (MANDATORY FIRST)

**Action:** Display Checklist 1 to the user BEFORE starting development. Checklist 2 is internal only (for Claude's verification).

**Checklist 1 - User Requirements (Present to user):**

```
📋 Phase 2 Checklist - User Requirements

Answer Requirements:
[ ] Phase 1 approved
[ ] Validation approach defined (exact match, multiple valid, subjective)
[ ] Correct answers/rules defined
[ ] Edge cases identified (spaces, case, punctuation, etc.)
[ ] Max attempts per question defined
[ ] Behavior after max attempts defined

Ready to start development? (Reply "start" to proceed)
```

**Checklist 2 - Skill Pattern Requirements (Internal - DO NOT show to user):**

```
📋 Phase 2 Checklist - Skill Pattern Requirements (Internal)

During development:
[ ] Validation logic implemented via Edit tool
[ ] Validation type chosen - VERIFY: Fixed/function/LLM appropriate for game type (see reference/validation-types.md)
[ ] **IF subjective/open-ended questions:** Use subjective evaluation - VERIFY: Package loaded, prompts defined, loading states implemented (see checklists/subjective-evaluation.md)
[ ] Correct/incorrect detection working - VERIFY: Returns boolean, handles edge cases
[ ] Edge cases handled - VERIFY: trim(), toLowerCase(), Number() conversion as needed (see reference/validation-types.md)
[ ] Attempts tracked - VERIFY: Structure includes questionNumber, question, userAnswer, correctAnswer (see reference/validation-types.md)
[ ] Attempts include metadata - VERIFY: correct (boolean), validationType, timestamp, responseTime
[ ] Response time tracked - VERIFY: Timestamp captured on submit, elapsed time calculated
[ ] Game analytics events integrated - VERIFY: All 7 events tracked at correct points (see components/game-analytics-events.md)
[ ] Validation feedback emits view events - VERIFY: correct/incorrect cell coloring, error messages, status text changes call `signalCollector.recordViewEvent('feedback_display', { screen, content_snapshot: { feedback_type, correct_cells, incorrect_cells, message } })` (see examples/signal-capture-patterns.md Pattern 9)
[ ] Signal data streams to GCS via batch flushing - VERIFY: signal data is NOT spread into game_complete postMessage. Only `signal_event_count` and `signal_metadata` from `seal()` are included (see examples/signal-capture-patterns.md Pattern 5)
```

**Wait for user "start" confirmation before proceeding to Step 0.5.**

---

### Step 0.5: Verify Local Files (AUTOMATIC)

**Action:** Verify local game files are up-to-date with CDN before making changes

**This step is MANDATORY when continuing work in a different chat session.**

```javascript
// 1. Read local metadata to get gameId
const localMeta = Read({
  file_path: `games/${gameId}/metadata.json`
});

// 2. Fetch CDN metadata
const cdnMeta = mathai-core:resource_manifest({
  gameId: gameId
});

// 3. Compare versions
if (cdnMeta.version > localMeta.version) {
  // CDN has newer version - download it
  // See game-resumption.md for download steps
}
```

**Status Messages:**

✅ **Local up-to-date:**

```
✅ Local files verified (v${localVersion})
Proceeding with Phase 2...
```

📥 **Downloading from CDN:**

```
📥 Updating from CDN (v${cdnVersion} > v${localVersion})
Downloaded ${fileCount} files
Proceeding with Phase 2...
```

**See:** [workflows/game-resumption.md](game-resumption.md) for complete verification workflow

**Write Phase 2 Checklists to Disk:**

- Retrieve the absolute game directory path from Phase 1 (store it in a variable such as `const gameDirectory = \`games/${gameId}\`` if you have not already)
- Ensure the checklist text reflects any dynamic items (e.g., additional answer requirements) before writing
- Persist BOTH checklists exactly as shown above using `Write tool`

```javascript
const gameDirectory = `games/${gameId}`; // reused from Phase 1

Bash({command: "mkdir -p games/${gameId}/checklists", description: "Create checklists directory"}); // Note: adjusted
  path: `${gameDirectory}/checklists`,
});

Write({
  path: `${gameDirectory}/checklists/phase-2-checklist.md`,
  content: `📋 Phase 2 Checklist - User Requirements

Answer Requirements:
[ ] Phase 1 approved
[ ] Validation approach defined (exact match, multiple valid, subjective)
[ ] Correct answers/rules defined
[ ] Edge cases identified (spaces, case, punctuation, etc.)
[ ] Max attempts per question defined
[ ] Behavior after max attempts defined

📋 Phase 2 Checklist - Skill Pattern Requirements (Internal)

During development:
[ ] Validation logic implemented via Edit tool
[ ] Validation type chosen - VERIFY: Fixed/function/LLM appropriate for game type (see reference/validation-types.md)
[ ] **IF subjective/open-ended questions:** Use subjective evaluation - VERIFY: Package loaded, prompts defined, loading states implemented (see checklists/subjective-evaluation.md)
[ ] Correct/incorrect detection working - VERIFY: Returns boolean, handles edge cases
[ ] Edge cases handled - VERIFY: trim(), toLowerCase(), Number() conversion as needed (see reference/validation-types.md)
[ ] Attempts tracked - VERIFY: Structure includes questionNumber, question, userAnswer, correctAnswer (see reference/validation-types.md)
[ ] Attempts include metadata - VERIFY: correct (boolean), validationType, timestamp, responseTime
[ ] Response time tracked - VERIFY: Timestamp captured on submit, elapsed time calculated
`,
});
```

> Make sure all dynamic rows you surfaced to the user appear in the saved file. Update this file with `Edit tool` as items become `[✅]` or `[❌]` during verification.

**Checklist Communication Pattern:**

**TO USER (Simple status only):**

- ✅ "All checklist items completed" (when all ✅)
- ⏳ "Some checklist items remaining" (when any ❌ or [ ])

**INTERNAL (Detailed tracking with SPECIFIC details):**

- Create checklist file locally with `Write tool`
- Update with `Edit tool` as items complete
- Mark items: `[ ]` → `[✅]` (done) or `[❌]` (needs fix)
- **CRITICAL: When marking [✅], add SPECIFIC implementation details:**

**❌ BAD (Ambiguous):**

```
[✅] Validation approach defined (exact match)
[✅] Edge cases handled
```

**✅ GOOD (Specific, Verifiable):**

```
[✅] Validation: validateAnswer(userAnswer, correctAnswer) function with trim(), toLowerCase(), Number() conversion - returns boolean - VERIFIED against validation-types.md
[✅] Edge cases: String(userAnswer).trim().toLowerCase() handles whitespace and case - VERIFIED in code
[✅] Attempts: tracker.addAttempt({questionNumber, question, userAnswer, correctAnswer, correct:boolean, validationType:"fixed", timestamp, responseTime}) - VERIFIED structure
```

**Template for marking validation complete:**

```
[✅] Validation: functionName(params) with logic description - returns type - VERIFIED against checklist.md
[✅] Edge cases: specific handling (trim/lowercase/etc) - VERIFIED in code
[✅] Attempts: exact structure {field:type, field:type} - VERIFIED structure
```

- Verify ALL items `[✅]` before user notification
- Fix ALL `[❌]` items immediately

**NEVER show checklist marks to user. Only show simple status.**

---

### Step 1: Choose Validation Type

**Action:** Determine which validation approach is appropriate for the game

**Validation Types:**

1. **Fixed Answer** - One specific correct answer

   - Example: "What is 5 × 3?" → 15 (only this answer is correct)
   - Can be single value or array

2. **Function-Based** - Multiple different valid answers

   - Example: "Tap numbers that sum to 10" → [3,7], [6,4], [2,3,5] all valid
   - Any combination matching the rule is correct

3. **LLM-Based** - Subjective or open-ended answers
   - Example: "Explain why 12 is even"
   - Requires backend evaluation

**See:** [Answer Validation Types](../reference/validation-types.md) for complete details

**Decision Criteria:**

- Is there only one correct answer? → Fixed Answer
- Are there multiple valid answers following a rule? → Function-Based
- Is the answer subjective or requires interpretation? → LLM-Based

---

### Step 2: Read Metadata & Add Validation Logic

**Action:** Read metadata.json to get game info, then use `Edit tool` tool to add validation logic to existing game file

**First, read metadata:**

```javascript
Read({
  path: `games/${gameId}/metadata.json`,
});
// This gives you game_id, current version, and current phase
```

**IMPORTANT - File Access Pattern:**
For ALL iterations and edits after initial generation:

1. **To read the file**: Use `Read tool` tool
2. **To edit the file**: Use `Edit tool` tool
3. **NEVER** try to access files directly without filesystem tools

**Tool Call Pattern for Reading:**

```javascript
Read({
  path: "games/{gameId}/index.html", // Full absolute path from Phase 1
});
```

**Tool Call Pattern for Editing:**

```javascript
Edit({
  path: "games/{gameId}/index.html", // Full absolute path from Phase 1
  edits: [
    {
      oldText: "// TODO: Add validation",
      newText: "function validateAnswer(userAnswer, correctAnswer) { ... }",
    },
  ],
});
```

**Critical Rules Checklist:**

```
File Operations:
[ ] VERIFY: No regeneration of entire HTML
[ ] Use Read tool tool to read file before editing
[ ] Use Edit tool tool for ALL modifications/iterations
[ ] Use absolute path from Phase 1 (e.g., games/{gameId}/index.html for relative, $(pwd)/games/{gameId}/index.html for absolute MCP paths)
[ ] VERIFY: No relative paths or assumed working directory
[ ] VERIFY: No direct file access without filesystem tools

Validation Implementation:
[ ] Add validation function
[ ] Integrate with game logic
[ ] Handle edge cases (whitespace, case sensitivity, etc.)
[ ] Track attempts properly
```

**Common Errors:**

- "File not found" or "path doesn't exist" → You're trying to access files without `Read tool` or `Edit tool` tools
- "Failed to edit" → Use `Read tool` first to see current file content, then use `Edit tool`
- Always use the filesystem MCP tools with the **full absolute path** from Phase 1

**Implementation Checklist:**

```
Required Additions:
[ ] Add validation function
    [ ] Implement appropriate validation logic based on type
    [ ] Handle edge cases (trim, lowercase, etc.)
    [ ] Return isCorrect boolean

[ ] Add attempt tracking
    [ ] Track questionNumber
    [ ] Track question text
    [ ] Track userAnswer
    [ ] Track correctAnswer
    [ ] Track correct boolean
    [ ] Track validationType ("fixed" or "function" or "llm")
    [ ] Track timestamp
    [ ] Track responseTime

[ ] Add max attempts logic
    [ ] Track number of attempts per question
    [ ] Limit to reasonable number (e.g., 3 attempts)
    [ ] Move to next question after max attempts
```

**Example Implementations:**

1. **Validation Function:**

   ```javascript
   function validateAnswer(userAnswer, correctAnswer) {
     // Add appropriate validation logic based on type chosen in Step 1
     // Handle edge cases: trim, lowercase, etc.
     return isCorrect;
   }
   ```

2. **Attempt Tracking:**
   ```javascript
   tracker.addAttempt({
     questionNumber: currentQuestion,
     question: questionText,
     userAnswer: userAnswer,
     correctAnswer: correctAnswer,
     correct: isCorrect,
     validationType: "fixed", // or "function" or "llm"
     timestamp: Date.now(),
     responseTime: timeElapsed,
   });
   ```

**Example Edit:**

```javascript
// Add validation logic after user submits answer
Edit tool({
  path: `games/${gameId}/index.html`,
  edits: [{
    oldText: "// TODO: Add validation",
    newText: `function validateAnswer(userAnswer, correctAnswer) {
      const trimmed = String(userAnswer).trim();
      return Number(trimmed) === correctAnswer;
    }`
  }]
});

// Update metadata.json - increment version and update phase
Edit tool({
  path: `games/${gameId}/metadata.json`,
  edits: [{
    oldText: '"version": "0.0.1"',
    newText: '"version": "0.0.2"'
  }, {
    oldText: '"current_phase": "phase-1"',
    newText: '"current_phase": "phase-2"'
  }]
});

// Upload ALL files to CDN (CRITICAL: Do this automatically, don't ask user)
// Step 1: Get directory tree
const gameDirectory = `games/${gameId}`;
const treeResult = Glob({pattern: "**/*", path: `games/${gameId}`});

// Step 2: Manually list ALL files from tree result
const files = [
  { filePath: `${gameDirectory}/index.html`, targetPath: "index.html" },
  { filePath: `${gameDirectory}/metadata.json`, targetPath: "metadata.json" }
  { filePath: `${gameDirectory}/checklists/*`, targetPath: "checklists/*" }
];

// Step 3: If checklists directory exists in tree, add checklist files
// Check tree result - if you see checklists/phase-1-checklists.md, add:
// files.push({ filePath: `${gameDirectory}/checklists/phase-1-checklists.md`, targetPath: "checklists/phase-1-checklists.md" });
// files.push({ filePath: `${gameDirectory}/checklists/phase-2-checklist.md`, targetPath: "checklists/phase-2-checklist.md" });

// Step 4: Upload
mathai-core:upload_game_folder({
  gameId: gameId,
  files: files
});
```

**Verify if all files in game directory are uploaded to CDN (Including checklists and any other files)**

---

### Step 3: Verify Checklists (MANDATORY BEFORE NOTIFYING USER)

**Action:** Verify BOTH checklists are complete BEFORE notifying the user.

**Verification Process:**

1. Review modified code against both checklists
2. Update checklist status (✅ for complete, ❌ for missing)
3. If ANY item is ❌, fix immediately
4. Only proceed to Step 4 when ALL items are ✅

**Checklist 1 Verification - User Requirements:**

```
[✅/❌] Validation approach implemented correctly
[✅/❌] Correct answers/rules working
[✅/❌] Edge cases handled properly
[✅/❌] Max attempts per question enforced
[✅/❌] Behavior after max attempts working
```

**Checklist 2 Verification - Skill Pattern Requirements:**

```
[✅/❌] Validation logic implemented via Edit tool
[✅/❌] Validation type appropriate (fixed/function/LLM)
[✅/❌] Correct answers validated properly
[✅/❌] Incorrect answers detected properly
[✅/❌] Edge cases handled (trim whitespace, case-insensitive)
[✅/❌] Attempts array updated on each answer
[✅/❌] Attempt includes: questionNumber, question, userAnswer, correctAnswer
[✅/❌] Attempt includes: correct (boolean), validationType, timestamp
[✅/❌] Response time tracked
```

**If any item is ❌:**

```
Fix Checklist:
[ ] Fix issue immediately using Edit tool
[ ] Re-verify both checklists
[ ] Confirm all items are ✅ before proceeding
```

---

### Step 4: User Testing

**Action:** Instruct user to refresh Chrome to test validation updates

**Instructions to Provide:**

```
📁 File updated at: games/[gameId]/index.html

🌐 **Refresh Chrome to test updates:**
   1. Go back to file://$(pwd)/games/[gameId]/index.html in Chrome
   2. Press Cmd+Shift+R (hard refresh) to reload
   3. Test validation scenarios:
      - Answer question correctly → should show success
      - Answer incorrectly → should show error
      - Try edge cases (extra spaces, wrong case, etc.)
      - Exhaust max attempts → should move to next question
```

**What User Should Test:**

- Correct answers are validated properly
- Incorrect answers are detected
- Edge cases are handled (whitespace, case, etc.)
- Attempt tracking works
- Max attempts limit functions correctly
- No console errors

---

### Step 5: Request Approval

**Show ONLY checklist status and test URL:**

```
Claude: "Phase 2 complete!

🆔 Game ID: [gameId]
📦 Version: 0.0.2
🌐 Test: file://$(pwd)/games/[gameId]/index.html


📁 File updated at: games/[gameId]/index.html

🌐 **Refresh Chrome to test updates:**
   1. Go back to file://$(pwd)/games/[gameId]/index.html in Chrome
   2. Press Cmd+Shift+R (hard refresh) to reload
   3. Test validation scenarios:
      - Answer question correctly → should show success
      - Answer incorrectly → should show error
      - Try with extra spaces → should still work
      - Try wrong case (e.g., "ANSWER" vs "answer") → should match
      - Exhaust [X] attempts → should move to next question

Current Status:
1. [✓] Core Gameplay
2. [PENDING APPROVAL] Validations ← Please test
3. [ ] Feedback
4. [ ] Content Sets
5. [ ] Testing & Polish"

User: "Approved"
```

**Wait for explicit approval before Phase 3.**

---

## Critical Rules

### File Operations

1. **Use `Edit tool` for ALL modifications** (never regenerate entire HTML)
2. **Instruct user to refresh Chrome** to see updates (no artifact rendering needed)
3. **NO EXCEPTIONS**

### Validation Summary

- **Phase 2 MUST show validation summary** before requesting approval
- Include validation type, logic, edge cases, and attempt limits
- Provide clear testing instructions

### Testing Requirements

- User MUST refresh Chrome with Cmd+Shift+R (hard refresh)
- User MUST test all validation scenarios before approval
- Test correct answers, incorrect answers, and edge cases

---

## Reference

**Validation Type Details:**

- [Answer Validation Types](../reference/validation-types.md) - Complete guide to validation approaches

**Phase Documentation:**

- [Phase 1: Core Gameplay](./phase-1-core-gameplay.md) - Previous phase
- Phase 3: Feedback Integration - Next phase (coming soon)

**File Operations:**

- [File System Operations](../reference/file-operations.md) - How to use filesystem tools

---

## Next Phase

Once approved, proceed to Phase 3: Feedback Integration (see SKILL.md for details)
