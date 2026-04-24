# Skill: Final Review

## Purpose

Compare the built game against the original spec and issue APPROVED or REJECTED. This is the last gate before deployment.

## When to use

After visual-review passes. The game HTML exists and has passed testing. This skill validates the GAME against the SPEC -- it does not validate the spec itself (that is `spec-review.md`).

## Owner

**Maintainer:** Gen Quality slot
**Deletion trigger:** When an automated spec-compliance scorer replaces manual review with equivalent coverage.

## Priority

See Constraints section -- each rule is marked CRITICAL, STANDARD, or ADVISORY.

## Reads

- `games/<gameId>/spec.md` -- the canonical spec this game was built from -- **ALWAYS**
- `games/<gameId>/pre-generation/` -- game-flow.md, screens.md, round-flow.md, feedback.md, scoring.md (cross-check visual layout and interaction intent) -- **ALWAYS** (if directory exists)
- `skills/data-contract.md` -- recordAttempt fields, gameState schema, game_complete schema -- **ON-DEMAND** (only for contract compliance checks in Functionality)
- `skills/pedagogy/SKILL.md` -- Bloom-to-game mapping -- **ON-DEMAND** (only when checking feedback and scoring alignment)

## Input

1. **Game HTML** -- the built `index.html` file
2. **Spec** -- the original `spec.md` the game was built from (already in session context from earlier pipeline steps)
3. **Pre-generation docs** -- if present, used for cross-checking

## Output

A structured review result with score, issues, and verdict. Exact format:

```
SCORE: <N>%
ISSUE: [critical] <description>
ISSUE: [warning] <description>
VERDICT: APPROVED
```

or

```
SCORE: <N>%
ISSUE: [critical] <description>
ISSUE: [warning] <description>
VERDICT: REJECTED
```

Rules:
- SCORE is an integer 0-100 representing spec compliance percentage.
- Every issue is one line starting with `ISSUE:` followed by `[critical]` or `[warning]`.
- VERDICT is exactly `APPROVED` or `REJECTED` on its own line.
- APPROVED requires: SCORE >= 90% AND zero critical issues.
- REJECTED requires: SCORE < 90% OR any critical issue exists.

---

## Procedure

### Step 1: Spec Compliance (static)

Read the spec. Read the game HTML source. Check every spec requirement against the implementation.

| # | Check | What to verify |
|---|-------|----------------|
| S1 | **Game mechanics** | Interaction type matches spec (MCQ, drag-drop, number input, etc.). Rules work as specified. |
| S2 | **Scoring system** | Points per correct/wrong match spec. Star thresholds match spec values (or pipeline defaults if spec was silent). |
| S3 | **Round/level structure** | Correct number of rounds. Stages exist with specified difficulty progression. |
| S4 | **Lives/attempts** | Lives count matches spec. Game-over triggers at correct point. No-lives games have no game-over screen. |
| S5 | **Content** | Questions, answers, distractors present. Content matches spec samples or follows the spec's generation rules. |
| S6 | **Visual theme** | Colors, layout, styling match spec requirements. If spec says "blue header" the header is blue. |
| S7 | **Feedback** | Correct-answer and wrong-answer feedback match spec. FeedbackManager used (not custom overlays). |

For each check: if spec is silent and the pipeline default was applied, that is not a failure -- verify the default is correctly implemented.

**Positive example:** Spec says "3 lives, game over at 0." Game shows 3 hearts, game-over screen appears after 3 wrong answers. S4 = PASS.

**Negative example:** Spec says "9 rounds in 3 stages (3-3-3)." Game has 9 rounds but no stage transitions, all same difficulty. S3 = critical issue.

### Step 2: Functionality (Playwright)

Open the game in Playwright and complete a full playthrough. This is not optional -- static HTML reading is insufficient.

| # | Check | What to verify |
|---|-------|----------------|
| F1 | **End-to-end playthrough** | Start screen -> answer all rounds -> results screen. No dead ends. |
| F2 | **All game states** | Start, gameplay, results, game-over (if lives), replay (if supported) all function. |
| F3 | **Console errors** | Zero errors in console. Warnings are acceptable but note them. |
| F4 | **Scoring accuracy** | Track correct/wrong answers during playthrough. Results screen score matches manual count. |
| F5 | **Results screen** | Shows correct data: score, stars, performance summary. game_complete postMessage fires with correct payload. |
| F6 | **Wrong-answer path** | Deliberately answer wrong. Feedback appears. Lives decrement (if applicable). Game-over triggers at correct point. |
| F7 | **Replay** | If replay button exists, click it. Game resets cleanly -- no leaked state from previous round. |

**Positive example:** Play through, answer 7/9 correct. Results screen shows "7/9" and 2 stars (matching 66%-89% threshold). Console has zero errors. F1-F5 = PASS.

**Negative example:** Click "Start" button, nothing happens. Game stays on start screen. F1 = critical issue (dead end at start).

### Step 3: Quality

Assess production-readiness during the Playwright playthrough.

| # | Check | What to verify |
|---|-------|----------------|
| Q1 | **Professional appearance** | No placeholder text, no broken layouts, no clipped content. |
| Q2 | **Smooth experience** | Transitions are not jarring. No flicker between states. Feedback timing feels natural. |
| Q3 | **Responsive** | Test at mobile viewport (375x667). All content visible, touch targets >= 44px, no horizontal scroll. |
| Q4 | **No bugs or glitches** | No visual artifacts, no stuck states, no duplicate elements appearing. |

### Step 4: Static validation gate (HARD)

Before scoring, run `node lib/validate-static.js <game-html-path>`. If exit code ≠ 0:

- The game is **REJECTED** regardless of any other signal.
- Emit each error line from the validator as its own `ISSUE: [critical]` entry.
- Include `SCORE` if you still wish, but the verdict is pinned to REJECTED.
- Enter Step 5 (Rejection Fix Loop).

This gate exists to catch violations introduced AFTER Step 5 — Step 6's test-and-fix and Step 7's visual-review both mutate the file, and this is the one opportunity to catch any rule-breaking change they committed (boundary violations, drifted options, preview-screen invariants, duplicate lives UI, etc.). See `alfred/skills/game-building/reference/static-validation-rules.md` for the rule table.

### Step 5: Score and Verdict

Count results across all checks (S1-S7, F1-F7, Q1-Q4 = 18 checks total).

Scoring formula:
- Each check is worth equal weight (100% / 18 checks).
- A failed check scores 0. A passed check scores full weight. A warning scores half weight.
- Round to nearest integer.

Verdict:
- **APPROVED** if SCORE >= 90% AND zero critical issues AND `node lib/validate-static.js` exited 0.
- **REJECTED** if SCORE < 90% OR any critical issue OR static validation failed.

Emit the output in the exact format specified in the Output section.

### Step 6: Rejection Fix Loop

If REJECTED, the pipeline runs a fix-then-re-review loop (up to 2 attempts).

**Attempt flow:**
1. Pipeline sends the rejection reasons and issue list to the builder agent.
2. Builder reads the game HTML, fixes every issue (critical first, then warnings).
3. Builder verifies fixes using Playwright -- opens game, tests flagged areas, screenshots, checks console.
4. Builder verifies fixes using `node lib/validate-static.js <game-html-path>` -- exit code must be 0.
5. Builder reports what changed and confirms each issue is addressed.
6. Pipeline sends the fixed game back to this skill for **re-review**.

**Re-review procedure:**
1. Open the fixed game in Playwright. Complete full playthrough.
2. Verify every previously-reported issue is now resolved.
3. Check for regressions -- new issues introduced by the fixes.
4. Re-run spec compliance checks.
5. Re-run `node lib/validate-static.js` -- exit 0 required to proceed to APPROVED.
6. Emit SCORE, ISSUE lines, and VERDICT in the same format.

**After 2 failed attempts:** Pipeline stops. Game remains REJECTED. All issues are logged for diagnosis.

**Positive example:** First review rejects with `ISSUE: [critical] Results screen shows 0/0 instead of actual score`. Fix attempt corrects the scoring display. Re-review confirms score renders correctly, no regressions. VERDICT: APPROVED.

**Negative example:** First review rejects with 3 critical issues. Fix attempt addresses 2 but introduces a new console error. Re-review still finds 2 critical issues. Second fix attempt partially works but replay is now broken. After 2 attempts, game stays REJECTED.

---

## Constraints

1. **CRITICAL -- Never APPROVE a game with a broken playthrough.** If you cannot complete start-to-results in Playwright, the game is REJECTED regardless of score. A game that cannot be played cannot ship.

2. **CRITICAL -- Never APPROVE a game with console errors.** Console errors mean something is broken in a way the user may encounter. Zero tolerance.

3. **CRITICAL -- Always do a Playwright playthrough.** Static HTML reading is not a review. You must open the game, click through it, and observe behavior. Skipping Playwright is a skill violation.

   **Bad:** Reading index.html, seeing a results div exists, marking F1 as PASS.
   **Good:** Opening in Playwright, clicking Start, answering rounds, reaching results screen, marking F1 as PASS.

4. **CRITICAL -- Always run `node lib/validate-static.js` before APPROVED.** Playwright catches runtime bugs; the static validator catches contract and boundary violations that runtime may not surface (preview-private DOM reach-ins, drifted show() options, duplicate lives UI, etc.). A passing Playwright run plus exit-1 static validation = REJECTED.

   **Bad:** "Full playthrough works, 95% spec compliance, VERDICT: APPROVED" — without ever running the static validator.
   **Good:** "Playwright playthrough complete. `node lib/validate-static.js games/my-game/index.html` → exit 0. SCORE 95%. VERDICT: APPROVED."

4. **CRITICAL -- Never APPROVE if a spec requirement is missing from the game.** If the spec says "3 stages with increasing difficulty" and the game has flat difficulty, that is a critical issue even if the game otherwise works perfectly.

5. **STANDARD -- Test the wrong-answer path, not just the happy path.** Many bugs hide in error handling: wrong feedback, lives not decrementing, game-over not triggering.

   **Bad:** Answering all questions correctly, seeing results, marking APPROVED.
   **Good:** Answering some wrong, verifying feedback, lives, and game-over behavior, then answering correctly to also verify the happy path.

6. **STANDARD -- Score honestly.** Do not inflate scores to pass a game or deflate scores to fail one. Each check is PASS or FAIL based on observable behavior.

7. **STANDARD -- Report all issues, not just the first one.** The fix loop needs the complete list. Finding one critical issue and stopping wastes a fix attempt.

8. **ADVISORY -- Note warnings even on APPROVED games.** A game can be APPROVED with warnings (non-critical polish issues). Document them so the UI/UX slot can pick them up.

## Defaults

When the spec is silent on a parameter and the pipeline applied a default, verify the default is correctly implemented -- do not flag it as a missing spec requirement.

| Parameter | Pipeline Default | Verify |
|-----------|-----------------|--------|
| Star thresholds | 90% / 66% / 33% | Results screen awards stars at these breakpoints |
| Lives | 0 (L1-L2) or 3 (L3+) | Lives display matches Bloom-level default |
| Timer | None | No timer element visible |
| Round count | 9 (3 per stage) | 9 rounds play in sequence |
| Feedback style | playDynamicFeedback + show correct answer | FeedbackManager fires, correct answer shown after wrong |

## Anti-patterns

### 1. Approving based on HTML source alone

**Bad:** Reading the HTML, seeing all the right div IDs and class names, marking APPROVED without ever opening the game. The div exists but its click handler throws an error -- invisible without Playwright.

**Good:** Opening in Playwright, clicking every interactive element, observing actual behavior.

### 2. Rejecting for cosmetic issues only

**Bad:** SCORE: 72%, VERDICT: REJECTED because "button color is slightly different shade of blue than spec says." Cosmetic deviations that do not affect usability are warnings, not critical issues.

**Good:** Flagging as `ISSUE: [warning] Button color #3B82F6 does not match spec's #2563EB` and scoring Q1 as half credit. Game can still be APPROVED if all functional checks pass.

### 3. Stopping at the first failure

**Bad:** Finding that the start button is broken, immediately emitting VERDICT: REJECTED with one issue. The fix loop gets one issue, fixes it, re-review finds 4 more issues.

**Good:** Noting the start button failure, attempting to navigate around it (direct URL, manual DOM interaction), and cataloging as many issues as observable before emitting the verdict.

### 4. Ignoring the wrong-answer path

**Bad:** Answering all questions correctly. Game works. APPROVED. Meanwhile, wrong answers show no feedback and lives never decrement.

**Good:** Deliberately answering 2-3 questions wrong. Verifying feedback appears, lives decrement, and game-over triggers at the right point.

### 5. Passing a re-review without checking for regressions

**Bad:** Previous review found broken scoring. Fix applied. Re-review only checks scoring -- marks APPROVED. Meanwhile the fix broke the replay button.

**Good:** Re-review checks the specific fix AND does a full playthrough to catch regressions.

---

## What This Skill Does NOT Check

These are upstream or parallel concerns handled by other skills or pipeline stages:

- **Spec quality** -- checked by `spec-review.md` before building
- **CDN package compatibility** -- checked at build time by `validate-static.js`
- **Test pass rate** -- checked by `game-testing.md` during the test loop
- **Data contract schema** -- checked by `validate-contract.js` during build
- **Detailed UI/UX audit** -- checked by UI/UX slot post-approval (visual polish, accessibility, interaction design depth)
- **Educational effectiveness** -- checked by Education slot (whether the game teaches well is beyond this skill's scope)
