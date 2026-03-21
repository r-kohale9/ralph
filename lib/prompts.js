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

const REVIEW_SHARED_GUIDANCE = `## Guidance to Avoid False Positives

### RULE-001 (Global scope)
SATISFIED if all game functions are declared at the top level and event handlers call only those globally-declared functions. addEventListener() calling a global function is equally compliant. FAILS only if handlers reference functions inside an inaccessible closure.

### Contract Compliance — gameState and postMessage
- window.gameState = { ... } IS the correct pattern.
- window.parent.postMessage(...) is the correct call for game events.
- Check the postMessage payload fields per the spec's contract section.
- postMessage MUST be sent on EVERY endGame() path — both 'victory' AND 'game_over'. A guard like \`if (reason === 'victory') { postMessage(...) }\` is a BUG — do NOT flag the unconditional pattern as non-compliant.

### RULE-003 (try/catch on async calls)
- Promise .catch((e) => { console.error(...) }) IS compliant for fire-and-forget async calls.
- All awaited async calls must use try/catch.

### RULE-005 (Cleanup in endGame)
- A delayed destroy via setTimeout IS compliant. Either immediate or delayed cleanup PASSES.

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous or requires running the game to verify, resolve in favor of APPROVED.`;

// ─── CDN constraints block ────────────────────────────────────────────────────
// Shared block injected into fix prompts. Single source of truth.

const CDN_CONSTRAINTS_BLOCK = `CRITICAL CDN CONSTRAINTS (do NOT violate while fixing):
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget: .catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); }), NEVER awaited
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- isProcessing=true SILENTLY BLOCKS clicks (early return only) — buttons stay visible, never hidden
- CDN init order is immutable: await FeedbackManager.init() → ScreenLayout.inject() → game template clone
- Do NOT add event listeners inside innerHTML setters — use event delegation on parent only
- Do NOT move or reorder CDN <script> tags. CDN domain MUST be storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai, cdn.mathai.ai, or any other domain. Use ONLY these exact URLs: feedback-manager→https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js, components→https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js, helpers→https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block — only add/modify the specific broken functionality
- Do NOT remove or rename elements in <template id="game-template"> — template corruption causes ALL tests to fail
- Star display MUST update on game over: show ☆☆☆ for 0 stars in the game-over code path; calcStars() must have: if(outcome==='game_over') return 0;
- Lives display DOM element MUST update immediately when a life is lost, before any animation
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() immediately in endGame() — use 10s delay: setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
- TimerComponent MUST be initialized with startTime: 0 (never startTime: 1)
- NEVER define a custom updateLivesDisplay() — ProgressBarComponent handles lives via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window; window.gameState MUST be on window — syncDOMState() reads window.gameState; if absent data-phase is NEVER set and ALL waitForPhase() calls timeout
- waitForPackages() MUST have a 10000ms timeout that THROWS: if(elapsed>=timeout){throw new Error('Packages failed to load within 10s')}
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- Preserve ALL existing data-testid attributes — never remove them
- gameState.phase MUST be set at every state transition: 'playing', 'transition', 'gameover', 'results'. Call syncDOMState() immediately after every gameState.phase assignment.
- endGame() GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id,url}]) instead
- FeedbackManager: ONLY call FeedbackManager.init() if spec explicitly says PART-017 Feedback Integration: YES or popupProps is specified. If PART-017=NO or absent, use FeedbackManager.sound.play()/playDynamicFeedback() directly — NEVER call FeedbackManager.init() (it shows a blocking popup that causes 100% test failure non-deterministically).
- isActive GUARD: every answer/click handler MUST start with: if (!gameState.isActive) return; gameState.isActive = false; ... gameState.isActive = true;
- TransitionScreen ROUTING: every transitionScreen.show() onComplete MUST set gameState.phase to the correct next phase
- SENTRY ORDER: initSentry() MUST be called INSIDE the waitForPackages() callback, AFTER packages load
- verifySentry(): use Sentry.getCurrentHub().getClient() — NEVER Sentry.getClient() (does not exist on v7/v8)
  window.verifySentry = () => { const client = Sentry.getCurrentHub().getClient(); console.log('Sentry active:', !!client); };
- DEBUG FUNCTIONS: window.debugGame/testAudio/testPause/testResume/testSentry/verifySentry MUST be exposed on window — define as named functions inside DOMContentLoaded then assign: window.debugGame = debugGame; window.testAudio = testAudio; etc. The spec checklist requires these on window.
- VISIBILITYTRACKER — correct usage pattern (violations cause review rejection):
  CORRECT — options-object constructor with FeedbackManager integration:
    const visibilityTracker = new VisibilityTracker({
      onInactive: () => {
        sound.pause();           // NOT sound.stopAll()
        timer.pause({ fromVisibilityTracker: true });
      },
      onResume: () => {
        sound.resume();
        timer.resume({ fromVisibilityTracker: true });
      },
      popupProps: {
        title: 'Game Paused',
        description: 'Return to continue',
        buttonText: 'Continue'
      }
    });
  RULES:
  - timer.pause() and timer.resume() MUST pass { fromVisibilityTracker: true } option
  - Use sound.pause()/sound.resume() — NOT sound.stopAll()
  - popupProps MUST include title, description, and buttonText
  - DO NOT pass a DOM element to the constructor — it takes an options object
  - DO NOT call tracker.init() or set tracker.visible — these do NOT exist on VisibilityTracker
- POPUP-BACKDROP TEARDOWN: in VisibilityTracker onResume AND in restartGame(), always run: const bd=document.getElementById('popup-backdrop'); if(bd){bd.style.display='none';bd.style.pointerEvents='none';} — un-hidden backdrop intercepts ALL clicks after resume, causing game-flow/mechanics tests to fail with click timeout
- SCREENLAYOUT: ScreenLayout.inject() MUST be called in the waitForPackages callback after FeedbackManager.init()
- INITIAL TRANSITIONSCREEN.SHOW(): after 'transitionScreen = new TransitionScreenComponent({...})' in DOMContentLoaded, ALWAYS call transitionScreen.show({...}) as the LAST init step to populate #mathai-transition-slot with the start button. WITHOUT this call the slot is empty and ALL tests timeout. restartGame() MUST also call transitionScreen.show(). NEVER call transitionScreen.show() before ScreenLayout.inject() — the slot does not exist yet.`;

// ─── Step 1: HTML generation prompt ──────────────────────────────────────────

/**
 * Builds the LLM prompt for generating the game HTML from a spec.
 *
 * @param {string} specContent - Full spec markdown content
 * @param {string} learningsBlock - Formatted cross-game learnings block (may be empty string)
 * @param {string} [gameLearningsBlock] - Formatted same-game prior learnings block (may be empty string)
 * @returns {string}
 */
function buildGenerationPrompt(specContent, learningsBlock, gameLearningsBlock = '') {
  return `You are an expert HTML game assembler. The specification below is a self-contained assembly book — it contains ALL code blocks, element IDs, function signatures, CSS, game logic, and verification checks needed to produce a working game.

INSTRUCTIONS:
- Follow the specification EXACTLY — do not invent new element IDs, function names, or game logic
- Assemble all sections into a single index.html file (all CSS in <style>, all JS in <script>)
- Copy code blocks from the spec verbatim, filling in only where placeholders exist
- Use the star calculation logic defined in the spec (Section 11 or Parts table), not a generic formula
- The spec's Section 15 (Verification Checklist) lists every requirement — ensure all items pass
- Output ONLY the complete HTML file content, wrapped in a \`\`\`html code block

DATA-TESTID ATTRIBUTES — required on all interactive and observable elements:
- Every interactive and observable state element needs a data-testid attribute
- Required minimums: data-testid="answer-input", "btn-check", "btn-restart", "score-display", "stars-display", "lives-display", "btn-reset" (if applicable)
- Adjustment controls: data-testid="btn-{which}-plus" / "btn-{which}-minus"
- Multiple-choice options: data-testid="option-{index}" (0-indexed)
- IDs in the spec take precedence — keep spec ID AND add matching data-testid

${CDN_CONSTRAINTS_BLOCK}

ADDITIONAL GENERATION RULES:

1. GAME DOM — template pattern required for ScreenLayout:
   - <div id="app"></div> stays EMPTY in static HTML
   - ALL game elements go inside <template id="game-template"> placed OUTSIDE #app
   - After ScreenLayout.inject(), clone into #gameContent:
     const tpl = document.getElementById('game-template');
     if (tpl) document.getElementById('gameContent').appendChild(tpl.content.cloneNode(true));

2. CDN INIT ORDER — immutable sequence:
   await waitForPackages();
   await FeedbackManager.init();
   initSentry();              // ONLY here — NEVER before waitForPackages() resolves
   ScreenLayout.inject(...);
   // clone game-template + initGame()

3. PART-003 waitForPackages — exact implementation required:
   async function waitForPackages() {
     const timeout = 10000; const interval = 50; let elapsed = 0;
     while (typeof FeedbackManager === 'undefined') {
       if (elapsed >= timeout) { throw new Error('Packages failed to load within 10s'); }
       await new Promise(resolve => setTimeout(resolve, interval));
       elapsed += interval;
     }
   }

4. game_init PHASE — REQUIRED PATTERN (copy exactly):
   case 'game_init':
     gameState.phase = 'playing';  // REQUIRED FIRST LINE — do NOT move or defer
     // ... rest of init logic
     break;

5. POSTMESSAGE — always send to PARENT: window.parent.postMessage(payload, '*')
   CDN games MUST use the nested data structure below — NOT a flat payload. Contract tests check
   data.metrics.*, data.events, data.signals, data.duration_data etc. A flat top-level payload causes
   ALL contract toHaveProperty() assertions to fail.

   REQUIRED PATTERN — copy this exactly in endGame():
   const signalPayload = signalCollector ? signalCollector.seal() : { events: [], signals: {}, metadata: {} };
   const metrics = {
     score: gameState.score,         // required — final score (0 if no points)
     accuracy: <computed accuracy>,  // required — percentage 0-100
     time: <totalTime>,              // required — seconds elapsed
     stars: calcStars(),             // required — result of calcStars(): 0|1|2|3
     livesRemaining: gameState.lives,// required — lives left at end
     attempts: gameState.attempts,   // required — attempt history array
     duration_data: { ...gameState.duration_data, currentTime: new Date().toISOString() }  // required
   };
   window.parent.postMessage({
     type: 'game_complete',          // required string — always 'game_complete'
     data: {
       metrics,                      // required nested object — NOT spread at top level
       attempts: gameState.attempts, // required
       ...signalPayload,             // spreads: events, signals, metadata from SignalCollector
       completedAt: Date.now()       // required
     }
   }, '*');

   ✗ WRONG — flat payload, contract tests will fail:
     window.parent.postMessage({ type: 'game_complete', score: 5, stars: 2, total: 10 }, '*');
   ✗ WRONG — metrics spread at top level, data.metrics will be undefined:
     window.parent.postMessage({ type: 'game_complete', data: { score, stars, ...metrics } }, '*');
   ✓ CORRECT — metrics as nested object inside data:
     window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts, ...signalPayload, completedAt } }, '*');

   Also include any spec-specific fields inside data (e.g. spec-defined scoring overrides).

   CRITICAL: endGame() MUST send postMessage on EVERY termination path — both 'victory' AND 'game_over'.
   NEVER guard with \`if (reason === 'victory')\` — game_over sends the SAME payload.
   WRONG: if (outcome === 'victory') { window.parent.postMessage(...) }
   RIGHT: window.parent.postMessage(...) called unconditionally inside endGame()

6. VISIBILITYTRACKER — expose as window.visibilityTracker; similarly window.timer = timer

7. MULTI-STEP CONTROLS — never hide +/- adjustment buttons after first click

8. STAR DISPLAY — game over (lives=0): ALWAYS show ☆☆☆; calcStars() MUST have: if (outcome === 'game_over') return 0;
   Use ONLY the star threshold criteria defined in the spec — do NOT invent accuracy-based conditions.
   WRONG: if (accuracy >= 80) return 3; (unless spec explicitly defines this threshold)
   RIGHT: use only time/score thresholds the spec specifies

9. INITIAL TRANSITIONSCREEN.SHOW() — the LAST step in DOMContentLoaded after all CDN components are initialized:
   If the spec uses PART-025 (TransitionScreen / ScreenLayout), the DOMContentLoaded init block MUST end with a
   transitionScreen.show() call to populate #mathai-transition-slot with the start button.
   WITHOUT this call, #mathai-transition-slot remains empty and ALL tests timeout on the very first assertion.

   REQUIRED PATTERN — final lines of DOMContentLoaded (after transitionScreen = new TransitionScreenComponent(...)):
     transitionScreen.show({
       icons: ['<icon>'],
       title: '<Game Title>',
       subtitle: '<tagline from spec>',
       buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }]
     });

   ✗ WRONG — no initial transitionScreen.show(), slot is empty:
     window.addEventListener('DOMContentLoaded', async () => {
       await waitForPackages(); await FeedbackManager.init(); ScreenLayout.inject('app', {...});
       transitionScreen = new TransitionScreenComponent({ autoInject: true });
       // ← MISSING: transitionScreen.show() — #mathai-transition-slot has no button, ALL tests timeout
     });

   ✓ CORRECT — transitionScreen.show() as last init step:
     window.addEventListener('DOMContentLoaded', async () => {
       await waitForPackages(); await FeedbackManager.init(); ScreenLayout.inject('app', {...});
       transitionScreen = new TransitionScreenComponent({ autoInject: true });
       // ... other init (timer, progressBar, visibilityTracker, postMessage listener) ...
       transitionScreen.show({
         icons: ['<icon>'], title: '<Game Title>', subtitle: '<tagline>',
         buttons: [{ text: "Let's go!", type: 'primary', action: () => startGame() }]
       });
     });

   The restartGame() function MUST ALSO call transitionScreen.show() to re-populate the slot on restart.
   DO NOT call transitionScreen.show() BEFORE ScreenLayout.inject() — the slot doesn't exist yet.

20. ROUND LIFECYCLE RESET — required at the START of every loadRound() / initRound() / setupRound() call:
    gameState.isProcessing = false;   // reset from previous round — NEVER omit
    gameState.isActive = true;        // re-enable click handlers — NEVER omit
    syncDOMState();                   // push current phase to #app data-* attributes
    These MUST be the FIRST three lines inside loadRound(). If omitted, isProcessing=true from the
    prior round silently blocks ALL clicks and edge-case tests timeout with locator.click Timeout.
    This is the #1 cause of game-flow and edge-case test timeouts in the fix loop.

21. SYNCDOMESTATE CALL SITES — call syncDOMState() immediately after EVERY gameState.phase assignment:
    - game_init → gameState.phase = 'playing'; syncDOMState();        // already in rule 4
    - round complete → gameState.phase = 'transition'; syncDOMState();
    - transitionScreen.show() onComplete → gameState.phase = 'playing'; syncDOMState();
    - endGame (game over path) → gameState.phase = 'gameover'; syncDOMState();
    - endGame (victory path) → gameState.phase = 'results'; syncDOMState();
    - restartGame → gameState.phase = 'playing'; syncDOMState();
    Missing ANY of these causes data-phase to lag, making waitForPhase() timeout indefinitely.

22. PHASE-GATED ELEMENT VISIBILITY — game elements MUST be visible in the correct phase for tests to pass:
    - PLAYING phase: answer-input, btn-check/btn-submit, score-display, lives-display, question/problem area MUST be visible
    - GAMEOVER/RESULTS phase: stars-display, final score, btn-restart MUST be visible; question area SHOULD be hidden
    - START (transition slot): #mathai-transition-slot button visible BEFORE startGame, HIDDEN after startGame
    - Any element with display:none or visibility:hidden during 'playing' phase will cause ALL tests that check
      that element to fail with toBeVisible. NEVER use display:none on elements that tests must interact with
      during gameplay — use opacity:0 or pointer-events:none if visual hiding is needed without DOM removal.
    - gameContent div and its children MUST be visible once game-template is cloned into #gameContent after ScreenLayout.inject()

23. GAME CONTENT VISIBILITY AFTER CDN INIT — the game-template clone into #gameContent must be visible:
    After ScreenLayout.inject() and game-template clone, ALL interactive elements inside #gameContent MUST
    have no CSS that hides them by default (no display:none, no visibility:hidden, no opacity:0 on container).
    If you need to show/hide sections between phases, use CSS classes toggled by JS — NOT inline display:none
    on the container that wraps all game elements. A hidden #gameContent causes 100% toBeVisible failure.

24. POPUP-BACKDROP LIFECYCLE — #popup-backdrop MUST be explicitly hidden after every dismissal:
    The VisibilityTracker's onResume callback leaves #popup-backdrop as a full-screen fixed overlay.
    If not explicitly hidden, it intercepts ALL pointer events — clicks on game cells, Next Round buttons,
    and answer inputs silently fail (the backdrop receives them, not the element underneath).
    REQUIRED: in VisibilityTracker onResume callback, AND in restartGame():
      const bd = document.getElementById('popup-backdrop');
      if (bd) { bd.style.display = 'none'; bd.style.pointerEvents = 'none'; }
    NEVER rely on the CDN component to auto-hide it — teardown is not guaranteed in all code paths.

SPECIFICATION:
${specContent}${gameLearningsBlock}${learningsBlock}`;
}

// ─── Step 1: HTML generation prompt (claude CLI variant) ──────────────────────

/**
 * Builds the prompt for generating HTML via the claude -p CLI tool.
 *
 * @param {string} specPath - Absolute path to the spec file
 * @param {string} htmlFile - Absolute path where the HTML should be written
 * @param {string} learningsBlock - Formatted cross-game learnings block (may be empty string)
 * @param {string} [gameLearningsBlock] - Formatted same-game prior learnings block (may be empty string)
 * @returns {string}
 */
function buildCliGenPrompt(specPath, htmlFile, learningsBlock, gameLearningsBlock = '') {
  return `You are generating a MathAI game HTML file.

Read the game-specific template at: ${specPath}
Generate the complete index.html file following the template exactly.
Write the output to: ${htmlFile}

Rules:
- Single file, all CSS in one <style>, all JS in one <script>
- Follow every instruction in the template EXACTLY — copy all code blocks verbatim
- PART-008: handlePostMessage MUST check event.data.type === 'game_init' and set gameState.phase = 'playing' as VERY FIRST LINE in that case (before setupGame() or any other logic) — test harness calls waitForPhase('playing') immediately after game_init
- IF spec uses PART-010/SignalCollector: endGame postMessage MUST spread ...signalPayload from signalCollector.seal()
- IF spec uses PART-030/Sentry: ALL catch blocks MUST call Sentry.captureException(e); initSentry() ONLY inside waitForPackages callback — NEVER before waitForPackages() resolves
- PART-012 DEBUG FUNCTIONS: debug/test functions (debugGame, testAudio, testPause, testResume, testSentry, verifySentry) MUST be exposed on window — define inside DOMContentLoaded then assign: window.debugGame = debugGame; window.testAudio = testAudio; etc.
- window EXPOSURE: add window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; window.gameState=gameState; at global scope
- endGame GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- CDN URL: ALWAYS storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai or cdn.mathai.ai. Use ONLY: feedback-manager/index.js, components/index.js, helpers/index.js from https://storage.googleapis.com/test-dynamic-assets/packages/
- PART-003 waitForPackages: timeout=10000ms, MUST throw on timeout (not console.error)
- ROUND LIFECYCLE RESET: first three lines of every loadRound()/initRound()/setupRound() MUST be: gameState.isProcessing = false; gameState.isActive = true; syncDOMState(); — stale isProcessing=true from prior round silently blocks ALL clicks
- SYNCDOMESTATE CALL SITES: call syncDOMState() after EVERY gameState.phase assignment — game_init, round complete, transitionScreen onComplete, endGame (gameover + results paths), restartGame — missing any causes waitForPhase() to timeout
- POSTMESSAGE REQUIRED FIELDS: CDN games MUST use nested data structure: window.parent.postMessage({ type: 'game_complete', data: { metrics: { score, accuracy, time, stars, livesRemaining, attempts, duration_data }, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*') — NEVER flat top-level fields. Contract tests check data.metrics.stars, data.events, data.duration_data — a flat payload causes ALL contract assertions to fail.
- DATA-TESTID REQUIRED: every <button>, <input>, and <select> element MUST have a data-testid attribute. Required minimums: data-testid="answer-input" (text/number inputs), data-testid="btn-check" or "btn-submit" (submit/check buttons), data-testid="btn-restart" (restart button), data-testid="score-display", data-testid="stars-display", data-testid="lives-display" (if applicable). Multiple-choice buttons: data-testid="option-{index}" (0-indexed). Missing data-testid causes ALL mechanics tests to fail with locator errors.
${gameLearningsBlock}${learningsBlock}
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
Make the smallest possible change that fixes only the listed errors.

${CDN_CONSTRAINTS_BLOCK}

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
 * Also used by buildEarlyReReviewPrompt (same structure, different call site).
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content
 * @returns {string}
 */
function buildEarlyReviewPrompt(specContent, currentHtml) {
  return _buildEarlyReviewBody(specContent, currentHtml);
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
Do NOT change any passing aspects.

CRITICAL — DO NOT TOUCH (leave byte-for-byte identical):
- ALL <script> tags in <head> (CDN package loading, Sentry, any SDK initialization)
- The <link> tags in <head>
- The mathai-transition-slot div structure (if present)
- window.gameState initialization

Only modify game logic in the <body> that directly fixes the listed violations.

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
  return _buildEarlyReviewBody(specContent, currentHtml);
}

/** Shared body for early review and early re-review (identical structure). */
function _buildEarlyReviewBody(specContent, currentHtml) {
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
function buildTestCasesPrompt(specContent, gameFeaturesBlock) {
  const featuresSection = gameFeaturesBlock ? `\n${gameFeaturesBlock}\n` : '';
  return `You are a QA analyst. Analyze the following game specification and produce a structured list of test cases describing WHAT the game should do.

RULES:
1. Only reference DOM elements in the ACTUAL RUNTIME DOM snapshot (injected at test gen). Do NOT invent element IDs.
2. Every test case MUST include: interaction type, expected state change (phase, score, lives, postMessage), and preconditions.
3. If window.gameState is NOT in WINDOW.GAMESTATE SHAPE when provided, flag it — code-gen step must use polling instead of waitForPhase.
4. Prefer SIMPLE test cases: single-action → single-assertion.
5. For "game-flow" tests: specify which screen transitions FROM and TO, based strictly on spec flow.
6. For "contract" tests: specify the exact postMessage fields expected — do not leave them vague.
7. LIVES SYSTEM CHECK — before generating any lives-related test case: scan the spec for the ProgressBar configuration. If the spec shows totalLives: 0, livesEnabled: false, "no lives", or ProgressBar configured WITHOUT a lives count (or with totalLives omitted), do NOT generate test cases that assert lives/hearts decrease on wrong answers. Instead, test accuracy tracking or score changes. Only generate lives-decrement test cases when the spec explicitly configures a finite number of lives (e.g. totalLives: 3).

Categories to cover:
- "game-flow": screen transitions (start → game → level transition → end screen)
- "mechanics": core interactions (input, adjustment controls, check/submit, scoring)
- "level-progression": how levels change (difficulty, content, round structure)
- "edge-cases": boundary values, invalid input, rapid actions, final life/round
- "contract": gameOver postMessage event (type, score, stars, total fields)

Output a JSON array of test cases. Each test case has:
- "name": short test case name
- "category": one of game-flow | mechanics | level-progression | edge-cases | contract
- "description": what is being validated (interaction type + expected state change)
- "steps": array of human-readable steps (specific about buttons, inputs, assertions)

Output ONLY valid JSON wrapped in a \`\`\`json code block. No prose.
${featuresSection}
SPECIFICATION:
${specContent}`;
}

// ─── Step 2b: Per-category test generation prompt ────────────────────────────

/**
 * Extracts canonical phase names for a game from HTML content and DOM snapshot.
 *
 * Sources (in priority order):
 *   1. WINDOW.GAMESTATE SHAPE section from domSnapshot (e.g. `phase: string "init"`)
 *   2. gameState.phase assignments in htmlContent (e.g. `gameState.phase = 'playing'`)
 *   3. phase comparisons in htmlContent (e.g. `phase === 'results'`)
 *
 * Returns a deduplicated array of phase name strings, or [] if none found.
 *
 * @param {string} htmlContent - Current HTML content
 * @param {string|null} domSnapshot - DOM snapshot string (may be null)
 * @returns {string[]}
 */
function extractPhaseNamesFromGame(htmlContent, domSnapshot) {
  const phases = new Set();

  // 1. Parse WINDOW.GAMESTATE SHAPE section from domSnapshot: `  phase: string "X"`
  if (domSnapshot) {
    const gsMatch = domSnapshot.match(/WINDOW\.GAMESTATE SHAPE[\s\S]*?(?=\n\n|\nACTUAL|\nSTART|\nGAME\s|$)/i);
    const searchText = gsMatch ? gsMatch[0] : domSnapshot;
    // Matches: `  phase: string "init"` or `  phase: string "playing"`
    const phaseLineMatch = searchText.match(/^\s*phase:\s*string\s+"([^"]+)"/m);
    if (phaseLineMatch) phases.add(phaseLineMatch[1]);
  }

  // 2. Parse gameState.phase assignments in HTML: `gameState.phase = 'X'` or `gameState.phase='X'`
  if (htmlContent) {
    const assignMatches = htmlContent.matchAll(/gameState\.phase\s*=\s*['"`]([a-z][a-z0-9_-]*)['"`]/gi);
    for (const m of assignMatches) phases.add(m[1]);

    // 3. Parse phase comparisons: `phase === 'X'`, `phase == 'X'`, `.phase !== 'X'`
    const cmpMatches = htmlContent.matchAll(/\.phase\s*[!=]=+\s*['"`]([a-z][a-z0-9_-]*)['"`]/gi);
    for (const m of cmpMatches) phases.add(m[1]);

    // 4. Parse data-phase attributes in HTML (static): `data-phase="X"`
    const dpMatches = htmlContent.matchAll(/data-phase\s*=\s*['"]([a-z][a-z0-9_-]*)['"][^>]*/gi);
    for (const m of dpMatches) phases.add(m[1]);
  }

  // Remove non-phase tokens that commonly appear in comparisons (e.g. 'undefined', 'null')
  const excluded = new Set(['undefined', 'null', 'true', 'false', 'none', 'unknown']);
  // Normalize phase names to match syncDOMState() output (what data-phase on #app will actually be)
  const normalizePhase = (p) =>
    p
      .replace('game_over', 'gameover')
      .replace('game_complete', 'results')
      .replace('start_screen', 'start')
      .replace('game_init', 'start')
      .replace('game_playing', 'playing');
  return [...new Set([...phases].filter((p) => p.length >= 2 && !excluded.has(p)).map(normalizePhase))];
}

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
 * @param {string} [opts.gameFeaturesBlock] - GAME FEATURE FLAGS block (may be empty/undefined)
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
    gameFeaturesBlock,
    domSnapshot,
    htmlContent,
  } = opts;

  return `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

MANDATORY RULES — violating any of these causes immediate test failure:
1. ONLY use selectors from the ACTUAL RUNTIME DOM snapshot below. NEVER invent element IDs or class names. If a selector is not in the snapshot, use page.evaluate() to read window.gameState instead.
2. Generate the SIMPLEST possible test that validates the behavior. Prefer single-action tests over multi-step chains. If a test needs 5+ steps, split it or use skipToEnd().
3. Use \`waitForPhase(page, phase)\` ONLY if the DOM snapshot confirms data-phase is present on #app (i.e. the WINDOW.GAMESTATE SHAPE section shows 'phase'). If absent, use \`page.evaluate(() => window.gameState?.phase)\` polling instead.
4. Every \`waitForPhase\` call MUST include an explicit timeout: \`await waitForPhase(page, 'playing', 10000)\`
5. If game content is needed — use \`fallbackContent\` from the shared boilerplate, NOT hardcoded strings from the HTML.
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
7. Helper usage:
   - \`await answer(page, true)\` / \`await answer(page, false)\` — correct/wrong answer
   - \`expect(await getLives(page)).toBe(2)\` — integer, not emoji
   - \`expect(await getScore(page)).toBeGreaterThan(0)\`
   - \`expect(await getRound(page)).toBe(2)\`
   - \`await skipToEnd(page, 'victory')\` / \`await skipToEnd(page, 'game_over')\`

RENDERING RULES — toBeVisible/toBeHidden failures are the #1 test failure cause — follow these precisely:
R1. PHASE-GATED VISIBILITY: Game-play elements (answer inputs, score display, lives, question area) are ONLY visible AFTER startGame() completes. NEVER assert toBeVisible() on playing-phase elements before calling startGame(). Pattern:
    WRONG: await expect(page.locator('[data-testid="answer-input"]')).toBeVisible(); // fails — game not started yet
    RIGHT: await startGame(page); await expect(page.locator('[data-testid="answer-input"]')).toBeVisible();
R2. TRANSITION SLOT AFTER startGame(): After startGame() resolves, #mathai-transition-slot button is GONE (slot is cleared). NEVER assert toBeVisible() on '#mathai-transition-slot button' immediately after startGame(). The slot button only reappears on level transitions — use clickNextLevel() to wait for it.
    WRONG: await startGame(page); await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible();
    RIGHT: await startGame(page); await answer(page, true); /* complete a level */ await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible();
R3. NEVER ACCESS window.gameState.content DIRECTLY: Use fallbackContent instead. window.gameState.content may be undefined or have a different shape than expected.
    WRONG: const rounds = window.gameState.content.rounds; // TypeError if content undefined
    RIGHT: use fallbackContent.rounds — check fallbackContent.rounds?.length > 0 before accessing
R4. NEVER USE toHaveText() WITH HARDCODED GAME CONTENT: Dynamic content (question text, round numbers, scores) changes per game instance. Assert structure instead of exact values.
    WRONG: await expect(page.locator('#question-text')).toHaveText('What is 3 + 4?');
    RIGHT: await expect(page.locator('#question-text')).toBeVisible(); // or check length > 0
R5. RESULTS/GAMEOVER SCREEN ELEMENTS: Elements on the results or game-over screen (stars display, final score, restart button) are only visible AFTER the game ends. To reach that state, use skipToEnd(page, 'victory') or skipToEnd(page, 'game_over'), then waitForPhase() BEFORE asserting visibility.

CATEGORY FOCUS: ${categoryDescription}

IMPLEMENT ALL ${testCaseCount} TEST CASES BELOW — one test() per case, no skipping, no merging:
${testCasesText}

Your test.describe() block MUST contain exactly ${testCaseCount} test() calls.

HELPER FUNCTION BEHAVIOR:

startGame(page): Clicks through ALL initial transition screens until the game is active. After startGame() resolves, #mathai-transition-slot button is NOT visible. NEVER call clickNextLevel() right after startGame().

clickNextLevel(page): Waits for #mathai-transition-slot button to be visible, then clicks it. ONLY for MID-GAME level transitions — NEVER right after startGame().

dismissPopupIfPresent(page): Dismisses any popup/backdrop (audio permission, etc.).

Transition slot selectors (CDN constants — always use these):
  - Button: page.locator('#mathai-transition-slot button').first()
  - Title: page.locator('#transitionTitle')
  - Subtitle: page.locator('#transitionSubtitle')
  - WRONG: '.game-btn', '.btn-primary' — button class is 'mathai-transition-btn'

Progress slot selectors:
  - Rounds/progress: page.locator('#mathai-progress-slot .mathai-progress-text')
  - Lives: page.locator('#mathai-progress-slot .mathai-lives-display')

Game-specific selectors: USE THE DOM SNAPSHOT below. Do NOT guess element IDs.

Already defined globally — DO NOT redefine:
  dismissPopupIfPresent(page), startGame(page), clickNextLevel(page)
  waitForPhase(page, phase, timeout?) — waits for #app[data-phase="phase"]
  getLives(page), getScore(page), getRound(page) — return integers from data-* attributes
  skipToEnd(page, reason?) — calls window.__ralph.endGame(reason); reason='victory'|'game_over'
  answer(page, correct?) — calls window.__ralph.answer(correct); waits for processing
  test.beforeEach() — already navigates to page and waits for initialization
  fallbackContent — captured game content; fallbackContent.rounds may be empty [], always check length

OUTPUT INSTRUCTIONS:
- Output ONLY a single test.describe('${category}', () => { ... }); block
- Do NOT include import statements, beforeEach, helper function definitions, or fallbackContent
- Start directly with: test.describe('${category}', () => {
- Use test() for each case — NOT nested test.describe()
- Pure JavaScript — no TypeScript annotations
- Use double quotes for test() names
- NEVER access window.gameState.content — use fallbackContent instead
- If evaluating JS state: expect(await page.evaluate(() => window.x)).toBe(v) — NOT await expect(page.evaluate(...))
- Do NOT generate tests requiring real wall-clock delays for time-based scoring — test endGame() postMessage payload directly
- Do NOT call Object.defineProperty(document, 'visibilityState') in test body — already defined in beforeEach. Do NOT write tests relying on Page Visibility API (visibilityState, visibilitychange) — harness permanently overrides visibilityState to 'visible'
- For game-over tests: use skipToEnd(page, 'game_over') then waitForPhase(page, 'gameover')
- For restart tests: after clicking 'Try Again'/'Play Again', use startGame(page) to click through start transition
- NEVER assert CDN ProgressBar lives text like toHaveText("❤️❤️") — use getLives(page) instead
- LIVES SYSTEM CHECK: Before generating any test that asserts lives/hearts decrease on a wrong answer, check the spec (embedded in the HTML or provided above) for the ProgressBar configuration. If totalLives: 0, livesEnabled: false, "no lives", or totalLives is absent/0, do NOT generate a lives-decrement assertion. Instead assert accuracy tracking or score changes. Only generate expect(await getLives(page)).toBe(N-1) style assertions when the spec explicitly sets a finite totalLives (e.g. totalLives: 3).
- NEVER assert exact timer text like toBe('00:00') — check visibility: await expect(page.locator('#mathai-timer-slot')).toBeVisible()
- To trigger endGame without playing all rounds: use skipToEnd(page, 'victory')
- When testing re-clicking a "correct" cell: use cell.click({ force: true }) — CSS pointer-events:none prevents plain click
${category === 'mechanics' ? `
MECHANICS-SPECIFIC RULES (highest failure rate category — follow precisely):
M1. NEVER hardcode expected lives/score values — always read the INITIAL value first, then assert the delta:
    WRONG: expect(await getLives(page)).toBe(2);
    RIGHT: const livesBefore = await getLives(page); await answer(page, false); expect(await getLives(page)).toBe(livesBefore - 1);
M2. AFTER any answer(page, false) or direct click that should trigger feedback, always wait for isProcessing to clear before asserting state:
    await expect.poll(async () => await page.evaluate(() => !window.gameState?.isProcessing), { timeout: 5000 }).toBe(true);
    (Note: answer() already does this — only needed when clicking elements directly, not via answer())
M3. When checking cell/grid text that may have NESTED child elements (e.g. cage-sum badges, subscripts), use data-value attribute instead of toHaveText:
    WRONG: await expect(page.locator('[data-row="0"][data-col="0"]')).toHaveText("1"); // breaks when cell has child span with cage-sum
    RIGHT: expect(await page.locator('[data-row="0"][data-col="0"]').getAttribute('data-value')).toBe('1');
M4. For timer tests: NEVER assert specific timer text values. Only check visibility or that the timer changed:
    WRONG: await expect(page.locator('#timer-container')).not.toHaveText('00:00');
    RIGHT: await expect(page.locator('#timer-container')).toBeVisible(); // or check data-phase changed
M5. For score/lives tests that require multiple answers: use the answer() helper in a loop, not direct element clicks — answer() waits for isProcessing to clear between answers:
    for (let i = 0; i < 3; i++) { await answer(page, true); }
    const score = await getScore(page);
    expect(score).toBeGreaterThan(0); // use toBeGreaterThan(0) not toBe(exact_value) unless spec defines exact points` : ''}
${category === 'game-flow' ? (() => {
  const phaseNames = extractPhaseNamesFromGame(htmlContent, domSnapshot);
  if (phaseNames.length === 0) return '';
  // Detect likely sequence: init/start → playing/game/active → results/gameover
  const startPhases = phaseNames.filter(p => /^(init|start|loading)$/.test(p));
  const playPhases = phaseNames.filter(p => /^(playing|game|active|in.game|round)$/.test(p));
  const endPhases = phaseNames.filter(p => /^(results|gameover|game.over|complete|finished|victory|end)$/.test(p));
  const otherPhases = phaseNames.filter(p => !startPhases.includes(p) && !playPhases.includes(p) && !endPhases.includes(p));
  const allInOrder = [...startPhases, ...playPhases, ...endPhases, ...otherPhases];
  const sequenceHint = allInOrder.length >= 2
    ? `\nPhase transition sequence (inferred): ${allInOrder.join(' → ')}`
    : '';
  return `
GAME-FLOW SPECIFIC RULES:
GF1: PHASE NAMES FROM THIS GAME'S CODE
The following phase names were found in this game's HTML/runtime state, already normalized to match what syncDOMState() sets on data-phase — use ONLY these exact strings in waitForPhase() calls:
  ${allInOrder.map(p => `'${p}'`).join(', ')}${sequenceHint}
NEVER use phase names not in this list (e.g. do NOT use 'playing' if it is not listed; do NOT use 'active', 'in-progress', 'started' unless listed).
CRITICAL: syncDOMState() normalizes raw game-code phase names. NEVER use the raw names in waitForPhase() — use ONLY the normalized equivalents: game_over→gameover, game_complete→results, start_screen→start, game_init→start, game_playing→playing.
If waitForPhase() is needed after a game action, assert the phase from the list above that matches the expected post-action state.
GF2: If data-phase is NOT set on #app (WINDOW.GAMESTATE SHAPE shows phase: string "init" at snapshot time), it means syncDOMState() runs after init — waitForPhase() WILL work once the game starts, but only with phase names from this game's actual code.
`;
})() : ''}
- Wrap output in a \`\`\`javascript code block
${learningsBlock}${testHintsBlock}${gameFeaturesBlock ? `\n${gameFeaturesBlock}\n` : ''}${domSnapshot ? `\n${domSnapshot}\n` : ''}
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
- window.__ralph.setLives(n), endGame(reason), getLastPostMessage() are ALL implemented and work correctly.
- If a test calls setLives() and the error is NOT "setLives is not a function", then setLives() is NOT the problem — diagnose the ACTUAL error.

KNOWN HTML BUGS — always diagnose as fix_html:
- TypeError on window.__ralph.setLives|jumpToRound|getLastPostMessage|syncDOMState|endGame|answer → window.__ralph is undefined → test harness NOT injected → JS error prevented initialization → fix the HTML.
- "is not a function" on any window.__ralph method → page init failed → fix the HTML.

KNOWN TEST BUGS — always diagnose as skip_test:
- TimeoutError: locator.click timeout on a .correct cell → pointer-events:none; test is re-clicking a disabled cell.
- TypeError on window.gameState.events.filter|length → game doesn't track events array; test assumption wrong.
- Cannot redefine property: visibilityState → already defined in beforeEach initScript.

Respond ONLY as valid JSON:
{
  "decision": "fix_html" | "skip_test" | "mixed",
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
    brokenPageErrorContext,
  } = opts;

  return `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}${specScoringContext}${fixLearningsContext}${brokenPageErrorContext || ''}
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

INSTRUCTION: Diagnose the ROOT CAUSE common across failing categories. A single HTML bug often manifests as different symptoms across categories. Fix the root cause — do NOT patch each category's symptom independently.
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

OUTPUT INSTRUCTIONS:
- Output the complete fixed HTML in a \`\`\`html code block
- Fix ALL failing categories in a single HTML output
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

${_buildReviewBody(specContent, currentHtml)}`;
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
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (post-fix)
 * @returns {string}
 */
function buildReReviewPrompt(specContent, currentHtml) {
  return `You are a game quality reviewer. Review the following HTML game against its specification.

${_buildReviewBody(specContent, currentHtml)}`;
}

/** Shared body for review and re-review prompts. */
function _buildReviewBody(specContent, currentHtml) {
  return `The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

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

${CDN_CONSTRAINTS_BLOCK}

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
  extractPhaseNamesFromGame,
};
