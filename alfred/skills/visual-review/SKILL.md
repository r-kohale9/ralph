# Skill: Visual Review

## Purpose
Screenshot every game screen via Playwright MCP and audit layout, typography, touch targets, visual polish, game states, and accessibility against mobile constraints -- producing a pass/fail verdict with categorized issues.

## When to use
After game-testing passes. Before final review. Uses Playwright MCP to screenshot and visually audit every game screen.

## Owner
**Maintainer:** UI/UX slot (pipeline team).
**Deletion trigger:** Retire only if visual review is fully automated by a vision model with measured parity against this checklist, and all references in `game-testing.md` and `game-building.md` are removed.

## Reads
- `skills/mobile/SKILL.md` -- device constraints, touch targets, viewport, CSS variables -- ALWAYS
- `skills/feedback/SKILL.md` -- correct/incorrect feedback patterns, micro-animations, FeedbackManager API -- ALWAYS
- `skills/game-archetypes.md` -- archetype-specific layout expectations (e.g., grid games vs MCQ) -- ON-DEMAND
- `skills/data-contract.md` -- game_complete and recordAttempt schemas (verify results screen shows correct data) -- ON-DEMAND
- Game spec (`spec.md`) -- what the game should look like and do -- ALWAYS
- Pre-generation docs (`pre-generation/screens.md`, `pre-generation/game-flow.md`) -- intended layout and flow -- ON-DEMAND (if they exist)

## Input
- Path to `index.html` (the built game file)
- Game spec (loaded separately)
- Viewport dimensions (default: 375x667 from `mobile.md`)

## Output
A structured review block at the end of the response, in exactly this format:

```
VERDICT: APPROVED
```
or
```
VERDICT: NEEDS_FIX

ISSUE: [critical] Description of the problem — what screen, what element, what's wrong
ISSUE: [critical] Another critical issue
ISSUE: [warning] Lower-severity issue that should be improved
```

Rules:
- One `ISSUE` line per distinct problem. Never combine multiple problems into one line.
- `[critical]` = must fix before shipping (layout broken, unreadable text, untappable buttons, missing game state).
- `[warning]` = should fix, not blocking (color harmony, animation smoothness, minor spacing).
- `APPROVED` means zero `[critical]` issues. Warnings alone do not block approval.

## Procedure

### Step 1: Open and screenshot start screen
Open the game at `file://<path>/index.html` in Playwright MCP at 375x667 viewport. Take a full-page screenshot. Do not interact yet.

### Step 2: Audit layout and spacing (start screen)
Verify against the start screen screenshot:
- Content is horizontally centered within the game-wrapper (max-width 480px).
- No element overflows the viewport horizontally -- no horizontal scrollbar.
- Margins and padding are consistent (not cramped, not excessively spaced).
- The game title and start button are both fully visible without scrolling.
- The start button is in the lower 60% of the viewport (thumb zone per `mobile.md` Section 2).

### Step 3: Audit typography (start screen)
Verify against the start screen screenshot:
- Game title is visually prominent -- larger than body text, using heading hierarchy.
- Body text is readable at mobile size -- no text appears too small to read comfortably.
- Text has sufficient contrast against its background. Reference `mobile.md` Section 3 for `--mathai-*` color pairs that meet 4.5:1 WCAG AA.
- No text is truncated or clipped by its container.

### Step 4: Audit touch targets (start screen)
Verify against the start screen screenshot:
- The start/play button is clearly styled as interactive (looks tappable).
- Button appears at least 44px tall (reference `mobile.md` Section 2 for minimum sizing).
- If multiple buttons are visible, there is visible spacing between them (minimum 8px per `mobile.md`).

### Step 5: Play through to mid-gameplay and screenshot
Click the start button. Interact with the game until you reach a representative mid-gameplay state (e.g., question 2-3 of a quiz, a round in progress). Take a screenshot.

### Step 6: Audit layout and spacing (mid-gameplay)
Verify against the mid-gameplay screenshot:
- The question/prompt and all interactive elements are visible without scrolling.
- No content overflows horizontally.
- Progress indicator (if any) is visible and correctly positioned.
- The interactive area (options, input, drag targets) is in the lower 60% of the viewport.

### Step 7: Audit touch targets (mid-gameplay)
Verify against the mid-gameplay screenshot:
- All option buttons / interactive elements appear at least 44px tall.
- Spacing between adjacent options is visible (not flush).
- Buttons are clearly styled as tappable -- distinct from non-interactive text.
- If the game has a submit button, it is visually distinct and reachable.

### Step 8: Audit visual polish (mid-gameplay)
Verify against the mid-gameplay screenshot:
- Colors are harmonious -- not clashing, using the `--mathai-*` palette consistently.
- The game looks professional, not like a bare HTML form.
- If the student answers correctly, feedback is visible and clear (reference `feedback.md` for expected patterns).
- If the student answers incorrectly, feedback is visible, not punitive, and includes explanation where appropriate.
- Transitions between states are smooth (no jarring jumps, no flash of unstyled content).

### Step 9: Play through to results screen and screenshot
Complete the game (answer all questions, reach game_complete). Take a screenshot of the results/end screen.

If the results screen is **unreachable** (game hangs, button does nothing, infinite loop), this is a `[critical]` issue. Document it and stop -- the game cannot be approved.

### Step 10: Audit results screen
Verify against the results screenshot:
- Score/stars/performance summary is displayed clearly.
- The results screen has the same visual quality as the rest of the game (not a plain text dump).
- A "Play Again" or equivalent button is present and tappable.
- All text is readable and properly formatted.

### Step 11: Audit accessibility (all screenshots)
Review all screenshots taken:
- Text contrast: no light-gray-on-white or low-contrast text anywhere. Per `mobile.md` Section 3, all text must meet 4.5:1 contrast ratio.
- Feedback clarity: correct/incorrect states are distinguishable by more than color alone (icon, text, animation -- not just green vs red).
- Interactive element states: disabled elements look disabled (opacity, grayed out). Selected elements look selected.
- No information conveyed solely through color.

### Step 12: Compile verdict
Collect all issues found across Steps 2-11. Classify each as `[critical]` or `[warning]` using these criteria:

**Critical (must fix):**
- Any element overflows the viewport
- Text is unreadable (too small, insufficient contrast, truncated)
- Touch target is clearly below 44px or buttons are flush with no spacing
- A game state is unreachable (can't start, can't finish, results screen missing)
- Feedback for correct/incorrect is missing or broken
- Game doesn't look like a game (bare HTML, unstyled elements)

**Warning (should fix):**
- Minor spacing inconsistency
- Colors could be more harmonious
- Animation is slightly jerky
- Minor alignment issue that doesn't affect usability
- Typography hierarchy could be stronger

Output the verdict block as specified in the Output section.

## Constraints

### CRITICAL
1. **Must screenshot every game state.** Never review from code alone. Open the game in Playwright MCP, screenshot start screen, mid-gameplay, and results screen. A review without screenshots is invalid.
   - Positive: "Opened game at file:///path/index.html, screenshotted start screen, played to round 3, screenshotted, completed game, screenshotted results."
   - Negative: "Read the HTML source and the layout looks correct based on the CSS."

2. **Must complete the game end-to-end.** If you cannot reach the results screen, that is a `[critical]` issue. Do not approve a game you cannot finish.
   - Positive: "Played through all 9 rounds, reached results screen showing 7/9 correct."
   - Negative: "Checked start screen and round 1, looks good. VERDICT: APPROVED."

3. **Never restate mobile.md values.** Reference `mobile.md` sections by name (e.g., "per mobile.md Section 2, touch targets must be 44px minimum"). Do not copy constraint values into your review output.

4. **Component boundary is non-negotiable.** The preview instruction text, preview header, and preview score label persist in game state **by design** — the instruction must stay visible so students can scroll up to re-read, the header is the persistent chrome, and the score format is owned by the CDN. Never "fix" a visual concern by writing code that reaches into preview-owned DOM. Every one of these is a hard-banned anti-pattern:
   - `document.getElementById('previewInstruction').style.display = 'none'`
   - `document.getElementById('previewScore').textContent = '0/1'`
   - `document.getElementById('previewBackBtn')`, `#previewQuestionLabel`, `#previewStar`, `#previewAvatarSpeaking`, `#previewAvatarSilent`, `#previewProgressBar`, `#previewTimerText`, `#previewSkipBtn`, `#previewGameContainer`, `#popup-backdrop` — any reach-in
   - `querySelector('#mathai-preview-slot .mathai-preview-header')` or any compound selector containing `.mathai-preview-*`
   - `classList.add('mathai-preview-*')` on any game element
   - CSS rules (inside `<style>`) that target the banned IDs or `.mathai-preview-header`
   - Adding a game-defined class (`my-preview-hidden`, etc.) on `#mathai-preview-slot` combined with CSS that hides preview descendants
   If the instruction feels too tall or the score format (`0/3`) looks wrong for the game's round count, fix it inside `#gameContent` (tighter game UI, shorter `fallbackContent.previewInstruction`, a game-owned score badge) — never by mutating preview DOM. Validator rule `5e0-DOM-BOUNDARY` enforces this. See PART-026 Anti-Pattern 35 + PART-039 Component Boundary section.

5. **Static validation is a hard gate at ENTRY and EXIT of this skill — not only after fixes.**

   - **ENTRY:** The FIRST action when invoking this skill is to run `node lib/validate-static.js <game-html-path>`. If exit ≠ 0, your first job is to fix the validator errors BEFORE conducting any visual review. The file may contain a boundary / contract violation committed by a previous visual-review invocation or by Step 6's test-and-fix loop — a re-run does not automatically make stale violations clean.

   - **EXIT:** Run the validator again immediately before emitting the APPROVED verdict, EVERY time, regardless of whether you applied any changes this run. Exit code MUST be 0.

   - A visual approval with validator exit ≠ 0 is a skill violation. An APPROVED verdict on a file that fails `5e0-DOM-BOUNDARY` is invalid.

   - **NEVER list an anti-pattern as a passing check.** Entries like `"Preview instruction hidden after skip — PASS"` or `"Header score labelled 0/1 (overrides CDN default 0/3) — PASS"` are RED flags, not green ones. The code producing those visible effects is a boundary violation. Screenshot-level correctness does NOT override the validator exit code.

### STANDARD
4. **Viewport is 375x667.** Always use this viewport in Playwright MCP unless the spec explicitly states otherwise. This is the target device from `mobile.md`.

5. **Classify every issue.** Each issue must be `[critical]` or `[warning]`. Never leave an issue unclassified.

6. **One issue per line.** Never combine multiple problems into a single ISSUE line. Each distinct problem gets its own line with its own classification.

### ADVISORY
7. **Screenshot after fixing.** If you fix critical issues in the HTML, take new screenshots to verify the fix. Do not assume the fix worked.

8. **Note spec deviations.** If the visual implementation differs from the spec (e.g., spec says "blue theme" but game uses green), flag it as a `[warning]` even if the result looks fine.

## Defaults

When the spec does not mention visual design:
- Viewport: 375x667 portrait (from `mobile.md`)
- Color palette: `--mathai-*` variables (from `mobile.md` Section 10)
- Touch targets: 44px minimum, 8px spacing (from `mobile.md` Section 2)
- Typography: `--mathai-font-family`, 16px body, 32px title (from `mobile.md` Section 3)
- Feedback: per `feedback.md` patterns (correct = green + animation, incorrect = explanation + encouragement)
- Professional appearance: styled buttons, consistent spacing, visual hierarchy -- not bare HTML

## Anti-patterns

1. **Never approve without playing through the entire game.**
   - Negative: Screenshotted start screen, it looks clean. VERDICT: APPROVED.
   - Positive: Played all rounds, reached results. Start, gameplay, and results all meet quality bar. VERDICT: APPROVED.

2. **Never review from HTML source code instead of screenshots.**
   - Negative: "The CSS sets min-height: 44px on buttons, so touch targets pass."
   - Positive: "In the mid-gameplay screenshot, option buttons are visually at least 44px tall with visible spacing between them."

3. **Never combine multiple issues into one ISSUE line.**
   - Negative: `ISSUE: [critical] Buttons are too small and text is unreadable and colors clash`
   - Positive: Three separate lines -- `ISSUE: [critical] Option buttons appear below 44px on round 2 screen`, `ISSUE: [critical] Question text is truncated on round 2 screen`, `ISSUE: [warning] Button color (#3366ff) clashes with background gradient on start screen`.

4. **Never skip the results screen.**
   - Negative: "Game plays well through round 5, looks good. VERDICT: APPROVED."
   - Positive: "Completed all rounds. Results screen shows score, stars, and Play Again button. VERDICT: APPROVED."

5. **Never "fix" visual concerns by reaching into preview-owned DOM.**
   - Negative: "Instruction text clutters gameplay — fixed by hiding `#previewInstruction` in startGameAfterPreview. VERDICT: APPROVED."
   - Negative: "Header score shows `0/3` but this is a 1-star game — fixed by overriding `#previewScore.textContent = '0/1'`. VERDICT: APPROVED."
   - Negative: "Preview chrome bleeds into gameplay — added `.mur-preview-hidden` class on `#mathai-preview-slot` + CSS targeting `#previewInstruction`/`.mathai-preview-header`. VERDICT: APPROVED."
   - Positive: "Noted the instruction text persists into gameplay per PART-039 (required). It fits the viewport without pushing the game below the fold. No change needed. VERDICT: APPROVED."
   - Positive: "Preview score shows `0/3` from game_init default. Spec uses single-round scoring — flagged as content issue for Gen Quality to address at the spec / fallbackContent layer, NOT at the DOM layer. VERDICT: NEEDS_FIX with recommendation to shorten `previewInstruction` / override score via proper content channel."

6. **Never treat an existing anti-pattern as a passing checklist item on re-review.**
   - Negative: "Preview instruction hidden after skip — PASS (offsetHeight=0). VERDICT: APPROVED." ← This PASS is measuring the effect of a boundary violation that a previous run committed. The screenshot result looks fine; the code is illegal.
   - Negative: "Header shows 0/1 instead of CDN default 0/3 — PASS. Fixes from previous pass are stable. VERDICT: APPROVED." ← Same problem: the stability of a banned fix doesn't make it correct.
   - Positive: On re-review entry, ran `node lib/validate-static.js` → exit 1 (`5e0-DOM-BOUNDARY`: getElementById('previewInstruction'), getElementById('previewScore')). Identified previous run's "fix" as a boundary violation. Reverted the hide code and the score-override code. Re-ran validator → exit 0. Re-screenshotted gameplay → instruction now visible in scroll area (by-design per PART-039), no layout break. VERDICT: APPROVED.

5. **Never hardcode thresholds that belong to mobile.md.**
   - Negative: "Buttons must be 44px minimum, spacing 8px, viewport 375x667, contrast 4.5:1..." (restating mobile.md)
   - Positive: "Per mobile.md Section 2, touch targets are undersized." (referencing mobile.md)
