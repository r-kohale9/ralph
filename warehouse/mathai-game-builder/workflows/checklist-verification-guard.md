# Checklist Verification Guard

**MANDATORY GUARDRAIL**: Runs before each Claude response to verify complete checklist coverage.

## Overview

This guard ensures that appropriate checklists exist and are properly completed for ALL phases up to the current phase. It runs automatically before each Claude response to guarantee workflow integrity and prevent incomplete work from proceeding.

## Trigger Conditions

**Executes before EVERY Claude response:**
- When responding to user messages
- When transitioning between phases
- When providing phase completion updates
- When requesting user approval

## Message Logging (MANDATORY)

**Log every system check to ensure workflow compliance:**

```javascript
// Log checklist verification attempt
logMessage({
  intent: "SYSTEM_CHECK",
  phase: currentPhase,
  workflowStep: "checklist_verification_guard",
  context: `Verifying checklist completion for Phase ${currentPhase}`,
  userMessage: "(automated checklist verification)",
  response: verificationResult ? "Checklists verified - proceeding" : "Checklists incomplete - blocking response",
  checklistStatus: verificationSummary
});
```

**Purpose:** Tracks all workflow verification attempts and blocks.

## Comprehensive Checklist Verification

### Phase 1 Checklists (MANDATORY)
**Location:** `games/{gameId}/checklists/`

**Main Checklist:**
- `phase-1-checklists.md` - User requirements + Skill pattern requirements

**Sub-Checklists (Created During Execution):**
- `phase-1-metrics-checklist.md` - End-of-game metrics logging verification
- `phase-1-content-validation-checklist.md` - Game data integrity verification
- `phase-1-code-validation-checklist.md` - Function and code integrity verification

### Phase 2 Checklists (If Phase 2+ Reached)
**Main Checklist:**
- `phase-2-checklist.md` - User requirements + Skill pattern requirements

### Phase 3 Checklists (If Phase 3+ Reached)
**Main Checklist:**
- `phase-3-checklist.md` - User requirements + Skill pattern requirements

**Special Files:**
- `feedback-plan.md` - Feedback plan iterations and audio mappings

### Phase 4 Checklists (If Phase 4+ Reached)
**Main Checklist:**
- `phase-4-checklist.md` - User requirements + Skill pattern requirements

### Phase 5 Checklists (If Phase 5+ Reached)
**Main Checklist:**
- `phase-5-checklist.md` - User requirements + Skill pattern requirements

## Verification Process

### 1. Current Phase Assessment
**Determine verification scope:**
- Get current phase from session state
- Verify checklists exist for ALL phases up to current phase
- Check completion status of all relevant checklists

### 2. File Existence Check
**For current phase, verify all required files exist:**

**Phase 1 Required Files:**
```
✅ phase-1-checklists.md
✅ phase-1-metrics-checklist.md
✅ phase-1-content-validation-checklist.md
✅ phase-1-code-validation-checklist.md
```

**Phase 2 Required Files:**
```
✅ phase-1-checklists.md + Phase 1 sub-checklists
✅ phase-2-checklist.md
```

**Phase 3 Required Files:**
```
✅ Phase 1 + 2 files
✅ phase-3-checklist.md
✅ feedback-plan.md
```

**Phase 4 Required Files:**
```
✅ Phase 1-3 files
✅ phase-4-checklist.md
```

**Phase 5 Required Files:**
```
✅ Phase 1-4 files
✅ phase-5-checklist.md
```

### 3. Checklist Format Validation

**Each checklist must follow proper structure:**

**Main Checklists Format:**
```markdown
# Phase {N} Checklists

## User Requirements Checklist
- [✅] Requirement 1 - [Completion note]
- [✅] Requirement 2 - [Completion note]
- [ ] Incomplete item - [Explanation]

## Skill Pattern Requirements Checklist
- [✅] Technical requirement 1 - [Implementation details]
- [ ] Pending requirement - [Reason]
```

**Sub-Checklists Format:**
```markdown
# Phase 1 [Type] Checklist

## Checklist Items
- [✅] Item 1 - [Verification details]
- [✅] Item 2 - [Verification details]
```

### 4. Completion Status Verification

**Completion Rules:**
- **✅ Completed:** Items with green checkmark and completion note
- **❌ Incomplete:** Items without checkmark or explanation
- **Invalid:** Items without proper status markers

**Strict Requirements:**
- ALL checklist items must be either [✅] with notes OR [ ] with explanations
- No items may be left blank or without status
- Explanations required for any [ ] items

### 5. Quality Assurance Check

**Content Validation:**
- Completion notes must reflect actual work done
- Explanations for incomplete items must be specific and actionable
- Checklists must accurately represent current project state
- No false positives (items marked complete when not actually done)

## Blocking Conditions

**REJECT response if:**

1. **Missing Checklists:** Any required checklist file doesn't exist for current phase
2. **Malformed Checklists:** Files exist but don't follow required format
3. **Incomplete Coverage:** Some phase checklists exist but others are missing
4. **Blank Items:** Any checklist item lacks proper [✅] or [ ] status
5. **Missing Explanations:** [ ] items without detailed explanations
6. **Quality Issues:** Checklists don't accurately reflect project state

## Response Formats

### ✅ Verification Passed
```
✅ Checklist Verification Complete

**Current Phase:** {N}
**Verified Checklists:** {count} files
**Completion Status:** All checklists properly filled
**Status:** Ready to provide response
```

### 🚫 Verification Failed - Missing Files
```
🚫 BLOCKED: Checklists not created for current phase

**Current Phase:** {N}
**Missing Files:**
- games/{gameId}/checklists/{filename1}
- games/{gameId}/checklists/{filename2}

**Action Required:**
1. Create missing checklist files
2. Populate with appropriate checklist items
3. Ensure proper format and completion status

Cannot provide response until all checklists are created.
```

### 🚫 Verification Failed - Incomplete Checklists
```
🚫 BLOCKED: Checklists incomplete for current phase

**Current Phase:** {N}
**Issues Found:**
- {filename}: {X} incomplete items
- {filename}: Missing explanations for incomplete items

**Incomplete Items:**
- [ ] {item description} - Missing explanation
- [ ] {item description} - Missing explanation

**Action Required:**
1. Complete all checklist items or provide explanations
2. Ensure all [ ] items have detailed explanations
3. Verify all [✅] items accurately reflect completed work

Cannot provide response until checklists are properly completed.
```

### ⚠️ Verification Failed - Quality Issues
```
⚠️ BLOCKED: Checklist quality issues detected

**Current Phase:** {N}
**Quality Issues:**
- Checklists don't match actual project state
- Completion notes are inaccurate
- Missing critical requirements

**Action Required:**
1. Review checklist accuracy against actual work
2. Update completion notes to reflect reality
3. Add any missing requirements
4. Ensure checklists represent current project state

Cannot provide response until quality issues are resolved.
```

## Integration Points

### Pre-Response Guard
- Runs before every Claude response
- Blocks response if checklists are inadequate
- Provides clear guidance on required fixes
- Ensures workflow integrity at all times

### State Management
**Session state tracking:**
- `currentPhase`: Current development phase
- `checklistVerificationStatus`: Last verification result
- `checklistQualityScore`: Overall checklist completeness
- `missingChecklistFiles`: List of files that need creation

### Error Recovery
- **Missing files:** Guide creation with templates
- **Incomplete items:** Provide explanation templates
- **Quality issues:** Suggest specific improvements
- **Format errors:** Show correct format examples

## Usage in Workflow

1. **User Message Received:** Checklist verification guard activates
2. **Verification Check:** Validate all checklists for current phase
3. **Decision Point:**
   - ✅ **Pass:** Provide normal Claude response
   - 🚫 **Block:** Show blocking message with required actions
   - ⚠️ **Warn:** Allow response but note quality concerns
4. **Response Delivery:** Only occurs after verification success

This ensures that every interaction maintains complete checklist coverage and prevents workflow violations from going unnoticed.
