# Phase 0 Checklist Template

This template is used for Phase 0 - New Game Metadata Collection.

## User Requirements Checklist

```markdown
📋 Phase 0 - User Requirements

Game Identity:
[ ] Game title defined
[ ] Game description written (1-2 sentences)
[ ] Educational concepts identified
[ ] Target subject/topic clear

Game Configuration:
[ ] Target grades defined (min and max)
[ ] Difficulty level chosen (easy/medium/hard)
[ ] Estimated time per session defined
[ ] Game type selected (assessment/practice/drill/challenge)

Game Architecture:
[ ] Timer requirement determined (increase/decrease/none)
[ ] Lives system defined (if applicable)
[ ] Retry option determined (yes/no)
[ ] Star system defined (if applicable)
[ ] Custom mechanics identified (if any)
```

## Pattern Requirements Checklist (Internal)

```markdown
📋 Phase 0 - Pattern Requirements

[ ] Game ID generated (game_timestamp_random)
[ ] Game directory created (games/{gameId})
[ ] Checklists directory created (games/{gameId}/checklists)
[ ] metadata.json created with version 0.0.0, current_phase "phase-0"
[ ] Phase 0 checklist written to disk
[ ] All metadata collected and validated
[ ] User confirmed metadata before Phase 1
[ ] Files uploaded to CDN via upload_game_folder
```

## Verification Steps

Before requesting approval:

1. **All metadata fields collected:**
   - Title (string)
   - Description (string, 1-2 sentences)
   - Concepts (array of strings)
   - minGrade, maxGrade (numbers)
   - difficulty (easy | medium | hard)
   - estimatedTime (seconds)
   - type (assessment | practice | drill | challenge)

2. **Architecture decisions made:**
   - timerType (increase | decrease | none)
   - timerStart (number, starting seconds)
   - lives.enabled (boolean)
   - lives.startingCount (number, 0 if disabled)
   - retryAllowed (boolean)
   - starSystem.enabled (boolean)
   - starSystem.thresholds (object with 1, 2, 3 keys)
   - customMechanics (array, empty if none)

3. **Files created:**
   - games/{gameId}/metadata.json
   - games/{gameId}/checklists/phase-0-checklist.md

4. **Files uploaded to CDN:**
   - metadata.json
   - checklists/phase-0-checklist.md

5. **User approval received**

## Example Filled Checklist

```markdown
📋 Phase 0 - User Requirements

Game Identity:
[✅] Game title defined: Fraction Addition Challenge
[✅] Game description written: Students practice adding fractions with visual aids and immediate feedback
[✅] Educational concepts identified: fractions, addition, equivalent-fractions
[✅] Target subject/topic clear

Game Configuration:
[✅] Target grades defined: 3-5
[✅] Difficulty level chosen: easy
[✅] Estimated time per session defined: 5 minutes
[✅] Game type selected: practice

Game Architecture:
[✅] Timer requirement determined: increase
[✅] Lives system defined: No
[✅] Retry option determined: Yes
[✅] Star system defined: Yes (3★: 100%, 2★: 70%, 1★: 50%)
[✅] Custom mechanics identified: None

📋 Phase 0 - Pattern Requirements

[✅] Game ID generated: game_1234567890_abc123
[✅] Game directory created: games/game_1234567890_abc123
[✅] Checklists directory created: games/game_1234567890_abc123/checklists
[✅] metadata.json created with version 0.0.0, current_phase "phase-0"
[✅] Phase 0 checklist written to disk
[✅] All metadata collected and validated
[✅] User confirmed metadata before Phase 1
[✅] Files uploaded to CDN via upload_game_folder
```

## Common Issues

**Missing Required Fields:**
- Ensure all fields in metadata.json are populated
- Check that grades are numbers (not strings)
- Validate estimatedTime is in seconds (not minutes)

**Invalid Values:**
- difficulty must be: "easy", "medium", or "hard"
- type must be: "assessment", "practice", "drill", or "challenge"
- timerType must be: "increase", "decrease", or "none"

**Architecture Conflicts:**
- If type is "assessment", typically retryAllowed should be false
- If type is "practice", retryAllowed should be true
- If timerType is "decrease", timerStart must be > 0
- If timerType is "increase", timerStart should be 0 (starts counting from 0)

## Reference

- [Phase 0 Workflow](../phase-0-new-game.md)
