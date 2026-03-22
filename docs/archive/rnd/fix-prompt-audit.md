# Fix Prompt Audit — Contradictory Instruction Report

**Date:** 2026-03-22
**Scope:** `buildFixPrompt()`, `buildGlobalFixPrompt()`, `buildTargetedFixPrompt()`, `buildTriagePrompt()`, `buildReviewPrompt()`, and supporting constants (`CDN_CONSTRAINTS_BLOCK`, `REVIEW_SHARED_GUIDANCE`, `LESSON_PATTERNS`)

**Methodology:** Same as the gen/test-gen prompt audits — look for POSITIVE instructions or examples that contradict prohibition rules, since positive examples have higher LLM attention weight than negative rules.

---

## Violations Found and Fixed

### VIOLATION 1 — CRITICAL: Wrong CDN domain taught as correct in `LESSON_PATTERNS`

**File:** `lib/pipeline-fix-loop.js` line 207

**Pattern matched:** `/cdn\.mathai\.ai|cdn\.homeworkapp\.ai.*404/i`

**What it said (WRONG):**
```
Lesson 38/26: CDN domain MUST be cdn.homeworkapp.ai — NEVER cdn.mathai.ai (404s).
```

**Why this is a contradiction:**
- `CDN_CONSTRAINTS_BLOCK` (prompts.js line 81) explicitly prohibits `cdn.homeworkapp.ai`: "NEVER cdn.homeworkapp.ai, cdn.mathai.ai, or any other domain"
- The correct CDN domain is `storage.googleapis.com/test-dynamic-assets`
- This lesson hint is injected into fix prompts when test failures mention either banned domain — meaning the fix LLM was being told "use cdn.homeworkapp.ai" (which is exactly one of the banned domains)
- Severity: CRITICAL. This lesson injection could cause the fix LLM to swap one wrong domain for another wrong domain rather than the correct one.

**Fix applied:**
```
Lesson 38/26: CDN domain MUST be storage.googleapis.com/test-dynamic-assets — NEVER cdn.mathai.ai or cdn.homeworkapp.ai (both 404/403). Fix: replace all CDN script src values with https://storage.googleapis.com/test-dynamic-assets/packages/{helpers,components,feedback-manager}/index.js
```

---

### VIOLATION 2 — REVIEW_SHARED_GUIDANCE says `onComplete` is required; CDN_CONSTRAINTS_BLOCK bans it

**File:** `lib/prompts.js` line 64 (`REVIEW_SHARED_GUIDANCE`, RULE-008)

**What it said (WRONG):**
```
- Reject if ANY transitionScreen.show() call is missing `await`, OR if onComplete callback is never wired, OR if transition routing is broken.
```

**Why this is a contradiction:**
- `CDN_CONSTRAINTS_BLOCK` line 111 explicitly bans `onComplete`: "NEVER use 'hasButton', 'buttonText', or 'onComplete' — these do not exist in the TransitionScreenComponent API"
- The review prompt includes `REVIEW_SHARED_GUIDANCE`, so the reviewer was told to REJECT games that don't wire `onComplete`
- The fix prompt includes `CDN_CONSTRAINTS_BLOCK`, so the fix LLM was told NEVER to use `onComplete`
- This creates an impossible situation: the reviewer rejects a compliant game for not using a banned API
- Severity: HIGH. Reviewer false-positives block otherwise correct games from passing.

**Fix applied (RULE-008 updated):**
```
- Reject if ANY transitionScreen.show() call is missing `await`, OR if transition routing is broken
  (onComplete does NOT exist in the TransitionScreenComponent API — use `buttons: [{ text, type, action }]`
  array instead; see CDN_CONSTRAINTS_BLOCK).
```

---

### VIOLATION 3 — Gen prompt rule 25 uses `onComplete` in both WRONG and RIGHT examples

**File:** `lib/prompts.js` lines 360–361 (gen prompt rule 25, `TRANSITIONSCREEN AWAIT`)

**What it said (WRONG):**
```
WRONG: transitionScreen.show({ ..., onComplete: () => { ... } });
RIGHT: await transitionScreen.show({ ..., onComplete: () => { ... } });
```

**Why this is a contradiction:**
- Both WRONG and RIGHT examples use `onComplete` — the only difference being `await`
- `CDN_CONSTRAINTS_BLOCK` line 111 bans `onComplete` entirely
- The gen prompt includes `CDN_CONSTRAINTS_BLOCK`, so these two sections contradict each other within the same prompt
- An LLM reading rule 25 sees `onComplete` used in the "RIGHT" example — a strong positive signal to use it
- Severity: HIGH. Positive examples override prohibition rules in LLM attention.

**Fix applied (rule 25 examples replaced):**
```
WRONG: transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });
RIGHT: await transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });
```

---

### VIOLATION 4 — CDN_CONSTRAINTS_BLOCK line 109 says `onComplete MUST set gameState.phase`

**File:** `lib/prompts.js` line 109 (CDN_CONSTRAINTS_BLOCK, `TransitionScreen ROUTING`)

**What it said (WRONG):**
```
- TransitionScreen ROUTING: every transitionScreen.show() onComplete MUST set gameState.phase to the correct next phase
```

**Why this is a contradiction:**
- `onComplete` is banned by line 111 of the same `CDN_CONSTRAINTS_BLOCK`
- This rule appeared 2 lines above the prohibition, giving the LLM a positive instruction followed by a negative one — positive wins
- Severity: HIGH. This was inside CDN_CONSTRAINTS_BLOCK itself, used by fix prompts.

**Fix applied:**
```
- TransitionScreen ROUTING: every transitionScreen.show() buttons[].action callback MUST set gameState.phase
  to the correct next phase (e.g. action: () => { gameState.phase = 'playing'; syncDOMState(); nextRound(); })
```

---

### VIOLATION 5 — Multiple `onComplete` references in gen prompt rule 21 and CLI gen prompt

**File:** `lib/prompts.js` lines 329 and 445

**What they said:**
- Rule 21: `transitionScreen.show() onComplete → gameState.phase = 'playing'; syncDOMState();`
- CLI gen: `transitionScreen onComplete, endGame (gameover + results paths)`

**Fix applied:** Both changed to use `buttons[].action callback` / `buttons.action callback` terminology.

---

## Violations NOT Found

- No `page.waitForTimeout(N)` positive examples in fix/triage/review prompts (test-gen prompt had these, already audited)
- No `#mathai-transition-slot` positive usage in fix prompts (only negative rules — correct)
- No `'game_over'` phase string teaching in fix prompts — all usages correctly distinguish endGame reason (`'game_over'`) from gameState.phase (`'gameover'`)
- No `CORRECT/WRONG` pairs where CORRECT uses a banned value
- `buildTriagePrompt` — clean, no contradictions
- `buildGlobalFixPrompt` — clean, just injects `CDN_CONSTRAINTS_BLOCK`
- `buildTargetedFixPrompt` — clean, just injects `CDN_CONSTRAINTS_BLOCK`
- `buildReviewPrompt` / `buildReReviewPrompt` — only had the RULE-008 `onComplete` issue (fixed above)

---

## Impact Assessment

| Violation | Prompt(s) Affected | Risk |
|-----------|-------------------|------|
| Wrong CDN domain in LESSON_PATTERNS | `buildFixPrompt` (lesson hints) | CRITICAL — fix LLM uses wrong CDN |
| RULE-008 `onComplete` required | `buildReviewPrompt`, `buildReReviewPrompt` | HIGH — false reviewer rejections |
| Rule 25 `onComplete` in RIGHT example | `buildGenerationPrompt`, `buildCliGenPrompt` | HIGH — gen LLM uses banned API |
| CDN_CONSTRAINTS_BLOCK `onComplete MUST` | All fix prompts, gen prompts | HIGH — internal contradiction |
| Rule 21 / CLI gen `onComplete` refs | Gen prompts | MEDIUM — ambiguous terminology |

---

## Test Results

`npm test` after all fixes: **637 tests pass, 0 failures**

## Commit

Changes committed to `lib/prompts.js` and `lib/pipeline-fix-loop.js`.
