# Phase 1 Content Validation Checklist - Game Data Integrity

## When to Use

**MANDATORY for Phase 1 completion** - Verify generated game content produces valid mathematical results.

## Critical Rule

⚠️ **All generated options and combinations must be mathematically valid**

## Checklist Items

**Output and verify content validation checklist:**

```
📋 Phase 1 Content Validation Checklist - Game Data Integrity:

[ ] Runtime content integration (postMessage listener, game_ready signal, fallback data)
[ ] Game content validation (generated options and combinations can produce correct answers)
```

**Process and verify checklist item, then output verified checklist:**

```
📋 Phase 1 Content Validation Checklist - VERIFIED:

[✅/❌] Runtime content integration (postMessage listener, game_ready signal, fallback data)
[✅/❌] Game content validation (generated options and combinations can produce correct answers)
```

## Runtime Content Integration

**MANDATORY verification for ALL games:**

**postMessage Integration:**
- [ ] Listens for 'game_init' message with content
- [ ] Sends 'game_ready' signal after package loading
- [ ] Fallback content defined for local testing
- [ ] waitForContent() function with 3-second timeout
- [ ] Extracts ALL config variables from content (totalQuestions, retryAllowed, timerType, startTime, starThresholds, questions)

**Content Extraction:**
- [ ] Game state initialized with runtime config
- [ ] Questions array from content (not hardcoded)
- [ ] Timer config from content (if timer used)
- [ ] Star thresholds from content
- [ ] Retry settings from content
- [ ] Uses nullish coalescing for defaults

**Testing:**
- [ ] Works locally with fallback data (open file:// directly)
- [ ] Works on platform with runtime content (receives postMessage)
- [ ] Console logs show content received
- [ ] Game uses runtime config (not hardcoded values)

## Game Content Validation

**MANDATORY verification for each round:**

**Mathematical correctness:**
- [ ] All math problems have mathematically correct answers
- [ ] Multiple choice options include the correct answer
- [ ] Generated combinations produce valid mathematical results
- [ ] No calculation errors in problem generation

**Data integrity:**
- [ ] All required fields populated (question, options, answer)
- [ ] No empty strings or null values
- [ ] Data types are correct (numbers for math answers)
- [ ] Consistent formatting across all rounds

**Option validation:**
- [ ] Generated options can mathematically produce the correct answer
- [ ] Option combinations are valid (e.g., no impossible number combinations)
- [ ] All options follow the same mathematical rules/structure
- [ ] Correct answer exists within generated option set

**Verification process:**
- [ ] Manually solve each generated problem with given options
- [ ] Confirm correct answer can be reached using provided options
- [ ] Verify mathematical validity of all option combinations
- [ ] Check for any impossible or invalid option combinations

## Mathematical Validation Examples

**For arithmetic problems:**
- [ ] Addition: Options don't result in negative numbers when positive expected
- [ ] Subtraction: Minuend ≥ subtrahend for positive results
- [ ] Multiplication: Valid number combinations
- [ ] Division: No division by zero, clean decimal results

**For fraction problems:**
- [ ] Denominators are non-zero
- [ ] Fractions are properly reduced or equivalent
- [ ] Mixed numbers are correctly formed
- [ ] Decimal equivalents are accurate

**For word problems:**
- [ ] Numbers in problem match option ranges
- [ ] Units are consistent (e.g., all length in meters)
- [ ] Context makes mathematical sense

## Data Structure Validation

**Question format:**
- [ ] Clear, unambiguous wording
- [ ] All variables/numbers properly defined
- [ ] Grammatically correct
- [ ] No spelling errors in mathematical terms

**Options format:**
- [ ] Consistent format (all fractions, all decimals, etc.)
- [ ] Reasonable range of values
- [ ] No duplicate options
- [ ] Correct answer clearly distinguishable

**Answer validation:**
- [ ] Single correct answer exists
- [ ] Answer format matches question type
- [ ] Mathematically equivalent to correct calculation
- [ ] Consistent with game rules

## Anti-Patterns (DO NOT USE)

**Invalid option combinations:**
```javascript
// ❌ WRONG - Impossible arithmetic
options: [5, 10, 15, 25]  // Can't make 7 with these numbers

// ❌ WRONG - Division by zero possible
problem: "Divide by x", options: [0, 1, 2, 3]

// ❌ WRONG - Negative results in positive context
problem: "How many apples?", options: [-1, 0, 1, 2]
```

**Data integrity issues:**
```javascript
// ❌ WRONG - Empty fields
question: "",
options: ["", "2", "3", "4"],
answer: null

// ❌ WRONG - Type mismatches
question: "What is 2 + 3?",
options: ["5", "six", "7", "8"],  // Mixed types
answer: "5"  // String instead of number
```

## Verification Process

**Manual testing:**
- [ ] Generate multiple game instances
- [ ] Solve each problem manually
- [ ] Verify all options are reachable
- [ ] Confirm correct answer is included
- [ ] Check for consistent formatting

**Automated validation:**
- [ ] Run game in different configurations
- [ ] Verify no runtime errors from invalid data
- [ ] Check that all options parse correctly
- [ ] Ensure answer validation works

## Final Verification

**Content Testing:**
- [ ] Play through entire game manually
- [ ] Verify each question can be solved with generated options
- [ ] Confirm all option combinations produce mathematically valid results
- [ ] Ensure generated content doesn't create impossible combinations

**Data Integrity Testing:**
- [ ] Check all questions have valid content
- [ ] Verify all options are properly formatted
- [ ] Confirm answers are mathematically correct
- [ ] Test edge cases and boundary conditions

**Checklist Completion:**
- [ ] Game content validation completed (generated options can produce correct answers)
- [ ] All mathematical problems are solvable
- [ ] Data integrity is maintained
- [ ] No impossible option combinations exist

## Reference

- Phase 1 workflow: [phase-1-core-gameplay.md](../phase-1-core-gameplay.md)
- Error messages: [error-messages.md](../../reference/error-messages.md)
