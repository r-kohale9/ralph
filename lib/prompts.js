'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// prompts.js — Prompt template builders for the Ralph pipeline
//
// Extracted from pipeline.js (Phase 1 of P7 structural split).
// Each function builds and returns a prompt string. No LLM calls here.
//
// Exported functions:
//   REVIEW_SHARED_GUIDANCE          — shared string constant for review prompts
//   buildGenerationPrompt           — Step 1: generate HTML from spec
//   buildCliGenPrompt               — Step 1: generate HTML via claude -p CLI
//   buildStaticFixPrompt            — Step 1b: fix static validation errors
//   buildContractFixPrompt          — Step 1b: fix contract validation errors
//   buildEarlyReviewPrompt          — Step 1c: pre-test spec compliance review
//   buildEarlyReviewFixPrompt       — Step 1c: fix early-review rejection
//   buildEarlyReReviewPrompt        — Step 1c: re-review after early-review fix
//   buildTestCasesPrompt            — Step 2a: generate test case list from spec
//   buildTestGenCategoryPrompt      — Step 2b: generate per-category Playwright tests
//   buildTriagePrompt               — Step 3: triage test failures
//   buildFixPrompt                  — Step 3: fix HTML to pass tests
//   buildGlobalFixPrompt            — Step 3c: cross-category global fix
//   buildReviewPrompt               — Step 4: final spec compliance review
//   buildReviewFixPrompt            — Step 4b: fix review rejection
//   buildReReviewPrompt             — Step 4b: re-review after review fix
//   buildExtractLearningsPrompt     — Step 5: extract cross-game learnings
//   buildTargetedFixPrompt          — runTargetedFix: apply user feedback
// ─────────────────────────────────────────────────────────────────────────────

// ─── Shared review guidance ──────────────────────────────────────────────────
// Used by both early review (Step 1c) and final review (Step 4).
// Keep in sync: any change here applies to both review calls.

const REVIEW_SHARED_GUIDANCE = `## Important Guidance to Avoid False Positives

### RULE-001 (Global scope)
RULE-001 is SATISFIED if all game functions are declared at the top level of the script and event handlers (onclick= or addEventListener) call only those globally-declared functions.
RULE-001 does NOT require onclick= attributes — addEventListener() calling a global function is equally compliant.
RULE-001 FAILS only if event handlers reference functions inside a closure not accessible from global scope.

### Contract Compliance — gameState and postMessage
- window.gameState = { ... } IS the correct pattern — it exposes gameState on window as required.
- window.parent.postMessage(...) is the correct call for game events.
- Check the postMessage payload fields per the spec's contract section.

### RULE-003 (try/catch on async calls)
- Promise .catch((e) => { console.error(...) }) IS compliant for fire-and-forget async calls.
- All awaited async calls must use try/catch.

### RULE-005 (Cleanup in endGame)
- A delayed destroy via setTimeout IS compliant — cleanup originates from endGame().
- Either immediate or delayed cleanup PASSES RULE-005.

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous or requires running the game to verify, resolve in favor of APPROVED.`;

// ─── CDN constraints block ────────────────────────────────────────────────────
// Shared block of CDN constraints injected into fix prompts.
// Single source of truth — used by buildFixPrompt and buildGlobalFixPrompt.

const CDN_CONSTRAINTS_BLOCK = `CRITICAL CDN CONSTRAINTS (do NOT violate these while fixing):
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget: .catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); }), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- isProcessing=true must SILENTLY BLOCK clicks (early return), NOT hide/show elements — buttons stay visible
- CDN init order is immutable: await FeedbackManager.init() → ScreenLayout.inject() → game template clone
- Do NOT add event listeners inside innerHTML setters — use event delegation on parent only
- Do NOT move CDN <script> tags or change their order
- Do NOT change any CDN <script src="..."> URLs. The correct CDN domain is cdn.homeworkapp.ai — never change this to cdn.mathai.ai or any other domain. Changing CDN URLs makes all scripts 404 and the entire game goes blank.
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block — only add/modify the specific broken functionality. Removing gameState.isActive=true or syncDOMState() calls will break all tests.
- Do NOT remove or rename elements in <template id="game-template"> — template corruption causes ALL tests to fail (0/0)
- Star display MUST update on game over: show ☆☆☆ for 0 stars in the game-over code path, not only on victory
- Lives display DOM element MUST update immediately when a life is lost, before any animation
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() IMMEDIATELY in endGame() — destroys CDN DOM elements; tests check them AFTER game over. Use 10s delay: setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
- TimerComponent MUST be initialized with startTime: 0 (never startTime: 1)
- NEVER define a custom updateLivesDisplay() function — let ProgressBarComponent handle lives display via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window (window.endGame = endGame etc.) so the test harness can call them. CDN games define these as local functions inside DOMContentLoaded — always add window.X = X assignments after each function definition.
- waitForPackages() MUST have a 10000ms timeout that THROWS on expiry: if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')} — review model fails on missing or wrong timeout
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- Preserve ALL existing data-testid attributes — never remove them; add data-testid to any new elements you create
- gameState.phase MUST be set at every state transition: 'playing' (active round starts), 'transition' (between levels/rounds, waiting for next button), 'gameover' (lives=0), 'results' (game complete). The test harness reads gameState.phase to set data-phase on #app — without these, waitForPhase() will timeout.
- endGame() GUARD: first lines of endGame must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id,url}]) instead`;

// ─── Step 1: HTML generation prompt ──────────────────────────────────────────

/**
 * Builds the LLM prompt for generating the game HTML from a spec.
 *
 * @param {string} specContent - Full spec markdown content
 * @param {string} learningsBlock - Formatted learnings block (may be empty string)
 * @returns {string}
 */
function buildGenerationPrompt(specContent, learningsBlock) {
  return `You are an expert HTML game assembler. The following specification is a self-contained assembly book — it contains ALL code blocks, element IDs, function signatures, CSS, game logic, and verification checks needed to produce a working game.

INSTRUCTIONS:
- Follow the specification EXACTLY — do not invent new element IDs, function names, or game logic
- Assemble all sections into a single index.html file (all CSS in <style>, all JS in <script>)
- Copy code blocks from the spec verbatim, filling in only where placeholders exist
- Use the element IDs, class names, and function signatures defined in the spec
- Use the star calculation logic defined in the spec (Section 11 or Parts table), not a generic formula
- The spec's Section 15 (Verification Checklist) lists every requirement — ensure all items pass
- Output ONLY the complete HTML file content, wrapped in a \`\`\`html code block

15. DATA-TESTID ATTRIBUTES — required on all interactive and observable elements:
    - EVERY interactive element needs a data-testid attribute so Playwright tests can find it reliably
    - EVERY observable state element (displays, counters, timers) needs a data-testid attribute
    - Use descriptive kebab-case names. Required minimums:
      data-testid="answer-input"       ← the answer input field
      data-testid="btn-check"          ← the submit/check button
      data-testid="btn-restart"        ← the play again / restart button
      data-testid="score-display"      ← the score or points display element
      data-testid="stars-display"      ← the stars display element
      data-testid="lives-display"      ← the lives / hearts display (if separate from CDN slot)
      data-testid="btn-reset"          ← the reset button (if spec includes one)
    - For adjustment controls (+/- buttons), use: data-testid="btn-{which}-plus" and data-testid="btn-{which}-minus"
      where {which} is the identifier (e.g., "a", "b", "num1", "num2")
    - For multiple-choice options: data-testid="option-{index}" (0-indexed)
    - IDs in the spec take precedence — if the spec says id="btn-check", keep that AND add data-testid="btn-check"
    - Do NOT rely on class selectors for elements that tests need to interact with

CRITICAL MATHAI CDN RULES (runtime requirements — apply these even if the spec is silent):

1. FEEDBACKMANAGER AUDIO — fire-and-forget ONLY, NEVER await:
   FeedbackManager.playDynamicFeedback({...}).catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); });  ← CORRECT
   await FeedbackManager.playDynamicFeedback({...});            ← WRONG: hangs forever in tests/headless
   Audio is cosmetic — game logic must NEVER depend on it resolving.
   The .catch() MUST log the error (not swallow silently) to satisfy RULE-003 try/catch requirement.

2. isProcessing — clear in EVERY exit path of checkAnswer/roundComplete/endGame:
   - Set gameState.isProcessing = false at the START of endGame()
   - Set gameState.isProcessing = false BEFORE calling showLevelTransition() in roundComplete()
   - Set gameState.isProcessing = false in any game-over path (e.g. lives = 0 before setTimeout)
   Missing this causes subsequent answer clicks to be silently dropped.

3. GAME DOM — template pattern required for ScreenLayout:
   - <div id="app"></div> stays EMPTY in static HTML
   - ALL game elements go inside <template id="game-template"> placed OUTSIDE #app
   - After ScreenLayout.inject(), clone into #gameContent:
     const tpl = document.getElementById('game-template');
     if (tpl) document.getElementById('gameContent').appendChild(tpl.content.cloneNode(true));
   ScreenLayout.inject() replaces #app's entire content — anything inside #app is destroyed.

4. EVENT DELEGATION — no duplicate listeners:
   - Use ONE parent.addEventListener('click', e => { if (e.target.matches(...)) }) per container
   - NEVER call element.addEventListener() inside a function that sets innerHTML (fires twice per click)

5. CDN INIT ORDER — immutable sequence:
   await FeedbackManager.init();   // MUST await — shows audio permission popup
   ScreenLayout.inject(...);       // MUST run AFTER FeedbackManager.init() resolves
   // clone game-template + initGame() called after ScreenLayout

6. VISIBILITYTRACKER — expose as window.visibilityTracker for testability:
   window.visibilityTracker = new VisibilityTracker({ onInactive: ..., onResume: ... });
   Tests call window.visibilityTracker directly to simulate tab hide/show events.
   Similarly: expose window.timer = timer after creation (for TimerComponent instances).

7. STAR DISPLAY — use ONLY the star formula from the spec, no accuracy modifier:
   - On victory: use EXACTLY the star thresholds from the spec (e.g. avg time per level <15s = 3★, <25s = 2★, ≥25s = 1★)
   - On game over (lives=0): ALWAYS return 0 stars — game_over outcome = 0★ regardless of time or accuracy
   - calcStars() MUST have an explicit early return: if (outcome === 'game_over') return 0;
   - Show 0 stars as empty characters: ☆☆☆
   - NEVER add accuracy-based secondary checks (e.g. if accuracyRatio < 0.8 reduce stars) — the spec defines the star formula completely
   - The star display element MUST be updated in BOTH the victory path AND the game-over/lives-lost path
   - Do NOT skip star display in the game-over code path

8. LIVES DISPLAY — update DOM immediately when a life is lost:
   - After decrementing gameState.lives, update the lives counter DOM element immediately
   - The lives display must reflect the NEW value before any animation or FeedbackManager call
   - Tests check the DOM text AFTER the wrong answer is processed, not after animation completes

9. isProcessing GUARD — silently block, do NOT hide elements:
   - isProcessing = true means: ignore subsequent clicks, do NOT hide/show buttons
   - Check buttons and input remain VISIBLE while isProcessing=true — they just don't respond
   - Implementation: if (gameState.isProcessing) return; at the top of handleSubmit/checkAnswer
   - NEVER do: element.style.display = 'none' or element.classList.add('hidden') based on isProcessing

10. CDN COMPONENT CLEANUP — DELAYED destroy only, NEVER immediate:
    - NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() synchronously in endGame()
    - Destroying immediately removes CDN DOM elements (#mathai-progress-slot, #mathai-timer-slot) from the page
    - Tests check these elements AFTER game over — immediate destroy causes "element not found" failures
    - Spec REQUIRES destroy() to be called — satisfy this with a 10-second delay so tests finish first:
      setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
    - Put this setTimeout at the END of endGame(), after all DOM updates

11. TIMER INIT — startTime MUST be 0:
    - ALWAYS initialize TimerComponent with startTime: 0
    - NEVER use startTime: 1 (off-by-one error in timer display)
    - Example: const timer = new TimerComponent({ containerId: 'mathai-timer-slot', startTime: 0, ... });

12. LIVES DISPLAY — do NOT define updateLivesDisplay() manually:
    - NEVER define a custom updateLivesDisplay(n) function that manipulates lives DOM directly
    - The ProgressBarComponent handles all lives display — it reads gameState.lives and renders hearts
    - Only call progressBar.update(currentRound, currentLives) to sync the component
    - Manual updateLivesDisplay() conflicts with ProgressBarComponent's async rendering and causes test failures

13. ASYNC FUNCTIONS — always declare async if using await:
    - If endGame() contains ANY await calls, it MUST be declared: async function endGame() { ... }
    - Same rule applies to all other functions — never put await inside a non-async function

14. TRANSITIONSCREEN — use for ALL state transitions if spec includes it:
    - If the spec defines a TransitionScreen component, it MUST be used for: game start, level transitions, victory, game-over
    - Do NOT skip TransitionScreen and jump directly to showing game/result screens
    - Initialize with: const transitionScreen = new TransitionScreen({ containerId: 'mathai-transition-slot' })
    - Call transitionScreen.show({ type: 'victory'|'game-over'|'level-start', ... }) at each transition

15. GAMESTATE.PHASE — set at every state transition (required by test harness):
    - Always set gameState.phase at each transition:
      - gameState.phase = 'playing'    ← when a new round/question becomes active
      - gameState.phase = 'transition' ← when between levels (waiting for user to click "Next Level")
      - gameState.phase = 'gameover'   ← when lives hit 0 or game-over condition met
      - gameState.phase = 'results'    ← when victory / all rounds completed
    - The test harness reads gameState.phase to set data-phase on #app; without this, waitForPhase() timeouts

CRITICAL — game_init phase transition (ALL game-flow and mechanics tests depend on this):
    Your handlePostMessage function MUST handle the 'game_init' event by immediately setting
    gameState.phase = 'playing' as the VERY FIRST LINE in the game_init case — BEFORE any other
    game logic (before setupGame(), before rendering, before anything).
    The test harness fires game_init then IMMEDIATELY calls waitForPhase('playing').
    If gameState.phase is not set to 'playing' synchronously in the game_init case,
    ALL game-flow and mechanics tests will timeout and fail.

    REQUIRED PATTERN (copy exactly):
      case 'game_init':
        gameState.phase = 'playing';  // REQUIRED FIRST LINE — do NOT move or defer this
        // ... rest of init logic (setupGame, renderQuestion, etc.)
        break;

    WRONG patterns that cause ALL tests to fail:
      case 'game_init':
        setupGame();  // ← WRONG: phase not set before harness checks
        break;
      case 'game_init':
        initGame().then(() => { gameState.phase = 'playing'; }); // ← WRONG: async, too late

16. POSTMESSAGE — always send to PARENT frame:
    - ALWAYS use window.parent.postMessage(payload, '*') for game_complete events
    - NEVER use window.postMessage(payload, '*') — this sends to the same window, parent never receives it
    - The MathAI platform is always an iframe parent; window.parent is always the correct target

17. MULTI-STEP CONTROLS — never hide the adjustment button after first click:
    - If a game has +/- adjustment buttons (spec terms: "adjusts by ±1", "increment/decrement"), keep BOTH buttons visible at all times after initial render
    - Showing a value display in the +/- button area is fine, but the button itself must remain visible and clickable for repeated adjustments
    - NEVER call btn.classList.add('hidden') on an adjustment button as a result of the user clicking it

18. CDN URL — ALWAYS use cdn.homeworkapp.ai as the CDN domain:
    - CORRECT: https://cdn.homeworkapp.ai/games-cdn/...
    - WRONG: cdn.mathai.ai, cdn.mathai.com, mathai-cdn.ai, or any other domain
    - Using the wrong CDN domain causes ALL CDN scripts to 404, the game goes completely blank, and every single test fails

19. PART-003 waitForPackages — if spec uses CDN packages, MUST implement with EXACTLY this pattern:
    async function waitForPackages() {
      const timeout = 10000;
      const interval = 50;
      let elapsed = 0;
      while (typeof FeedbackManager === 'undefined') {
        if (elapsed >= timeout) { throw new Error('Packages failed to load within 10s'); }
        await new Promise(resolve => setTimeout(resolve, interval));
        elapsed += interval;
      }
    }
    - Timeout MUST be exactly 10000ms (≤10s requirement from verification checklist)
    - MUST throw on timeout (not console.error, not silent) — review model checks for proper error handling
    - Called FIRST in DOMContentLoaded before FeedbackManager.init()

20. endGame() GUARD — prevent double-call with a guard at the top:
    - Add to gameState: gameEnded: false (or isActive: false pattern)
    - First line of endGame(): if (gameState.gameEnded) return; gameState.gameEnded = true;
    - Also set gameState.isActive = false early in endGame()
    - This prevents test harness retries from triggering a second endGame() call

21. window EXPOSURE for CDN games — if DOMContentLoaded is used, add these AFTER each function definition (not inside the callback):
    window.endGame = endGame;
    window.restartGame = restartGame;  // if defined
    window.nextRound = nextRound;       // if defined
    window.gameState = gameState;       // REQUIRED: test harness reads window.gameState for syncDOMState()
    These must be at global/module scope so the test harness can call them.
    - CRITICAL: window.gameState must be exposed — syncDOMState() reads window.gameState to set data-phase on #app. If gameState is NOT on window, data-phase is NEVER set and ALL waitForPhase() calls timeout.

SPECIFICATION:
${specContent}${learningsBlock}`;
}

// ─── Step 1: HTML generation prompt (claude CLI variant) ──────────────────────

/**
 * Builds the prompt for generating HTML via the claude -p CLI tool.
 *
 * @param {string} specPath - Absolute path to the spec file
 * @param {string} htmlFile - Absolute path where the HTML should be written
 * @param {string} learningsBlock - Formatted learnings block (may be empty string)
 * @returns {string}
 */
function buildCliGenPrompt(specPath, htmlFile, learningsBlock) {
  return `You are generating a MathAI game HTML file.

Read the game-specific template at: ${specPath}

Generate the complete index.html file following the template exactly.
Write the output to: ${htmlFile}

Rules:
- Single file, all CSS in one <style>, all JS in one <script>
- Follow every instruction in the template EXACTLY — copy all code blocks verbatim
- Include fallback content for standalone testing
- All game HTML must go inside #gameContent when using ScreenLayout
- PART-008: handlePostMessage MUST check event.data.type === 'game_init' and call setupGame()
- CRITICAL game_init: In the 'game_init' case of handlePostMessage, set gameState.phase = 'playing' as the VERY FIRST LINE before any other logic. The test harness calls waitForPhase('playing') immediately after firing game_init — if phase is not set synchronously, ALL game-flow and mechanics tests timeout and fail.
- IF spec uses PART-010/SignalCollector: endGame postMessage MUST spread ...signalPayload from signalCollector.seal()
- IF spec uses PART-030/Sentry: ALL catch blocks MUST call Sentry.captureException(e); initSentry() defined and called AFTER Sentry SDK loads via waitForPackages callback — NEVER call initSentry() as a top-level statement in DOMContentLoaded before waitForPackages() resolves. Calling initSentry() before the Sentry SDK script tag executes throws ReferenceError → prevents ScreenLayout.inject() → #mathai-transition-slot button never appears → ALL tests timeout.
- PART-012 DEBUG FUNCTIONS: debug/test functions (debugGame, testAudio, testPause, testResume, testSentry, verifySentry) MUST be local functions inside DOMContentLoaded — NEVER assign to window (window.debugGame=, window.testAudio=, etc.). Review model REJECTS window-exposed debug functions.
- IF spec uses PART-025/ScreenLayout: ScreenLayout.inject() MUST be called inside the waitForPackages() callback/await chain, AFTER FeedbackManager.init() resolves. Missing this call means #mathai-transition-slot button never renders and ALL tests fail on the very first assertion.
- CRITICAL CDN URL: ALWAYS use cdn.homeworkapp.ai as the CDN domain. NEVER use cdn.mathai.ai or any other domain — wrong CDN domain causes all scripts to 404 and game goes blank.
- PART-003 waitForPackages: if spec uses CDN packages, implement with EXACTLY: async function waitForPackages() { const timeout=10000; const interval=50; let elapsed=0; while(typeof FeedbackManager==='undefined') { if(elapsed>=timeout) { throw new Error('Packages failed to load within 10s'); } await new Promise(r=>setTimeout(r,interval)); elapsed+=interval; } } — timeout MUST be 10000ms, MUST throw on timeout (not console.error).
- window EXPOSURE: if DOMContentLoaded used, add window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; window.gameState=gameState; at global scope outside the callback. CRITICAL: syncDOMState() reads window.gameState — if not on window, data-phase NEVER syncs and ALL waitForPhase() calls timeout.
- endGame GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
${learningsBlock}
Write the file now.`;
}

// ─── Step 1b: Static fix prompt ───────────────────────────────────────────────

/**
 * Builds the prompt to fix static validation errors in generated HTML.
 *
 * @param {string} staticErrors - Output from static validator
 * @param {string} currentHtml - Current HTML content
 * @param {string} specContent - Spec markdown content
 * @returns {string}
 */
function buildStaticFixPrompt(staticErrors, currentHtml, specContent) {
  return `The following HTML game file has structural issues that need fixing.

ERRORS:
${staticErrors}

CURRENT HTML:
${currentHtml}

SPECIFICATION (for reference — use exact element IDs, function names, and structure from this spec):
${specContent}

Fix ALL the listed structural issues while keeping the game aligned with the specification.

CRITICAL CONSTRAINTS — do NOT change these patterns:
1. CDN initialization order MUST be preserved exactly:
   await FeedbackManager.init();
   ScreenLayout.inject(...);
   // then initGame() is called from within ScreenLayout or explicitly after
   Breaking this order causes the game to not render at all.
2. Do NOT remove or reorder any CDN <script> tags (FeedbackManager, ScreenLayout, etc.)
3. Do NOT wrap the initialization block in try/catch or move it inside other functions
4. Make the smallest possible change that fixes only the listed errors
5. CDN URL: ALWAYS use cdn.homeworkapp.ai — NEVER cdn.mathai.ai
6. window.gameState MUST be exposed: use window.gameState = { ... } or window.gameState = gameState; at global scope (test harness reads window.gameState for syncDOMState — if not on window, data-phase is never set and ALL tests timeout)
7. CDN games (DOMContentLoaded pattern): add window.endGame = endGame; window.restartGame = restartGame; window.gameState = gameState; at global scope
8. sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id, url}]) instead
9. waitForPackages() timeout MUST be 10000ms with throw on expiry: if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')}
10. game_init case MUST set gameState.phase = 'playing' as FIRST LINE

Output the complete corrected HTML wrapped in a \`\`\`html code block.`;
}

// ─── Step 1b: Contract fix prompt ────────────────────────────────────────────

/**
 * Builds the prompt to fix contract validation errors in generated HTML.
 *
 * @param {string[]} contractErrors - Array of contract error strings
 * @param {string} specStarType - Star type from spec metadata (e.g. 'lives', 'avg-time')
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildContractFixPrompt(contractErrors, specStarType, currentHtml) {
  return `You are fixing a game HTML file that has contract validation errors.

CONTRACT ERRORS:
${contractErrors.map(e => `  ✗ ${e}`).join('\n')}

SPEC CONTRACT REQUIREMENTS:
${specStarType || ''}

FULL HTML:
${currentHtml}

Fix ONLY the contract errors above. Do not change game logic, styling, or working features.
Return the complete corrected HTML.`;
}

// ─── Step 1c: Early review prompt ────────────────────────────────────────────

/**
 * Builds the early spec compliance review prompt (pre-test fast-fail).
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildEarlyReviewPrompt(specContent, currentHtml) {
  return `You are a game quality reviewer doing a SPEC COMPLIANCE CHECK before running full tests.

This is a pre-test fast-fail check. Only reject if there are clear spec violations that would make ALL tests fail. Minor issues should be noted but not cause rejection.

Walk through EVERY item in the spec's Verification Checklist. For each item, check if the HTML clearly passes or fails.
ONLY reject on CLEAR, DEFINITIVE violations — code you can plainly see is wrong or missing. Do NOT reject on ambiguous items.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — no clear spec violations found (continue to test generation)
- REJECTED: <list ONLY the clear, definitive violations — not style issues>

SPECIFICATION:
${specContent}

HTML:
${currentHtml}`;
}

// ─── Step 1c: Early review fix prompt ────────────────────────────────────────

/**
 * Builds the prompt to fix an early-review rejection.
 *
 * @param {string} rejectionReason - Full rejection output from early review
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildEarlyReviewFixPrompt(rejectionReason, specContent, currentHtml) {
  return `The following HTML game was rejected in a spec compliance review.

REJECTION REASON:
${rejectionReason}

Fix ONLY the specific violations listed. Make the smallest possible change.
Do NOT change any passing aspects. Preserve CDN initialization order exactly.

SPECIFICATION:
${specContent}

CURRENT HTML:
${currentHtml}

Output the complete corrected HTML wrapped in a \`\`\`html code block.`;
}

// ─── Step 1c: Early re-review prompt ─────────────────────────────────────────

/**
 * Builds the re-review prompt used after an early-review fix attempt.
 * Identical structure to buildEarlyReviewPrompt but used in the fix loop.
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (post-fix)
 * @returns {string}
 */
function buildEarlyReReviewPrompt(specContent, currentHtml) {
  return `You are a game quality reviewer doing a SPEC COMPLIANCE CHECK before running full tests.

This is a pre-test fast-fail check. Only reject if there are clear spec violations that would make ALL tests fail. Minor issues should be noted but not cause rejection.

Walk through EVERY item in the spec's Verification Checklist. For each item, check if the HTML clearly passes or fails.
ONLY reject on CLEAR, DEFINITIVE violations — code you can plainly see is wrong or missing. Do NOT reject on ambiguous items.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — no clear spec violations found (continue to test generation)
- REJECTED: <list ONLY the clear, definitive violations — not style issues>

SPECIFICATION:
${specContent}

HTML:
${currentHtml}`;
}

// ─── Step 2a: Test cases prompt ───────────────────────────────────────────────

/**
 * Builds the prompt to generate a structured test case list from the spec.
 *
 * @param {string} specContent - Spec markdown content
 * @returns {string}
 */
function buildTestCasesPrompt(specContent) {
  return `You are a QA analyst. Analyze the following game specification and produce a structured list of test cases describing WHAT the game should do.

CRITICAL RULES — read before generating any test cases:
1. ONLY reference DOM elements that appear in the ACTUAL RUNTIME DOM snapshot (injected into the test gen step). Do NOT invent element IDs or class names — they will be provided later.
2. Every test case MUST include: the interaction type (click, type, evaluate), the expected state change (phase, score, lives, postMessage payload), and any preconditions.
3. If window.gameState is NOT exposed on window (i.e. not in WINDOW.GAMESTATE SHAPE when provided), ALL data-phase-based tests will fail — flag this in the description so the code-gen step can use polling instead.
4. Prefer SIMPLE test cases: single-action → single-assertion. Avoid multi-step chains unless the behavior requires it.
5. For "game-flow" tests: specify which screen to transition FROM and which screen to expect TO, based strictly on spec flow.
6. For "contract" tests: specify the exact postMessage fields expected (type, score, stars, total) — do not leave them vague.

Categories to cover:
- "game-flow": screen transitions (start → game → level transition → end screen)
- "mechanics": core interactions (input, adjustment controls, check/submit, scoring)
- "level-progression": how levels change (difficulty, content, round structure)
- "edge-cases": boundary values, invalid input, rapid actions, final life/round
- "contract": gameOver postMessage event (type, score, stars, total fields)

Output a JSON array of test cases. Each test case has:
- "name": short test case name
- "category": one of game-flow | mechanics | level-progression | edge-cases | contract
- "description": what is being validated (include interaction type + expected state change)
- "steps": array of human-readable steps (be specific about what buttons, inputs, and assertions are involved)

Output ONLY valid JSON wrapped in a \`\`\`json code block. No prose.

SPECIFICATION:
${specContent}`;
}

// ─── Step 2b: Per-category test generation prompt ────────────────────────────

/**
 * Builds the per-category Playwright test generation prompt.
 *
 * @param {object} opts
 * @param {string} opts.category - Category name (e.g. 'game-flow', 'mechanics')
 * @param {string} opts.categoryDescription - Human-readable description for this category
 * @param {number} opts.testCaseCount - Number of test cases to implement
 * @param {string} opts.testCasesText - Formatted test cases text
 * @param {string} opts.learningsBlock - Formatted learnings block (may be empty)
 * @param {string} opts.testHintsBlock - Game-specific test warnings (may be empty)
 * @param {string|null} opts.domSnapshot - DOM snapshot string (may be null)
 * @param {string} opts.htmlContent - Current HTML content
 * @returns {string}
 */
function buildTestGenCategoryPrompt(opts) {
  const {
    category,
    categoryDescription,
    testCaseCount,
    testCasesText,
    learningsBlock,
    testHintsBlock,
    domSnapshot,
    htmlContent,
  } = opts;

  return `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

MANDATORY RULES — violating any of these causes immediate test failure:
1. ONLY use selectors that appear in the ACTUAL RUNTIME DOM snapshot section below. NEVER invent element IDs or class names. If a selector is not in the snapshot, use page.evaluate() to read window.gameState instead.
2. Generate the SIMPLEST possible test that validates the behavior. Prefer single-action tests over multi-step chains. If a test needs 5+ steps, split it or use skipToEnd().
3. Use \`waitForPhase(page, phase)\` ONLY if the DOM snapshot confirms data-phase is present on #app (i.e. the WINDOW.GAMESTATE SHAPE section shows 'phase' as a property). If data-phase is absent or null in the snapshot, use \`page.evaluate(() => window.gameState?.phase)\` polling instead.
4. Every \`waitForPhase\` call MUST include an explicit timeout: \`await waitForPhase(page, 'playing', 10000)\`
5. If game content (question text, answer options) is needed — use \`fallbackContent\` from the shared boilerplate, NOT hardcoded strings from the HTML.
6. Add a test.beforeAll() block as the FIRST item in the describe block to verify window.gameState is on window:
\`\`\`javascript
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  await page.waitForTimeout(3000);
  const hasGameState = await page.evaluate(() => typeof window.gameState !== 'undefined');
  if (!hasGameState) throw new Error('window.gameState not on window — syncDOMState() will never set data-phase; all waitForPhase() calls will timeout');
  await page.close();
});
\`\`\`
7. Correct helper usage examples:
   - \`await answer(page, true)\` — submit a correct answer and wait for processing
   - \`await answer(page, false)\` — submit a wrong answer
   - \`expect(await getLives(page)).toBe(2)\` — check lives by integer, not emoji
   - \`expect(await getScore(page)).toBeGreaterThan(0)\` — check score
   - \`expect(await getRound(page)).toBe(2)\` — check current round
   - \`await skipToEnd(page, 'victory')\` — skip to results screen
   - \`await skipToEnd(page, 'game_over')\` — skip to game-over screen

CATEGORY FOCUS: ${categoryDescription}

IMPLEMENT ALL ${testCaseCount} TEST CASES BELOW — one test() per case, no skipping, no merging:
${testCasesText}

Your test.describe() block MUST contain exactly ${testCaseCount} test() calls.

CRITICAL — Helper function behavior (read carefully before writing any test):

startGame(page):
  - Clicks through ALL initial transition screens (start, level-1 intro, etc.) until the game is active
  - After startGame() resolves, #mathai-transition-slot button is NOT visible and the game is playing
  - Use startGame() at the beginning of every test
  - NEVER call clickNextLevel() right after startGame() — startGame already handled every initial screen

clickNextLevel(page):
  - Waits for #mathai-transition-slot button to be visible, then clicks it
  - ONLY use this for MID-GAME level transitions (e.g. after completing round 3, after completing round 6)
  - NEVER call this right after startGame() — startGame already clicked all initial screens

dismissPopupIfPresent(page):
  - Dismisses any popup/backdrop that may appear (audio permission, etc.)
  - Call it if an interaction might trigger a popup

Transition slot selectors (CDN MathAI constants — always use these, never guess):
  - Button: page.locator('#mathai-transition-slot button').first()  ← PREFERRED for clicking
  - Title: page.locator('#transitionTitle')  ← h2 element
  - Subtitle: page.locator('#transitionSubtitle')  ← p element
  - WRONG class: '.game-btn', '.btn-primary' — button class is 'mathai-transition-btn'

Progress slot selectors (never use #pb-{timestamp} IDs — they change every session):
  - Rounds/progress: page.locator('#mathai-progress-slot .mathai-progress-text')
  - Lives: page.locator('#mathai-progress-slot .mathai-lives-display')

Screen visibility rules:
  - On start/transition screen: #mathai-transition-slot is visible; game content is HIDDEN
  - On game screen (after startGame()): game content is visible; #mathai-transition-slot is hidden

Game-specific selectors: USE THE DOM SNAPSHOT below for actual element IDs and selectors.
  - Do NOT guess element IDs — read them from the DOM snapshot and HTML
  - Define helper functions in the test body as needed (e.g. submitAnswer, clickChoice, etc.)
  - Use page.evaluate() for non-numeric input: el.value = 'abc'; el.dispatchEvent(new Event('input', {bubbles:true}))

The following are already defined globally — DO NOT redefine them:
  dismissPopupIfPresent(page), startGame(page), clickNextLevel(page)
  waitForPhase(page, phase, timeout?) — waits for #app[data-phase="phase"]; PREFER over toBeVisible for phase checks
  getLives(page) — returns lives as integer from data-lives attribute (not emoji text)
  getScore(page) — returns score as integer from data-score attribute
  getRound(page) — returns currentRound as integer from data-round attribute
  skipToEnd(page, reason?) — calls window.__ralph.endGame(reason) to jump to end; reason='victory'|'game_over'
  answer(page, correct?) — calls window.__ralph.answer(correct) using game-specific selector; waits for processing
  test.beforeEach() — already navigates to page and waits for initialization
  fallbackContent — captured game content (rounds, items, data)
    IMPORTANT: fallbackContent.rounds may be empty []. Always check length before accessing:
    const rounds = fallbackContent.rounds.length > 0 ? fallbackContent.rounds : null;
    If no fallbackContent, derive expected values from the game HTML/spec instead.

PHASE-BASED NAVIGATION — use data-phase attribute instead of timing hacks:
  After startGame(): #app[data-phase="playing"] — game is active
  After level transition: #app[data-phase="transition"] — level complete screen
  After game ends: #app[data-phase="results"] or #app[data-phase="gameover"]
  PREFER: await waitForPhase(page, 'playing') over arbitrary waitForTimeout()
  PREFER: expect(await getLives(page)).toBe(2) over toHaveText("❤️❤️")
  PREFER: await skipToEnd(page, 'victory') over playing all rounds manually

OUTPUT INSTRUCTIONS:
- Output ONLY a single test.describe('${category}', () => { ... }); block
- Do NOT include import statements, beforeEach, helper function definitions, or fallbackContent
- Start directly with: test.describe('${category}', () => {
- Use test() for each test case — NOT nested test.describe() for sub-groups
- Pure JavaScript — no TypeScript type annotations (no : any[], no : string, etc.)
- Use double quotes for test() names: test("test name", async...) — never single quotes in names
- NEVER access window.gameState.content — use fallbackContent instead
- If evaluating JS state: expect(await page.evaluate(() => window.x)).toBe(v) — NOT await expect(page.evaluate(...))
- Slot IDs use '#' prefix; progress display classes use '.' prefix
- DO NOT generate tests requiring real wall-clock delays for time-based scoring. Instead test the endGame() postMessage payload directly.
- Do NOT call window.visibilityTracker methods directly — dispatch visibilitychange event instead
- Do NOT call Object.defineProperty(document, 'visibilityState') in test body — already defined in beforeEach initScript; calling it again throws "Cannot redefine property". Use: await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
- IMPORTANT: Do NOT write tests that rely on the Page Visibility API (document.visibilityState, document.hidden, visibilitychange events). The test harness permanently overrides visibilityState to 'visible' in beforeEach, so visibility-based pause/resume tests can never pass. Skip any test case ideas involving tab switching, app backgrounding, or visibility tracking.
- For "game over logic" tests: use skipToEnd(page, 'game_over') then waitForPhase(page, 'gameover') — do NOT look for specific game-over DOM elements that may not exist
- For "restart functionality" tests: after clicking 'Try Again'/'Play Again', use startGame(page) helper to click through the start transition screen — do NOT use manual if(isVisible()) checks which fail due to CDN animation delays
- NEVER assert exact CDN ProgressBar lives text like toHaveText("❤️❤️") — use getLives(page) or page.evaluate(() => window.gameState.lives) instead
- NEVER assert exact timer display text like toBe('00:00') or toHaveText('0:00') — CDN timer format varies; instead check visibility: await expect(page.locator('#mathai-timer-slot')).toBeVisible()
- To trigger endGame without playing all rounds: use skipToEnd(page, 'victory') — do NOT call window.endGame directly
- When testing that re-clicking a "correct" cell does nothing: use cell.click({ force: true }) — CSS pointer-events:none on .correct cells prevents plain cell.click() from working in Playwright
- Wrap output in a \`\`\`javascript code block
${learningsBlock}${testHintsBlock}${domSnapshot ? `\n${domSnapshot}\n` : ''}
HTML:
${htmlContent}`;
}

// ─── Step 3: Triage prompt ────────────────────────────────────────────────────

/**
 * Builds the triage prompt to decide whether to fix HTML or skip bad tests.
 *
 * @param {string} batchLabel - Batch label (e.g. 'game-flow', 'mechanics')
 * @param {number} passed - Number of passing tests
 * @param {number} failed - Number of failing tests
 * @param {string} failuresStr - Formatted failure descriptions string
 * @param {string} batchTestsContent - Full content of the batch spec files
 * @returns {string}
 */
function buildTriagePrompt(batchLabel, passed, failed, failuresStr, batchTestsContent) {
  return `You are a test triage assistant for a browser-based math game.

CATEGORY: '${batchLabel}'
PASSING: ${passed} tests passed.
FAILING: ${failed} tests failed.

FAILING TEST DETAILS:
${failuresStr}

FAILING TEST FILE:
\`\`\`javascript
${batchTestsContent}
\`\`\`

For each failing test, decide one of:
- "fix_html": The HTML game logic is genuinely broken. A targeted HTML fix will resolve it.
- "skip_test": The test has a wrong assumption, tests untestable behavior, or has a logic error. The HTML is correct.

HARNESS FACTS (do NOT assume harness methods are missing):
- window.__ralph.setLives(n) IS implemented and works correctly. DO NOT skip a test just because it calls setLives().
- window.__ralph.endGame(reason) IS implemented. DO NOT skip a test just because it calls endGame().
- window.__ralph.getLastPostMessage() IS implemented.
- If a test calls setLives() and the error is NOT "setLives is not a function" or "Cannot read properties of undefined (reading 'setLives')", then setLives() is NOT the problem — diagnose the ACTUAL error message.

KNOWN HTML BUGS — always diagnose as fix_html:
- TypeError: Cannot read properties of undefined (reading 'setLives'|'jumpToRound'|'getLastPostMessage'|'syncDOMState'|'endGame'|'setRoundTimes'|'answer') → window.__ralph is undefined → the test harness was NOT injected → the game page has a JavaScript error that prevented initialization → fix the HTML to resolve the JS error.
- "is not a function" on any window.__ralph method → harness methods missing → page init failed → fix the HTML.
- window.__ralph is not defined → same as above → fix the HTML.

KNOWN TEST BUGS — always diagnose as skip_test:
- TimeoutError: locator.click timeout on a cell that was previously clicked and is now .correct → cell has pointer-events:none from CSS, Playwright cannot click it. The test is re-clicking a disabled cell.
- TypeError: Cannot read properties of undefined (reading 'filter'|'length') on window.gameState.events → game doesn't track events array; test assumption is wrong.
- page.evaluate: TypeError: Cannot redefine property: visibilityState → already defined in beforeEach initScript; cannot redefine in test body.

Respond ONLY as valid JSON:
{
  "decision": "fix_html" | "skip_tests" | "mixed",
  "fix_hints": "Brief description of what specifically to fix in the HTML (only if fix_html or mixed)",
  "tests_to_skip": ["exact test name", ...],
  "rationale": "One sentence explanation"
}`;
}

// ─── Step 3: Fix prompt ───────────────────────────────────────────────────────

/**
 * Builds the per-batch HTML fix prompt.
 *
 * @param {object} opts
 * @param {string} opts.batchLabel - Batch category label
 * @param {string} opts.fixStrategy - Strategy/instruction text for this fix iteration
 * @param {string} opts.fixHintContext - Triage fix hints (may be empty)
 * @param {string} opts.specScoringContext - Spec scoring section (may be empty)
 * @param {string} opts.fixLearningsContext - Learnings context (may be empty)
 * @param {number} opts.failed - Number of failing tests
 * @param {string} opts.failuresStr - Formatted failure descriptions
 * @param {string} opts.passingContext - Currently passing test bodies context (may be empty)
 * @param {string} opts.priorBatchContext - Prior batch passing tests context (may be empty)
 * @param {string} opts.batchTests - Full content of the batch spec files
 * @param {string} opts.htmlForPrompt - HTML to fix (may be full HTML or script sections only)
 * @param {string} opts.outputInstructions - Output format instructions
 * @returns {string}
 */
function buildFixPrompt(opts) {
  const {
    batchLabel,
    fixStrategy,
    fixHintContext,
    specScoringContext,
    fixLearningsContext,
    failed,
    failuresStr,
    passingContext,
    priorBatchContext,
    batchTests,
    htmlForPrompt,
    outputInstructions,
  } = opts;

  return `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}${specScoringContext}${fixLearningsContext}
FAILING TESTS (${failed} failures):
${failuresStr}
${passingContext}${priorBatchContext}
FAILING TEST FILE(S):
\`\`\`javascript
${batchTests}
\`\`\`

CURRENT HTML:
${htmlForPrompt}

${CDN_CONSTRAINTS_BLOCK}

${outputInstructions}`;
}

// ─── Step 3c: Global fix prompt ───────────────────────────────────────────────

/**
 * Builds the global cross-category fix prompt.
 *
 * @param {object} opts
 * @param {number} opts.globalIter - Current global iteration number
 * @param {number} opts.maxGlobalIterations - Max global iterations
 * @param {string} opts.fixLearningsContext - Learnings context (may be empty)
 * @param {string} opts.globalFailureSummary - Summary of all failing categories
 * @param {string} opts.globalPassingContext - Fully passing categories context (may be empty)
 * @param {string} opts.additionalPriorContext - Prior passing batches context (may be empty)
 * @param {string} opts.globalTestFilesBlock - Content of all failing test files
 * @param {string} opts.currentHtml - Current HTML content
 * @returns {string}
 */
function buildGlobalFixPrompt(opts) {
  const {
    globalIter,
    maxGlobalIterations,
    fixLearningsContext,
    globalFailureSummary,
    globalPassingContext,
    additionalPriorContext,
    globalTestFilesBlock,
    currentHtml,
  } = opts;

  return `The following HTML game still has test failures after per-category fix loops have run.

This is GLOBAL FIX iteration ${globalIter}/${maxGlobalIterations}. You are seeing ALL failing categories simultaneously so you can diagnose cross-category root causes that are not visible when looking at one category in isolation.

INSTRUCTION: Diagnose the ROOT CAUSE that is common across failing categories. A single HTML bug often manifests as different symptoms in different test categories. Fix the root cause — do NOT patch each category's symptom independently.
${fixLearningsContext}
FAILING CATEGORIES:

${globalFailureSummary}
${globalPassingContext}${additionalPriorContext ? `\nADDITIONAL PRIOR PASSING TESTS (do not regress):\n${additionalPriorContext}\n` : ''}
FAILING TEST FILES:
\`\`\`javascript
${globalTestFilesBlock}
\`\`\`

CURRENT HTML:
${currentHtml}

${CDN_CONSTRAINTS_BLOCK}
- Do NOT move CDN <script> tags or change their order
- Do NOT change any CDN <script src="..."> URLs. The correct CDN domain is cdn.homeworkapp.ai — never change this to cdn.mathai.ai or any other domain
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block
- Do NOT remove or rename elements in <template id="game-template">
- Star display MUST update on game over
- Lives display DOM element MUST update immediately when a life is lost
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() IMMEDIATELY in endGame() — use 10s delay
- TimerComponent MUST be initialized with startTime: 0
- NEVER define a custom updateLivesDisplay() function
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window
- gameState.phase MUST be set at every state transition: 'playing', 'transition', 'gameover', 'results'
- Preserve ALL existing data-testid attributes
- waitForPackages() MUST have a 10000ms timeout that THROWS on expiry: if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')} — review model fails on missing or wrong timeout
- endGame() GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- window EXPOSURE: if DOMContentLoaded used, add window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; window.gameState=gameState; at global scope outside the callback. CRITICAL: syncDOMState() reads window.gameState — if not on window, ALL data-phase syncs fail.
- sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id,url}]) instead
- SENTRY ORDER: initSentry() MUST be called INSIDE the waitForPackages() callback, AFTER packages load — never before. Calling it before Sentry SDK loads throws ReferenceError → prevents ScreenLayout.inject() → CDN slot never renders.
- DEBUG FUNCTIONS: window.debugGame/testAudio/testPause/testResume/testSentry/verifySentry MUST NOT be on window — keep as local functions inside DOMContentLoaded. T1 errors on window-exposed debug functions.
- SCREENLAYOUT: if using PART-025, ScreenLayout.inject() MUST be called in the waitForPackages callback after FeedbackManager.init(). Missing this = #mathai-transition-slot button never appears = ALL tests fail.

OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ALL failing categories in a single HTML output — this is intentionally cross-category
- Do not rename functions, change element IDs, or remove game logic
- Make the smallest possible change that fixes the root cause`;
}

// ─── Step 4: Review prompt ────────────────────────────────────────────────────

/**
 * Builds the final spec compliance review prompt.
 *
 * @param {string} categoryResultsSummary - Per-category pass/fail summary
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildReviewPrompt(categoryResultsSummary, specContent, currentHtml) {
  return `You are a game quality reviewer. Review the following HTML game against its specification.

TEST RESULTS BY CATEGORY:
${categoryResultsSummary}

The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

HTML:
${currentHtml}`;
}

// ─── Step 4b: Review fix prompt ───────────────────────────────────────────────

/**
 * Builds the prompt to fix a review rejection.
 *
 * @param {string} rejectionReason - Full rejection output from reviewer
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildReviewFixPrompt(rejectionReason, specContent, currentHtml) {
  return `The following HTML game was reviewed against its specification and REJECTED.

REJECTION REASON:
${rejectionReason}

SPECIFICATION:
${specContent}

CURRENT HTML:
${currentHtml}

Fix ALL issues listed in the rejection reason in ONE pass.
CRITICAL: Do NOT change ANYTHING not mentioned in the rejection reason — do not refactor, rewrite, or touch code that already works.
Output the complete corrected HTML wrapped in a \`\`\`html code block.`;
}

// ─── Step 4b: Re-review prompt ────────────────────────────────────────────────

/**
 * Builds the re-review prompt used after a review fix attempt.
 * Note: This version has slightly relaxed guidance (ambiguous → APPROVED by default).
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (post-fix)
 * @returns {string}
 */
function buildReReviewPrompt(specContent, currentHtml) {
  return `You are a game quality reviewer. Review the following HTML game against its specification.

The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

## Important Guidance to Avoid False Positives

### RULE-001 (Global scope)
RULE-001 is SATISFIED if all game functions are declared at the top level of the script and event handlers (onclick= or addEventListener) call only those globally-declared functions.
RULE-001 does NOT require onclick= attributes — addEventListener() calling a global function is equally compliant.
RULE-001 FAILS only if event handlers reference functions inside a closure not accessible from global scope.

### Contract Compliance — gameState and postMessage
- window.gameState = { ... } IS the correct pattern — it exposes gameState on window as required.
- window.parent.postMessage(...) is the correct call for game events.
- Check the postMessage payload fields per the spec's contract section.

### RULE-003 (try/catch on async calls)
- Promise .catch((e) => { console.error(...) }) IS compliant for fire-and-forget async calls.
- All awaited async calls must use try/catch.

### RULE-005 (Cleanup in endGame)
- A delayed destroy via setTimeout IS compliant — cleanup originates from endGame().
- Either immediate or delayed cleanup PASSES RULE-005.

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous, resolve in favor of APPROVED unless there is clear evidence of failure.

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

HTML:
${currentHtml}`;
}

// ─── Step 5: Extract learnings prompt ────────────────────────────────────────

/**
 * Builds the prompt to extract cross-game learnings from build failures.
 *
 * @param {string} failureSummary - Formatted failure descriptions
 * @param {string} rejectionNote - Review rejection note (may be empty)
 * @returns {string}
 */
function buildExtractLearningsPrompt(failureSummary, rejectionNote) {
  return `You analyzed a MathAI game build that had test failures or review rejections.
Extract 1–4 SHORT, GENERALIZABLE bullet points about patterns that caused failures and how to fix them.
Focus on: HTML structure issues, Playwright selector patterns, CDN integration patterns, postMessage contract issues.
IGNORE game-specific content (names, numbers, colors). Write only patterns that apply to ANY future MathAI game build.
Keep each bullet to one sentence. Output ONLY bullet points (no prose, no headers):

FAILURES:
${failureSummary.slice(0, 2000)}${rejectionNote}`;
}

// ─── Targeted fix: user feedback fix prompt ───────────────────────────────────

/**
 * Builds the targeted fix prompt for applying user feedback to existing HTML.
 *
 * @param {string} feedbackPrompt - User feedback / fix description
 * @param {string} failingContext - Failing test descriptions (may be empty)
 * @param {string} passingContext - Note about currently passing tests (may be empty)
 * @param {string} currentHtml - Current HTML content
 * @param {string} specContent - Spec markdown content
 * @param {number} currentlyPassing - Number of currently passing tests
 * @returns {string}
 */
function buildTargetedFixPrompt(feedbackPrompt, failingContext, passingContext, currentHtml, specContent, currentlyPassing) {
  return `You are fixing an HTML game based on user feedback.

USER FEEDBACK:
${feedbackPrompt}
${failingContext}
${passingContext}

CURRENT HTML:
${currentHtml}

SPECIFICATION (for reference):
${specContent}

CRITICAL CDN CONSTRAINTS:
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget (.catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); })), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- Do NOT destroy CDN components immediately in endGame() — use 10s setTimeout delay
- TimerComponent startTime MUST be 0; endGame() MUST be async if it uses await
- Do NOT define a custom updateLivesDisplay() — let ProgressBarComponent handle it
- waitForPackages() MUST have a 10000ms timeout that THROWS on expiry: if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')}
- endGame() GUARD: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false; must be first lines
- window EXPOSURE (CDN games): window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; at global scope
- sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id,url}]) instead
- SENTRY ORDER: initSentry() MUST be inside waitForPackages() callback — never before it. Pre-SDK call throws → ScreenLayout.inject() never runs → CDN slot dead.
- DEBUG FUNCTIONS: NEVER assign debug fns to window (window.debugGame etc.) — local only inside DOMContentLoaded.
- SCREENLAYOUT: ScreenLayout.inject() MUST appear in waitForPackages callback after FeedbackManager.init().

INSTRUCTIONS:
- Apply ONLY the changes needed to address the user's feedback and failing tests
- Maintain all existing functionality — especially the ${currentlyPassing} currently passing tests
- Keep element IDs, data-testid attributes, function names, and game logic aligned with the spec
- Make the SMALLEST possible change that fixes the problem
- Output the complete fixed HTML wrapped in a \`\`\`html code block`;
}

module.exports = {
  REVIEW_SHARED_GUIDANCE,
  CDN_CONSTRAINTS_BLOCK,
  buildGenerationPrompt,
  buildCliGenPrompt,
  buildStaticFixPrompt,
  buildContractFixPrompt,
  buildEarlyReviewPrompt,
  buildEarlyReviewFixPrompt,
  buildEarlyReReviewPrompt,
  buildTestCasesPrompt,
  buildTestGenCategoryPrompt,
  buildTriagePrompt,
  buildFixPrompt,
  buildGlobalFixPrompt,
  buildReviewPrompt,
  buildReviewFixPrompt,
  buildReReviewPrompt,
  buildExtractLearningsPrompt,
  buildTargetedFixPrompt,
};
