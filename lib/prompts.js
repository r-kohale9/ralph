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
//   stripCssFromHtml                — utility: strip <style> content before passing HTML to fix/review LLMs
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

### RULE-006 (game_over phase — endGame() is the correct pattern)
- endGame() is the authoritative termination mechanism. If endGame() is called and it sends the correct postMessage payload with the correct metrics, the game ends correctly regardless of whether gameState.phase is explicitly set to 'game_over' inside endGame().
- Do NOT reject a game solely because gameState.phase is never assigned the string 'game_over'. The canonical phase for the test harness is 'gameover' (no underscore), set via \`gameState.phase = 'gameover'\`. Either pattern passes.
- A game that calls endGame() unconditionally and sends a valid postMessage IS compliant even if the phase string is 'gameover', 'results', or any other terminal value defined in the spec.

### RULE-007 (isActive guard — acceptable patterns)
- \`gameState.isActive = false\` set at the start of endGame() IS the correct guard to prevent double-triggering. This satisfies the "isActive guard" requirement.
- A game that sets gameState.isActive = false (or gameState.gameEnded = true) at the first line of endGame() IS compliant. Do NOT reject because it uses 'gameEnded' instead of 'isActive' if the effect is identical (prevents re-entry).
- Answer/click handlers that check \`if (!gameState.isActive) return;\` at entry ARE compliant. The guard may use any name: isActive, isProcessing, isAnswering, isHandling, gameEnded.

### RULE-008 (TransitionScreen.show() — await is REQUIRED on ALL calls)
- ALL \`transitionScreen.show({...})\` calls MUST use \`await\`. Unawaited calls corrupt CDN component state — subsequent show() calls hang with button visibility:hidden (Lesson 101, keep-track #465).
- Reject if ANY transitionScreen.show() call is missing \`await\`, OR if transition routing is broken (onComplete does NOT exist in the TransitionScreenComponent API — use \`buttons: [{ text, type, action }]\` array instead; see CDN_CONSTRAINTS_BLOCK).

### MCQ Option Shuffling
- Shuffling multiple-choice option buttons each round is CORRECT and expected behavior — it prevents answer-position memorisation. Do NOT reject because "correct answer is not always first" or "options are in different order each round".
- The test harness answer() API finds the correct option via gameState.correctAnswer (value match), not by position. A game that shuffles options AND sets gameState.correctAnswer correctly IS fully compliant.
- ONLY reject MCQ ordering if the spec explicitly requires options in a fixed order (rare) or if the shuffle itself is broken (correct option sometimes missing from DOM).

### General guidance
- Do NOT fail items based on coding style preferences if the behavior is correct.
- Verify behavior by reading the logic, not by pattern-matching on syntax.
- If a checklist item is ambiguous or requires running the game to verify, resolve in favor of APPROVED.`;

// ─── CDN constraints block ────────────────────────────────────────────────────
// Shared block injected into fix prompts. Single source of truth.

const CDN_CONSTRAINTS_BLOCK = `CRITICAL CDN CONSTRAINTS (do NOT violate while fixing):
- FeedbackManager.playDynamicFeedback() MUST be fire-and-forget: .catch((e) => { console.error(JSON.stringify({event:'audio-error',error:e.message})); }), NEVER awaited
- FeedbackManager.playDynamicFeedback() NAMESPACE: call ONLY as FeedbackManager.playDynamicFeedback({...}) — NEVER as FeedbackManager.sound.playDynamicFeedback({...}). The .sound sub-object does NOT have this method; calling it throws a synchronous TypeError inside handleAnswer() before scheduleNextRound() runs, leaving isProcessing=true permanently and deadlocking the round lifecycle.
- gameState.isProcessing = false must be set at START of endGame() and BEFORE showLevelTransition()
- isProcessing=true SILENTLY BLOCKS clicks (early return only) — buttons stay visible, never hidden
- CDN init order is immutable: await FeedbackManager.init() → ScreenLayout.inject() → game template clone
- Do NOT add event listeners inside innerHTML setters — use event delegation on parent only
- Do NOT move or reorder CDN <script> tags. CDN domain MUST be storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai, cdn.mathai.ai, or any other domain. Use ONLY these exact URLs: feedback-manager→https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js, components→https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js, helpers→https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js
- Do NOT remove or reorder lines inside DOMContentLoaded's initialization block — only add/modify the specific broken functionality
- Do NOT remove or rename elements in <template id="game-template"> — template corruption causes ALL tests to fail
- Star display MUST update on game over: show ☆☆☆ for 0 stars in the game-over code path; calcStars() must have: if(outcome==='game_over') return 0;
- calcStars() MUST use ONLY the threshold criteria defined in the spec — NEVER invent accuracy-based conditions. WRONG: if (accuracy >= 80) return 3; (unless spec explicitly defines this). RIGHT: use only time/score thresholds the spec specifies. Adding accuracy conditions not in the spec causes review rejection for "Game-Specific > Stars" every time.
- Lives display DOM element MUST update immediately when a life is lost, before any animation
- NEVER call progressBar.destroy(), timer.destroy(), or visibilityTracker.destroy() immediately in endGame() — use 10s delay: setTimeout(() => { try { progressBar?.destroy(); timer?.destroy(); visibilityTracker?.destroy(); } catch(e) {} }, 10000);
- TimerComponent IS available in the CDN bundle, BUT it loads AFTER ScreenLayout/FeedbackManager. If you use it, you MUST add "|| typeof TimerComponent === 'undefined'" to the waitForPackages() while-loop condition — otherwise you get ReferenceError at runtime. Safer alternative: use a plain setInterval/setTimeout for countdown/elapsed timers, which has zero CDN dependency risk. CONSTRUCTOR SIGNATURE: new TimerComponent('container-id', { timerType: 'increase', startTime: 0, endTime: 3600, autoStart: false, format: 'min' }) — first argument MUST be the container element ID string, NOT a DOM element and NOT an options object. Passing an object as first arg causes 'Container with id [object Object] not found' crash (Lesson 98). CRITICAL — NO HEADLESS/NULL TIMER: new TimerComponent(null, {...}) THROWS "Container with id 'null' not found" — null is NEVER a valid containerId. TimerComponent ALWAYS requires a real <div> to render into: (1) Add <div id="timer-container"></div> inside <template id="game-template">, (2) Use new TimerComponent('timer-container', {...}). If you need a background-only countdown with NO visible timer UI, use plain setInterval/clearInterval instead — no CDN dependency, no DOM required. DO NOT pass null or undefined as the first argument (T1 §5f4 rejects this — right-triangle-area #538/#540 root cause).
- ProgressBarComponent DOES NOT EXPOSE a .timer PROPERTY: Never do progressBar.timer — it is always undefined → timer.start() throws → blank page (T1 §5f7). ProgressBarComponent tracks lives/round display ONLY. For a countdown timer, ALWAYS create TimerComponent separately: const timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: N, endTime: 0, onEnd: handleTimeout }); timer.start(); (right-triangle-area #541 root cause)
- ProgressBarComponent API IS EXACTLY: constructor(slotId, config) + .update(currentRound, totalRounds) + .destroy(). NO OTHER METHODS EXIST. There is NO .init(), .start(), .reset(), .setLives(), .pause(), .resume(), or any other method. Calling any undefined method throws TypeError → blank page. The constructor IS the init — do NOT call progressBar.init() (T1 §5f9, right-triangle-area #543 root cause).
- TIMERTIMER SLOT IN SCREENLAYOUT: If you use new TimerComponent('mathai-timer-slot', ...), you MUST include timer: true in ScreenLayout.inject slots: ScreenLayout.inject('app', { slots: { progressBar: true, timer: true } }). Without timer: true, the 'mathai-timer-slot' div is NEVER created → TimerComponent throws 'Container with id "mathai-timer-slot" not found' → blank page (T1 §5f8, right-triangle-area #542 root cause). NOTE: If you use ProgressBarComponent with showTimer: true, do NOT also create a separate new TimerComponent('mathai-timer-slot', ...) — the timer is managed inside ProgressBarComponent internally.
- CANVAS API DOES NOT RESOLVE CSS VARIABLES: Never pass var(--color-x) or any CSS custom property to Canvas API calls. ctx.addColorStop(offset, 'var(--color-sky)') → DOMException: "could not be parsed as a color" → blank page (T1 §5f6). Use literal color values in ALL canvas calls: '#87CEEB', 'rgba(135,206,235,1)', 'skyblue'. (right-triangle-area #540 root cause)
- NEVER define a custom updateLivesDisplay() — ProgressBarComponent handles lives via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window; window.gameState MUST be on window — syncDOMState() reads window.gameState; if absent data-phase is NEVER set and ALL waitForPhase() calls timeout
- window.gameState.content MUST be pre-populated with the fallback/default round data before waiting for game_init. The DOM snapshot tool reads window.gameState.content synchronously — if it is only set on game_init message, the snapshot captures null and test gen gets corrupted fallback data. Pattern: define fallbackContent with real rounds above DOMContentLoaded, then set window.gameState.content = fallbackContent at the START of DOMContentLoaded (before await waitForPackages()), then override with real content when game_init arrives.
- waitForPackages() MUST have a 180000ms (3 min) timeout that THROWS: if(elapsed>=timeout){throw new Error('Packages failed to load within 180s')} — CDN cold-start in fresh Playwright test browsers takes 30-150s on GCP; 120s timeout races against CDN cold-start and loses; use 180000 always (Lesson 117, Lesson 143)
- DOMContentLoaded catch block MUST set window.__initError = e.message to surface init errors to the test harness. This makes CDN package load failures visible instead of silent: window.addEventListener('DOMContentLoaded', async () => { try { ... } catch(e) { console.error('Init error: ' + e.message); window.__initError = e.message; } });
- waitForPackages() typeof check MUST match what IS loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout. NEVER check typeof FeedbackManager when PART-017=NO — it is never loaded and causes guaranteed 120s timeout + crash (gameState stays empty, all tests fail)
- SCREENLAYOUT GUARD: immediately after ScreenLayout.inject(), add: if (!document.getElementById('gameContent')) { throw new Error('ScreenLayout.inject() did not create #gameContent — check slots: wrapper'); } — this converts silent inject failures into visible errors caught by window.__initError
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- ANTI-PATTERN: NEVER create a separate handleGameOver() function that bypasses endGame(). ALL game-ending paths (lives exhausted, time up, all rounds complete) MUST call endGame(reason). The single endGame() function handles TransitionScreen.show() for both 'victory' and 'game_over'. A separate handleGameOver() that directly shows results without calling endGame() causes: (1) TransitionScreen not shown for game-over, (2) duplicate postMessage cleanup code, (3) review rejection. WRONG: function handleGameOver() { showResults(); postMessage(); } RIGHT: call endGame('game_over') from any game-over trigger.
- Preserve ALL existing data-testid attributes — never remove them
- gameState.phase MUST be set at every state transition: 'playing', 'transition', 'gameover', 'results'. Call syncDOMState() immediately after every gameState.phase assignment. IMPORTANT: 'gameover' (no underscore) is the canonical gameState.phase value — NEVER set gameState.phase = 'game_over' (underscore). The underscore form 'game_over' is ONLY used as the reason argument to endGame('game_over') and as the outcome argument to calcStars('game_over'). These are different things: endGame reason vs gameState.phase are separate strings.
- endGame() GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- sound.register() is FORBIDDEN — use FeedbackManager.sound.preload([{id,url}]) instead
- AUDIO URLS for FeedbackManager.sound.preload(): Use ONLY https://storage.googleapis.com/test-dynamic-assets/audio/success.mp3 and https://storage.googleapis.com/test-dynamic-assets/audio/error.mp3 for generic success/error audio. EXCEPTION: if the spec (PART-017=YES) provides explicit audio/sticker asset URLs at cdn.mathai.ai (e.g. https://cdn.mathai.ai/mathai-assets/dev/...), copy those EXACT URLs from the spec — do NOT replace cdn.mathai.ai with storage.googleapis.com/test-dynamic-assets for spec-provided asset URLs.
- CDN DOMAIN ABSOLUTE RULE: CDN PACKAGE SCRIPT tags (helpers/index.js, components/index.js, feedback-manager/index.js) MUST use storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai or cdn.mathai.ai. For ASSET URLs (audio/sticker paths from the spec), use the EXACT URL the spec provides — do NOT apply this domain rule to spec-provided asset URLs.
- FeedbackManager: ONLY call FeedbackManager.init() if spec explicitly says PART-017 Feedback Integration: YES or popupProps is specified. If PART-017=NO or absent, use FeedbackManager.sound.play() / FeedbackManager.playDynamicFeedback() directly — NEVER call FeedbackManager.init() (it shows a blocking popup that causes 100% test failure non-deterministically).
- GEN-113: NEVER call FeedbackManager.init() unconditionally — it is FORBIDDEN and causes REVIEW REJECTION (27% of all review rejections):
  WRONG:
    FeedbackManager.init({ ... });            // DO NOT CALL — blocks audio context popup
    await FeedbackManager.init();             // DO NOT CALL — even with await this is wrong
    FeedbackManager.init();                   // DO NOT CALL — unconditional call causes review rejection
  RIGHT:
    // Use FeedbackManager directly — NO init() needed:
    FeedbackManager.playDynamicFeedback({ event: 'success' }).catch(e => console.error(e.message));
    FeedbackManager.playDynamicFeedback({ event: 'error' }).catch(e => console.error(e.message));
    // FeedbackManager works without init() — T1 static check PART-011-INIT will REJECT any HTML that calls FeedbackManager.init()
- FeedbackManager.playDynamicFeedback() NAMESPACE: ALWAYS call FeedbackManager.playDynamicFeedback({ event: 'success' }) and FeedbackManager.playDynamicFeedback({ event: 'error' }). NEVER call FeedbackManager.sound.playDynamicFeedback(...) — that method does NOT exist on the .sound sub-object. Calling it throws a synchronous TypeError in handleAnswer() before scheduleNextRound() runs, leaving isProcessing=true permanently and deadlocking the round lifecycle forever. (Lesson 115, count-and-tap #471)
- isActive GUARD: every answer/click handler MUST start with: if (!gameState.isActive) return; gameState.isActive = false; ... gameState.isActive = true;
- isActive IN GAMESTATE INIT: window.gameState MUST include isActive: true in its initial object literal (e.g. window.gameState = { ..., isActive: true, gameEnded: false, ... }). Missing isActive from the init object causes review to flag "missing guard" even when handlers check it correctly.
- TransitionScreen ROUTING: every transitionScreen.show() buttons[].action callback MUST set gameState.phase to the correct next phase (e.g. action: () => { gameState.phase = 'playing'; syncDOMState(); nextRound(); })
- TransitionScreen AWAIT: ALL transitionScreen.show() calls MUST use await — write: await transitionScreen.show({...}). Without await, the function completes before the transition animation finishes, causing race conditions where the next-round setup runs before the slot is visible. WRONG: transitionScreen.show({...}); RIGHT: await transitionScreen.show({...});
- TransitionScreen BUTTONS API: transitionScreen.show() MUST use the "buttons: [{ text, type, action }]" array format. NEVER use "hasButton", "buttonText", or "onComplete" — these do not exist in the TransitionScreenComponent API and produce an empty #transitionButtons div (no button rendered, all tests timeout). WRONG: transitionScreen.show({ hasButton: true, buttonText: 'Start', onComplete: fn }); RIGHT: transitionScreen.show({ buttons: [{ text: 'Start', type: 'primary', action: () => startGame() }] }); (Lesson 118, disappearing-numbers #475)
- SENTRY ORDER (RULE-SENTRY-ORDER): initSentry() MUST be called INSIDE the waitForPackages() callback, AFTER packages load. SentryHelper is a CDN package — calling it before packages load throws ReferenceError. BAD: initSentry(); waitForPackages([...], timeout, () => { ... }) GOOD: waitForPackages([...], timeout, () => { initSentry(); ... }) — or equivalently, call initSentry() at line 1 of the async DOMContentLoaded body AFTER await waitForPackages() resolves
- SENTRY INTEGRATIONS: NEVER use new Sentry.Integrations.CaptureConsole() — throws TypeError. NEVER use Sentry.captureConsoleIntegration() — only available in the separate captureconsole.min.js plugin bundle which is NOT loaded; calling it throws "Sentry.captureConsoleIntegration is not a function" and crashes initSentry(), leaving #gameContent never created. OMIT integrations entirely: call initSentry() with no integrations argument or pass [].
- verifySentry(): use Sentry.getClient() (v8+/v10+) — NEVER Sentry.getCurrentHub().getClient() (removed in Sentry v8)
  function verifySentry() { const client = Sentry.getClient(); console.log('Sentry active:', !!client); }
- DEBUG FUNCTIONS: PART-012 debug/test functions (debugGame, testAudio, testPause, testResume, testSentry, verifySentry, debugAudio) MUST be assigned to window: window.debugGame = debugGame; etc. Copy this pattern verbatim from the spec. The spec checklist requires them on window.
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
- SCREENLAYOUT: ScreenLayout.inject() MUST be called after FeedbackManager.init() (or after waitForPackages() when PART-017=NO). EXACT required format: ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } }) — the options MUST use the { slots: {...} } wrapper. Passing { progressBar: true, transitionScreen: true } directly WITHOUT the 'slots' key causes #gameContent to NOT be created in the DOM (blank page). NEVER omit the 'slots' wrapper.
- INITIAL TRANSITIONSCREEN.SHOW(): after 'transitionScreen = new TransitionScreenComponent({...})' in DOMContentLoaded, ALWAYS call transitionScreen.show({...}) as the LAST init step to populate #mathai-transition-slot with the start button. WITHOUT this call the slot is empty and ALL tests timeout. restartGame() MUST also call transitionScreen.show(). NEVER call transitionScreen.show() before ScreenLayout.inject() — the slot does not exist yet.
- SIGNALCOLLECTOR API (PART-010) — CORRECT METHODS ONLY:
  ✓ signalCollector.recordViewEvent(eventType, data)    — screen transitions, content renders
  ✓ signalCollector.recordCustomEvent(eventType, data)  — game events (correct/wrong answers)
  ✓ signalCollector.startProblem(id, data)              — start tracking a round
  ✓ signalCollector.endProblem(id, outcome)             — end tracking a round
  ✓ signalCollector.seal()                              — seal + return payload for postMessage
  ✓ signalCollector.pause() / signalCollector.resume()  — visibility events
  ✗ NEVER: signalCollector.trackEvent()                 — DOES NOT EXIST in CDN API, causes runtime crash: "signalCollector.trackEvent is not a function" → init error → blank page (right-triangle-area #527, #530, #532)
- RULE-SYNC-1: startGame() MUST be synchronous — no setTimeout() or setInterval() wrapper.
  BAD:  function startGame() { setTimeout(() => { gameState.phase = 'playing'; syncDOMState(); nextRound(); }, 0); }
  GOOD: function startGame() { gameState.phase = 'playing'; syncDOMState(); nextRound(); }
  WHY:  CDN TransitionScreen auto-dismisses #mathai-transition-slot ONLY when the action callback returns synchronously.
        Wrapping in setTimeout keeps the slot visible after startGame() returns, causing EVERY test that calls
        startGame() to fail immediately on the slot assertion. (Root cause: soh-cah-toa-worked-example build #531)
- CRITICAL CDN NAMESPACE RULE — CDN components are BARE WINDOW GLOBALS. NONE of these namespaces exist:
  ✗ window.mira.components.ScreenLayout      — window.mira does NOT exist
  ✗ window.cdn.ScreenLayout                  — window.cdn does NOT exist
  ✗ window.mathai.ScreenLayout               — window.mathai does NOT exist
  ✗ window.Ralph.ScreenLayout                — window.Ralph does NOT exist
  ✗ window.homeworkapp.ScreenLayout          — window.homeworkapp does NOT exist
  ✗ require('feedback-manager')              — CDN is NOT CommonJS; require is not defined
  ✗ import ScreenLayout from '...'           — CDN is NOT ESM; import throws SyntaxError
  ALL of the above patterns throw TypeError/ReferenceError at runtime → blank page → 100% test failure.
  VALID bare globals (assigned directly from window or used as typeof checks):
    window.ScreenLayout               — always present after CDN load
    window.ProgressBarComponent       — loads at CDN step 3
    window.TransitionScreenComponent  — loads at CDN step 4
    window.TimerComponent             — loads at CDN step 7 (last)
    window.VisibilityTracker          — part of helpers bundle
    window.FeedbackManager            — part of feedback-manager bundle (PART-017=YES only)
    window.SignalCollector            — part of helpers bundle (PART-010 only); assign: const signalCollector = window.SignalCollector
    window.SentryConfig               — loaded from sentry/index.js (synchronous, always available at DOMContentLoaded). NOT window.SentryHelper (does not exist). initSentry() checks typeof SentryConfig internally.
  Correct waitForPackages() check: typeof ScreenLayout === 'undefined' (or typeof window.ScreenLayout === 'undefined')`;

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
- PART-012 debug functions: specs show "window.debugGame = debugGame" — COPY this pattern exactly. Debug functions MUST be assigned to window per the spec checklist.

DATA-TESTID ATTRIBUTES — required on all interactive and observable elements:
- Every interactive and observable state element needs a data-testid attribute
- Required minimums: data-testid="answer-input", "btn-check", "btn-restart", "score-display", "stars-display", "lives-display", "btn-reset" (if applicable)
- Adjustment controls: data-testid="btn-{which}-plus" / "btn-{which}-minus"
- Multiple-choice options: data-testid="option-{index}" (0-indexed)
- IDs in the spec take precedence — keep spec ID AND add matching data-testid
- RULE-DUP: data-testid attributes MUST be globally unique across all screens. A testid like data-testid="option-0" appearing on both start screen and game screen causes strict-mode locator violations. Prefix testids by screen: data-testid="game-option-0", data-testid="start-play-btn", etc.

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
   await FeedbackManager.init();  // call ONLY if PART-017=YES — skip if PART-017=NO (PART-015 auto-inits)
   initSentry();              // ONLY if PART-030=YES — MUST define function initSentry() in script ABOVE DOMContentLoaded; initSentry() is NOT a CDN function. Skip this line entirely if PART-030=NO.
   ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });  // EXACT format required — 'slots' wrapper is MANDATORY; without it #gameContent is never created
   if (!document.getElementById('gameContent')) { throw new Error('ScreenLayout.inject() did not create #gameContent — check slots: wrapper'); }  // MANDATORY GUARD: surfaces silent inject failures as explicit errors
   // clone game-template + initGame()
   // CRITICAL: ProgressBarComponent, VisibilityTracker MUST be initialized AFTER ScreenLayout.inject(), NOT before. TimerComponent MUST NOT be used here unless PART-006=YES — if PART-006=YES, you MUST also add "|| typeof TimerComponent === 'undefined'" to waitForPackages() (TimerComponent loads ~554ms after ScreenLayout; without this check the game crashes with ReferenceError at init).

3. PART-003 waitForPackages — exact implementation required:
   The typeof check MUST match the packages actually loaded by this spec. CRITICAL: ALWAYS use typeof in the while condition — NEVER use truthy/falsy: while (typeof FeedbackManager === 'undefined') ← CORRECT; while (!FeedbackManager) or while (!window.FeedbackManager) ← WRONG (T1 §5fa rejects this — soh-cah-toa #544 review rejection root cause).
   TIMEOUT MUST BE 180000ms (3 minutes). CDN packages load from storage.googleapis.com — in a fresh Playwright browser (no CDN cache) on a cold GCP server, CDN cold-start can take 120-150s. A 120s timeout races against CDN cold-start and loses (~30% of builds), crashing the game with "Packages failed to load" before CDN finishes. Use 180000 always — this safely clears the ~150s CDN cold-start window. (Lesson 117, Lesson 143)
   - If PART-017 (Feedback Integration) = YES: check FeedbackManager (it is loaded):
     async function waitForPackages() {
       const timeout = 180000; const interval = 50; let elapsed = 0;
       while (typeof FeedbackManager === 'undefined') {
         if (elapsed >= timeout) { throw new Error('Packages failed to load within 180s'); }
         await new Promise(resolve => setTimeout(resolve, interval));
         elapsed += interval;
       }
     }
   - If PART-017 = NO: FeedbackManager is NOT loaded — check ScreenLayout instead (always present):
     async function waitForPackages() {
       const timeout = 180000; const interval = 50; let elapsed = 0;
       while (typeof ScreenLayout === 'undefined') {
         if (elapsed >= timeout) { throw new Error('Packages failed to load within 180s'); }
         await new Promise(resolve => setTimeout(resolve, interval));
         elapsed += interval;
       }
     }
   CRITICAL: NEVER check typeof FeedbackManager when PART-017=NO — FeedbackManager never loads in that case, causing a guaranteed 10-second timeout and crash (gameState never initializes, all tests fail).
   CDN COMPONENT LOAD ORDER — the bundle loads components sequentially. If your game uses any of these, you MUST add them to the while-loop condition:
   - ScreenLayout: always present (step 2) — always check this as the base
   - ProgressBarComponent: loads at step 3 (AFTER ScreenLayout) — add: || typeof ProgressBarComponent === 'undefined'
   - TransitionScreenComponent: loads at step 4 (AFTER ProgressBar) — add: || typeof TransitionScreenComponent === 'undefined'
   - TimerComponent: loads at step 7 (last) — add: || typeof TimerComponent === 'undefined'
   Example for a game using all four:
     while (typeof ScreenLayout === 'undefined' || typeof ProgressBarComponent === 'undefined' || typeof TransitionScreenComponent === 'undefined') {
   Rule: include typeof X for every CDN component you instantiate with "new X()". Missing even one causes ReferenceError at the exact moment of instantiation.

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

   CRITICAL: ...signalPayload MUST use the spread operator — NEVER manually assign individual fields.
   WRONG: data: { metrics, signals: signalPayload.signals, metadata: signalPayload.metadata } — omits 'events'
   RIGHT: data: { metrics, attempts, ...signalPayload, completedAt } — spread includes events + signals + metadata

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
    - transitionScreen.show() buttons[].action callback → gameState.phase = 'playing'; syncDOMState();
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

25. TRANSITIONSCREEN AWAIT — all transitionScreen.show() calls MUST be awaited:
    WRONG: transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });
    RIGHT: await transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });
    Without await, the show() resolves synchronously before animation completes — the next-round setup
    races with the still-animating transition slot. ALL calls to transitionScreen.show() in DOMContentLoaded
    init, startGame(), endGame(), and restartGame() MUST be awaited.
    This includes the INITIAL transitionScreen.show() call that populates the start button — if that first call
    is not awaited, the CDN component's internal state machine stays in a "show in progress" state, which causes
    all subsequent await transitionScreen.show() calls (in nextRound/endGame) to silently hang: the button is
    rendered but stays visibility:hidden forever (Lesson 101, keep-track #465).
    IMPORTANT: Use ONLY the \`buttons: [{ text, type, action }]\` array format — NEVER use \`onComplete\` as a
    top-level key (it does not exist in the API and is silently ignored, producing no button).

26. GAMESTATE isActive INITIALIZATION — window.gameState MUST include isActive: true in its initial object:
    WRONG: window.gameState = { score: 0, lives: 3, phase: 'start', gameEnded: false };
    RIGHT: window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };
    Every answer/click handler checks \`if (!gameState.isActive) return;\`. If isActive is never defined in
    the gameState init, every handler returns immediately on first call — game appears unresponsive and
    ALL mechanics tests fail. isActive MUST be true at start and reset to true at start of each loadRound().

27. MOBILE VIEWPORT — game must be fully scrollable on mobile (480×800px):
    - NEVER set \`overflow: hidden\` on \`body\` or \`html\` — this blocks all mobile scrolling
    - NEVER use \`height: 100vh\` or \`height: 100dvh\` on body without \`overflow-y: auto\`
    - The \`#gameContent\` container MUST have \`overflow-y: auto\` or \`overflow: auto\` if content can exceed viewport height
    - Viewport meta MUST NOT include \`user-scalable=no\` — use \`user-scalable=yes\` or omit it
    - All answer option buttons must be reachable by scrolling — test at 480×800 viewport

28. RULE-RESULTS-1: showResults() MUST populate #results-screen directly — NEVER use transitionScreen.show() for results:
    If the spec defines a custom \`#results-screen\` element and a \`showResults()\` function:
    - \`showResults()\` MUST set the display of \`#results-screen\` to visible and populate its content from gameState
    - Do NOT use \`transitionScreen.show()\` to display results — TransitionScreen is for phase transitions
      (start→game, level→level), NOT for the final results screen that the spec defines as a custom DOM element
    - The #results-screen element must be revealed by JS, not by the CDN transition slot
    - Pattern: document.getElementById('results-screen').style.display = 'block'; then populate children

    BAD (review will reject — uses CDN transition for results, #results-screen never shown):
    \`\`\`js
    function showResults() {
      transitionScreen.show({ title: 'Game Over', subtitle: 'Score: ' + gameState.score, buttons: [...] });
    }
    \`\`\`

    GOOD (directly populates #results-screen from gameState):
    \`\`\`js
    function showResults() {
      const screen = document.getElementById('results-screen');
      screen.style.display = 'block';
      document.getElementById('final-score').textContent = gameState.score;  // populate from gameState
      document.getElementById('stars-display').textContent = '⭐'.repeat(calcStars());
      syncDOMState();  // push gameState.phase to data-phase so waitForPhase('results') resolves
    }
    \`\`\`

    WHY: The Playwright tests check \`#results-screen\` visibility and populate content after endGame(). If
    showResults() calls transitionScreen.show() instead, #results-screen stays display:none and ALL
    end-of-game tests fail with toBeVisible timeout. (Root cause: soh-cah-toa-worked-example build #535)

29. RULE-SENTRY-ORDER: initSentry() MUST be called INSIDE the waitForPackages() callback, AFTER packages load.
    CRITICAL — initSentry() IS NOT A CDN FUNCTION. When PART-030=YES you MUST define it yourself in the script:
    \`\`\`js
    function initSentry() {
      try {
        if (typeof SentryConfig !== 'undefined') { SentryConfig.init(); }
      } catch(e) { console.error(JSON.stringify({error: e.message})); }
    }
    \`\`\`
    Then call it after waitForPackages() resolves. If PART-030=NO, do NOT call initSentry() at all.
    CRITICAL: NEVER add 'typeof SentryHelper === "undefined"' to waitForPackages() — SentryHelper does NOT
    exist as a CDN global. The sentry bundle exports window.SentryConfig (not SentryHelper). Adding
    SentryHelper to waitForPackages() causes it to hang FOREVER (SentryHelper is always undefined) → blank page.
    Correct waitForPackages() only checks: ScreenLayout, ProgressBarComponent, TransitionScreenComponent,
    FeedbackManager (if PART-017=YES), TimerComponent (if used), VisibilityTracker (if used),
    SignalCollector (if used). NEVER SentryHelper.

    BAD (initSentry before waitForPackages resolves — crashes at runtime):
    \`\`\`js
    window.addEventListener('DOMContentLoaded', async () => {
      initSentry();               // ← WRONG: must call AFTER waitForPackages() resolves
      await waitForPackages();
      ScreenLayout.inject(...);
    });
    \`\`\`

    GOOD (initSentry inside the CDN init sequence, after waitForPackages resolves):
    \`\`\`js
    window.addEventListener('DOMContentLoaded', async () => {
      await waitForPackages();
      initSentry();               // ← CORRECT: called after waitForPackages() resolves
      ScreenLayout.inject(...);
    });
    \`\`\`

    This matches the CDN INIT ORDER in rule 2 above. Never move initSentry() above await waitForPackages().

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
- IF spec uses PART-010/SignalCollector: endGame postMessage MUST spread ...signalPayload from signalCollector.seal(). SIGNALCOLLECTOR API — CORRECT METHODS ONLY: recordViewEvent(eventType, data), recordCustomEvent(eventType, data), startProblem(id, data), endProblem(id, outcome), seal(), pause(), resume(). NEVER signalCollector.trackEvent() — it does NOT exist in the CDN API and causes "signalCollector.trackEvent is not a function" → init crash → blank page (right-triangle-area #527, #530, #532).
- IF spec uses PART-030/Sentry: ALL catch blocks MUST call Sentry.captureException(e); initSentry() ONLY inside waitForPackages callback — NEVER before waitForPackages() resolves
- PART-012 DEBUG FUNCTIONS: debug/test functions (debugGame, testAudio, testPause, testResume, testSentry, verifySentry) MUST be assigned to window: window.debugGame = debugGame; etc. Copy the pattern from the spec verbatim. The spec checklist requires them on window — review rejects if they're missing from window.
- window EXPOSURE: add window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; window.gameState=gameState; at global scope
- GEN-114. window.loadRound EXPOSURE: CDN games with multiple rounds MUST expose window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); } at global scope. The test harness __ralph.jumpToRound(n) checks for window.loadRound, window.jumpToRound, window.loadQuestion, or window.goToRound — if NONE exist, jumpToRound() is a silent no-op: it sets gameState.currentRound but never updates phase or renders the UI. This leaves data-phase='results' from a prior endGame() call, causing ALL waitForPhase(page, 'playing') calls to timeout → 100% mechanics/level-progression failure. (name-the-sides build #550 — 0/6 mechanics × 3 iterations)
- endGame GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- CDN URL: ALWAYS storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai or cdn.mathai.ai. Use ONLY: feedback-manager/index.js, components/index.js, helpers/index.js from https://storage.googleapis.com/test-dynamic-assets/packages/
- PART-003 waitForPackages: timeout=180000ms (3 minutes), MUST throw on timeout (not console.error). CDN loads cold in fresh Playwright browsers (30-150s on GCP) — 120s timeout races against CDN cold-start and loses; use 180000 always. MUST match packages that ARE loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout (NEVER FeedbackManager — it is not loaded when PART-017=NO, causing guaranteed timeout and gameState staying empty) (Lesson 117, Lesson 143)
- ROUND LIFECYCLE RESET: for games where the player can interact IMMEDIATELY after loadRound(), first three lines MUST be: gameState.isProcessing = false; gameState.isActive = true; syncDOMState(); — stale isProcessing=true from prior round silently blocks ALL clicks. EXCEPTION: if the round starts with a REVEAL/PREVIEW animation (dots appear, cards flip, memory tiles show) BEFORE options are rendered, keep gameState.isProcessing = true at the start of loadRound() and only set it to false INSIDE the reveal setTimeout AFTER options are rendered. The test harness answer() waits for isProcessing=false before clicking — if set too early, buttons don't exist yet, click silently fails, timer fires, test desync (Lesson 109, count-and-tap #457).
- GEN-109. REVEAL-PHASE isProcessing TIMING — If renderRound()/loadRound() shows a reveal/preview animation before player interaction (dots appear, cards flip, memory tiles show, shuffle plays), you MUST keep gameState.isProcessing = true until AFTER the reveal setTimeout fires AND option buttons are rendered in the DOM. The test harness answer() polls isProcessing === false before clicking — if set too early, answer() fires when no options exist, click is silently ignored, game advances via timer, and all mechanics tests desync.
  WRONG: function renderRound(i) { gameState.isProcessing = false; setTimeout(() => renderOptions(), 1500); }
  RIGHT: function renderRound(i) {
    gameState.isProcessing = true;  // keep true during reveal
    setTimeout(() => { renderOptions(); gameState.isProcessing = false; syncDOMState(); }, 1500);
  }
  (count-and-tap #457, keep-track #465, face-memory — all revealed options via setTimeout but set isProcessing=false too early)
- GEN-110. endGame() PHASE ORDER — endGame() MUST set gameState.phase BEFORE calling window.parent.postMessage(). Tests poll data-phase every 500ms via syncDOMState(); if postMessage fires first, the test assertion can race against the phase update and timeout waiting for 'gameover' or 'results'. The REQUIRED order:
  CORRECT:
    function endGame(reason) {
      if (gameState.gameEnded) return; gameState.gameEnded = true; gameState.isActive = false;
      gameState.isProcessing = false;
      gameState.phase = reason === 'victory' ? 'results' : 'gameover';  // canonical phase: 'gameover' (no underscore)
      syncDOMState();   // push phase to data-phase BEFORE postMessage fires
      // ... calculate score, stars ...
      window.parent.postMessage({ type: 'game_complete', ... }, '*');
    }
  WRONG:
    function endGame(reason) {
      // ... calculate score ...
      window.parent.postMessage({ type: 'game_complete', ... }, '*');  // postMessage BEFORE phase set
      gameState.phase = 'gameover';   // Too late — test may have already timed out
    }
  Phase values: use 'gameover' (no underscore) for loss/timeout paths, 'results' for victory paths. These are the canonical phase strings. NEVER use 'game_over' for gameState.phase — the underscore form belongs only to the endGame(reason) argument and calcStars(outcome) argument, not to gameState.phase.
  (Lesson 135 — 7 builds across 5 games: memory-flip, count-and-tap, light-up, one-digit-doubles, match-the-cards)
- GEN-111. MCQ CORRECT ANSWER DISCOVERY — For games with multiple-choice option buttons (MCQ, worked-example MCQ, grid choices): MUST set gameState.correctAnswer = <correct-value> each time a round loads (inside loadRound()/renderRound()). The test harness answer() API uses this value to click the matching option button regardless of shuffle order. If correctAnswer is not set, the harness falls back to clicking index 0 — which is WRONG when options are shuffled, causing all mechanics tests to fail. REQUIRED pattern:
  function loadRound() {
    const round = rounds[gameState.currentRound];
    gameState.correctAnswer = round.correctValue;  // MUST be set before options render
    // ... shuffle and render options ...
    options.forEach((opt, i) => {
      const btn = document.createElement('button');
      btn.dataset.testid = 'option-' + i;
      btn.dataset.value = opt.value;  // MUST match gameState.correctAnswer for correct option
      btn.textContent = opt.label;
      container.appendChild(btn);
    });
  }
  ALSO: shuffling MCQ options each round is CORRECT behavior — it prevents pattern-memorisation. The harness finds the correct button via gameState.correctAnswer, NOT by position. (Lesson 171 — build #546 review rejection: "correct answer not always first button")
- SYNCDOMESTATE CALL SITES: call syncDOMState() after EVERY gameState.phase assignment — game_init, round complete, transitionScreen buttons.action callback, endGame (gameover + results paths), restartGame — missing any causes waitForPhase() to timeout
- POSTMESSAGE REQUIRED FIELDS: CDN games MUST use nested data structure: window.parent.postMessage({ type: 'game_complete', data: { metrics: { /* USE EXACTLY the field names defined in the spec's postMessage/contract section */ }, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*') — NEVER flat top-level fields. CRITICAL: read your spec's postMessage contract and use the EXACT field names it specifies. Do NOT invent field names or use generic defaults. Examples: worked-example games use { stars, accuracy, rounds_completed, wrong_in_practice, duration_ms }; lives-based games use { score, stars, accuracy, livesRemaining }. Contract tests assert the exact fields from the spec — wrong field names cause ALL contract assertions to fail (Lesson 169 — build #545: prompts.js taught livesRemaining/time/duration_data but spec required rounds_completed/wrong_in_practice/duration_ms).
- DATA-TESTID REQUIRED: every <button>, <input>, and <select> element MUST have a data-testid attribute. Required minimums: data-testid="answer-input" (text/number inputs), data-testid="btn-check" or "btn-submit" (submit/check buttons), data-testid="btn-restart" (restart button), data-testid="score-display", data-testid="stars-display", data-testid="lives-display" (if applicable). Multiple-choice buttons: data-testid="option-{index}" (0-indexed). Missing data-testid causes ALL mechanics tests to fail with locator errors.
- TRANSITIONSCREEN AWAIT: ALL transitionScreen.show() calls MUST use await — write: await transitionScreen.show({...}). Without await race conditions occur where next-round setup runs before transition completes.
- GAMESTATE isActive INIT: window.gameState MUST include isActive: true in its initial object (e.g. window.gameState = { ..., isActive: true, gameEnded: false }). Every handler checks if(!gameState.isActive)return — if not initialized, ALL interactions are blocked from the start.
- GEN-112: ProgressBarComponent MUST use options-object API — NEVER a positional string:

  WRONG (causes silent crash → transitionScreen button never dismisses):
    progressBar = new ProgressBarComponent('mathai-progress-bar-slot', { totalRounds: 5 });
    progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives); // 3 args

  RIGHT:
    progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: gameState.totalRounds, totalLives: gameState.totalLives, slotId: 'mathai-progress-slot' });
    if (progressBar) progressBar.update(gameState.currentRound, gameState.lives); // 2 args, null-guarded
${gameLearningsBlock}${learningsBlock}
Write the file now.`;
}

// ─── Step 1b: Static fix prompt ───────────────────────────────────────────────

/**
 * Builds the prompt to fix static validation errors in generated HTML.
 *
 * @param {string} staticErrors - Output from static validator
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} specContent - Spec markdown content
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildStaticFixPrompt(staticErrors, currentHtml, specContent, htmlPath) {
  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;
  return `The following HTML game file has structural issues that need fixing.

ERRORS:
${staticErrors}

${htmlSection}

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
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildContractFixPrompt(contractErrors, specStarType, currentHtml, htmlPath) {
  const htmlSection = htmlPath
    ? `FULL HTML:\n@${htmlPath}`
    : `FULL HTML:\n${stripCssFromHtml(currentHtml)}`;
  return `You are fixing a game HTML file that has contract validation errors.

CONTRACT ERRORS:
${contractErrors.map(e => `  ✗ ${e}`).join('\n')}

SPEC CONTRACT REQUIREMENTS:
${specStarType || ''}

${CDN_CONSTRAINTS_BLOCK}

${htmlSection}

Fix ONLY the contract errors above. Do not change game logic, styling, or working features. Do NOT introduce any new CDN constraint violations while fixing.

VERIFY BEFORE RETURNING — check your output preserves these invariants:
- initSentry() (if present) is INSIDE the waitForPackages() callback, NOT called before it — moving it outside causes "Sentry SDK not yet loaded" crash (Lesson 110)
- window.gameState, window.endGame, window.restartGame, window.nextRound are still exposed on window
- CDN <script> tags are in correct order: helpers → components → feedback-manager

Return the complete corrected HTML.`;
}

// ─── Step 1c: Early review prompt ────────────────────────────────────────────

/**
 * Builds the early spec compliance review prompt (pre-test fast-fail).
 * Also used by buildEarlyReReviewPrompt (same structure, different call site).
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildEarlyReviewPrompt(specContent, currentHtml, htmlPath) {
  return _buildEarlyReviewBody(specContent, currentHtml, htmlPath);
}

// ─── Step 1c: Early review fix prompt ────────────────────────────────────────

/**
 * Builds the prompt to fix an early-review rejection.
 *
 * @param {string} rejectionReason - Full rejection output from early review
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildEarlyReviewFixPrompt(rejectionReason, specContent, currentHtml, htmlPath) {
  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;
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

${htmlSection}

Output the complete corrected HTML wrapped in a \`\`\`html code block.`;
}

// ─── Step 1c: Early re-review prompt ─────────────────────────────────────────

/**
 * Builds the re-review prompt used after an early-review fix attempt.
 * Identical structure to buildEarlyReviewPrompt but used in the fix loop.
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (post-fix) (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildEarlyReReviewPrompt(specContent, currentHtml, htmlPath) {
  return _buildEarlyReviewBody(specContent, currentHtml, htmlPath);
}

/** Shared body for early review and early re-review (identical structure). */
function _buildEarlyReviewBody(specContent, currentHtml, htmlPath) {
  const htmlSection = htmlPath
    ? `HTML:\n@${htmlPath}`
    : `HTML:\n${stripCssFromHtml(currentHtml)}`;
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

${htmlSection}`;
}

// ─── Step 2a: Test cases prompt ───────────────────────────────────────────────

/**
 * Extracts major user interaction scenarios from a game spec using heuristics.
 * Returns 3-7 scenario strings covering core gameplay paths visible in the spec.
 * Uses regex/string parsing — no LLM call.
 *
 * @param {string} specContent - Spec markdown content
 * @param {object} [gameFeatures] - Optional pre-parsed game features from extractGameFeatures().
 *   When provided, gameFeatures.unlimitedLives overrides the spec-text heuristic for lives detection.
 * @returns {string[]} Array of scenario strings like "user selects correct answer → score increases"
 */
function extractUserScenarios(specContent, gameFeatures) {
  const scenarios = [];
  if (!specContent) return scenarios;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const has = (pattern) => pattern.test(specContent);
  const lower = specContent.toLowerCase();

  // ── 1. Correct answer path ────────────────────────────────────────────────
  // Nearly every game has a correct answer path; detect from common keywords
  if (
    has(/correct\s+answer|right\s+answer|selects?\s+correct|taps?\s+correct|clicks?\s+correct/i) ||
    has(/check\s+answer|submit\s+answer|validate\s+answer/i) ||
    has(/correct.*score|score.*correct|score\s+increases?/i)
  ) {
    scenarios.push('user selects correct answer → score increases');
  } else if (has(/score/i) && has(/answer|tap|click|select|choose/i)) {
    scenarios.push('user answers correctly → score increases');
  }

  // ── 2. Wrong answer / lives path ─────────────────────────────────────────
  // If pre-parsed gameFeatures are available, use them authoritatively.
  // Otherwise fall back to spec-text heuristic with explicit unlimited-lives guard.
  let hasLives;
  if (gameFeatures !== undefined) {
    // gameFeatures.hasLives is true only when totalLives > 0 (finite lives); false for unlimited/no-lives
    hasLives = gameFeatures.hasLives === true;
  } else {
    // Spec-text heuristic: explicit unlimited-lives markers take priority
    const hasUnlimitedLives =
      has(/totalLives\s*:\s*0\b/) ||
      has(/unlimitedLives\s*:\s*true/) ||
      has(/livesEnabled\s*:\s*false/i) ||
      has(/no\s+lives|without\s+lives|does\s+not\s+(?:lose|have)\s+lives/i) ||
      has(/PART-006[^]*?0\s*lives/i);

    hasLives =
      !hasUnlimitedLives &&
      (has(/totalLives\s*:\s*[1-9]|lives\s*:\s*[1-9]|\btotalLives\b.*(?:3|2|1)\b/i) ||
        has(/\b(?:3|2|1)\s*lives?\b/i) ||
        (lower.includes('lives') && !has(/totalLives\s*:\s*0|no lives/i)));
  }

  if (has(/wrong\s+answer|incorrect|wrong.*lives|lives.*wrong/i)) {
    if (hasLives) {
      scenarios.push('user selects wrong answer → lives decrease');
    } else {
      scenarios.push('user selects wrong answer → no score awarded');
    }
  } else if (has(/incorrect|wrong|mistake/i) && has(/answer|tap|click|select/i)) {
    if (hasLives) {
      scenarios.push('user answers incorrectly → lives decrease');
    } else {
      scenarios.push('user answers incorrectly → answer rejected, question repeats or feedback shown');
    }
  }

  // ── 3. Lives exhaustion → game over ──────────────────────────────────────
  if (hasLives) {
    if (has(/game.?over|lives.*reach.*0|0.*lives|lives.*exhaust|lose.*all.*lives/i)) {
      scenarios.push('lives reach 0 → game over screen shown');
    } else {
      // Implied from having a lives system
      scenarios.push('all lives lost → game over screen shown');
    }
  }

  // ── 4. All rounds/questions complete → results screen ────────────────────
  if (has(/results?\s+screen|victory\s+screen|complete\s+screen|all\s+rounds?\s+complete/i)) {
    scenarios.push('all rounds complete → results screen shown');
  } else if (has(/\btotalRounds\s*:\s*\d+|\brounds?\b.*\bcomplete\b|\bfinish\b|\bwin\b/i)) {
    scenarios.push('all rounds complete → results screen shown');
  } else if (has(/results|victory/i) && has(/round|level|question/i)) {
    scenarios.push('all rounds/levels complete → results screen shown');
  }

  // ── 5. Timer expiry ───────────────────────────────────────────────────────
  if (
    has(/timer.*runs?\s+out|time\s+(?:limit|runs?\s+out|expires?|up)|countdown.*zero|timerType\s*:\s*['"]decrease['"]/i)
  ) {
    scenarios.push('timer expires → round ends or game over triggered');
  }

  // ── 6. Level/round progression ───────────────────────────────────────────
  if (has(/level\s+(?:2|3|transition|progression|next\s+level)|multiple\s+levels?|levels?\s+increase/i)) {
    scenarios.push('completing a level → next level begins with increased difficulty');
  } else if (has(/round\s+(?:2|3|transition|next)|advances?\s+(?:to\s+)?(?:next\s+)?round/i)) {
    scenarios.push('completing a round → next round begins');
  }

  // ── 7. Game-specific interactions from Description section ───────────────
  // Extract from "Description:" or "## 1. Game Identity" section
  const descMatch = specContent.match(/Description[:\s]+(.+?)(?:\n\n|\n##|\n\|)/is);
  if (descMatch) {
    const desc = descMatch[1].toLowerCase();
    // Specific interaction patterns from description text
    if (/adjust|increment|decrement|\+\s*\/\s*-|plus.*minus/i.test(desc)) {
      scenarios.push('user adjusts values using +/− controls → displayed value changes');
    }
    if (/type|input|enter|fill.*(?:sum|answer|number)/i.test(desc)) {
      scenarios.push('user types answer in input field → answer validated on submit');
    }
    if (/match|pair|associate/i.test(desc)) {
      scenarios.push('user matches correct pairs → match confirmed and score updates');
    }
    if (/memory|recall|learn.*then|phase.*1.*phase.*2/i.test(desc)) {
      scenarios.push('learn phase completes → recall phase begins with matching questions');
    }
    if (/tap|count.*object|object.*count/i.test(desc)) {
      scenarios.push('user taps correct number of objects → round validated');
    }
  }

  // Deduplicate and cap at 7 scenarios
  const seen = new Set();
  const unique = [];
  for (const s of scenarios) {
    const key = s.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }
  return unique.slice(0, 7);
}

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
8. MANDATORY WRONG ANSWER COVERAGE — the "mechanics" category MUST include at least one test case for the wrong answer path: submit an incorrect answer and verify the consequence (lives decrease OR accuracy/score unchanged). Do not generate only correct-answer paths.
9. MANDATORY LIVES-EXHAUSTION COVERAGE — if the spec has a finite lives system (totalLives > 0): the "game-flow" category MUST include a test case that exhausts all lives via wrong answers and verifies game-over phase is reached. Name it clearly (e.g. "lives exhausted leads to game over").
10. TIMER EXPIRY COVERAGE — if the spec defines a countdown timer (timerType: 'decrease' or mentions "time limit" / "timer runs out"): the "edge-cases" category MUST include a test case for timer expiry triggering game end. Note: implementation uses window.__ralph.endGame('game_over') to simulate expiry — do not expect real wall-clock waits.
11. ANSWER OPTIONS VISIBILITY — if the spec defines N selectable answer options (multiple choice, grid of cards, option buttons): the "edge-cases" category MUST include a test case verifying all N options are visible in the mobile viewport (480×800px) without scrolling.

Categories to cover:
- "game-flow": screen transitions (start → game → level transition → end screen)
- "mechanics": core interactions (input, adjustment controls, check/submit, scoring)
- "level-progression": how levels change (difficulty, content, round structure)
- "edge-cases": boundary values, invalid input, rapid actions, final life/round, timer expiry, option visibility
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
 * @param {string[]} [opts.specScenarios] - User scenarios extracted from spec (may be empty/undefined)
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
    specScenarios,
  } = opts;

  return `You are an expert Playwright test writer for the MathAI game engine.
Generate a test.describe() block for the '${category}' test category.

MANDATORY RULES — violating any of these causes immediate test failure:
1. ONLY use selectors from the ACTUAL RUNTIME DOM snapshot below. NEVER invent element IDs or class names. If a selector is not in the snapshot, use page.evaluate() to read window.gameState instead.
   DATA-TESTID CRITICAL: NEVER invent data-testid values. ONLY use data-testid values that appear verbatim in the DOM snapshot provided below. If an element lacks data-testid, use its CSS selector (#id, .class) or aria-label instead. Inventing testids (e.g. writing data-testid="answer-button" when the snapshot shows data-testid="btn-check") causes locator-not-found failures and RULE-DUP violations across test files.
2. Generate the SIMPLEST possible test that validates the behavior. Prefer single-action tests over multi-step chains. If a test needs 5+ steps, split it or use skipToEnd().
3. Use \`waitForPhase(page, phase)\` ONLY if the DOM snapshot confirms data-phase is present on #app (i.e. the WINDOW.GAMESTATE SHAPE section shows 'phase'). If absent, use \`page.evaluate(() => window.gameState?.phase)\` polling instead.
4. Every \`waitForPhase\` call MUST include an explicit timeout: \`await waitForPhase(page, 'playing', 10000)\`
5. If game content is needed — use \`fallbackContent\` from the shared boilerplate, NOT hardcoded strings from the HTML.
6. Add a test.beforeAll() block as the FIRST item in the describe block to verify window.gameState is on window:
\`\`\`javascript
test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto('/');
  // Wait for window.gameState — CDN cold-start can take 30-120s; poll instead of fixed wait
  const hasGameState = await page.evaluate(async () => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (typeof window.gameState !== 'undefined') return true;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  });
  if (!hasGameState) throw new Error('window.gameState not on window — syncDOMState() will never set data-phase; all waitForPhase() calls will timeout');
  await page.close();
});
\`\`\`
7. Helper usage:
   - \`await answer(page, true)\` / \`await answer(page, false)\` — correct/wrong answer
   - NEVER: \`expect(await getLives(page)).toBe(2)\` — M13 violation: immediate assertion without expect.poll()
   - NEVER: \`expect(await getScore(page)).toBeGreaterThan(0)\` — M13 violation
   - NEVER: \`expect(await getRound(page)).toBe(2)\` — M13 violation
   - ALWAYS: \`await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(2)\` — integer, not emoji
   - ALWAYS: \`await expect.poll(() => getScore(page), { timeout: 3000 }).toBeGreaterThan(0)\`
   - ALWAYS: \`await expect.poll(() => getRound(page), { timeout: 3000 }).toBe(2)\`
   - \`await skipToEnd(page, 'victory')\` / \`await skipToEnd(page, 'game_over')\`

RENDERING RULES — toBeVisible/toBeHidden failures are the #1 test failure cause — follow these precisely:
R1. PHASE-GATED VISIBILITY: Game-play elements (answer inputs, score display, lives, question area) are ONLY visible AFTER startGame() completes. NEVER assert toBeVisible() on playing-phase elements before calling startGame(). Pattern:
    WRONG: await expect(page.locator('[data-testid="answer-input"]')).toBeVisible(); // fails — game not started yet
    RIGHT: await startGame(page); await waitForPhase(page, 'playing', 15000); await expect(page.locator('[data-testid="answer-input"]')).toBeVisible({ timeout: 10000 }); // GF8: waitForPhase BEFORE toBeVisible
R2. TRANSITION SLOT AFTER startGame(): After startGame() resolves, #mathai-transition-slot button is GONE (slot is cleared). NEVER assert toBeVisible() on '#mathai-transition-slot button' immediately after startGame(). The slot button only reappears on level transitions — use clickNextLevel() to wait for it.
    WRONG: await startGame(page); await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible();
    RIGHT: await startGame(page); await answer(page, true); /* complete a level */ await waitForPhase(page, 'transition', 10000); // NEVER use #mathai-transition-slot button selector (banned in assertions — see GF9/TRANSITION_SLOT rule)
R3. NEVER ACCESS window.gameState.content DIRECTLY: Use fallbackContent instead. window.gameState.content may be undefined or have a different shape than expected.
    WRONG: const rounds = window.gameState.content.rounds; // TypeError if content undefined
    RIGHT: use fallbackContent.rounds — check fallbackContent.rounds?.length > 0 before accessing
R4. NEVER USE toHaveText() WITH HARDCODED GAME CONTENT: Dynamic content (question text, round numbers, scores) changes per game instance. Assert structure instead of exact values.
    WRONG: await expect(page.locator('#question-text')).toHaveText('What is 3 + 4?');
    RIGHT: await waitForPhase(page, 'playing', 15000); await expect(page.locator('#question-text')).toBeVisible({ timeout: 10000 }); // GF8: waitForPhase BEFORE toBeVisible
R5. RESULTS/GAMEOVER SCREEN ELEMENTS: Elements on the results or game-over screen (stars display, final score, restart button) are only visible AFTER the game ends. To reach that state, use skipToEnd(page, 'victory') or skipToEnd(page, 'game_over'), then waitForPhase() BEFORE asserting visibility.
R6. CDN GAME toBeVisible TIMEOUTS: For CDN games, game-play elements may take 5–10 extra seconds to appear after startGame() resolves (CDN components continue rendering). Use at least { timeout: 10000 } on any toBeVisible() assertion immediately after startGame(). Default 5s timeout will flake on slow CDN loads.
    WRONG: await expect(page.locator('#question-text')).toBeVisible(); // 5s default — flakes on CDN
    RIGHT: await expect(page.locator('#question-text')).toBeVisible({ timeout: 10000 });
R7. NEVER USE .resolves ON AN AWAITED VALUE: .resolves is only valid on a Promise, not on an already-resolved value. When you already used await, drop .resolves.
    WRONG: expect(await page.evaluate(() => window.gameState.lives)).resolves.toBe(3); // TypeError
    RIGHT: expect(await page.evaluate(() => window.gameState.lives)).toBe(3);

CATEGORY FOCUS: ${categoryDescription}

IMPLEMENT ALL ${testCaseCount} TEST CASES BELOW — one test() per case, no skipping, no merging:
${testCasesText}

Your test.describe() block MUST contain exactly ${testCaseCount} test() calls.

HELPER FUNCTION BEHAVIOR:

startGame(page): Clicks through ALL initial transition screens until the game is active. After startGame() resolves, #mathai-transition-slot button is NOT visible. NEVER call clickNextLevel() right after startGame().

clickNextLevel(page): Waits for #mathai-transition-slot button to be visible, then clicks it. ONLY for MID-GAME level transitions — NEVER right after startGame(). CRITICAL: Do NOT use clickNextLevel() for games where the transition slot auto-advances (no visible button between rounds). If the game calls transitionScreen.show() with no buttons config (e.g. type: 'level-transition' without buttons), the slot is auto-dismissed — there is no button to click. Instead use: await waitForPhase(page, 'reveal') to detect when the next round starts. Check the GAME FEATURE FLAGS for hints, and inspect the DOM snapshot to see if #mathai-transition-slot button appears at runtime.

dismissPopupIfPresent(page): Dismisses any popup/backdrop (audio permission, etc.).

Transition slot selectors (CDN constants — use ONLY for clickNextLevel() patterns):
  - Button: page.locator('#mathai-transition-slot button').first()
  - Title: page.locator('#transitionTitle')
  - Subtitle: page.locator('#transitionSubtitle')
  - WRONG: '.game-btn', '.btn-primary' — button class is 'mathai-transition-btn'
  - CRITICAL: NEVER assert toBeVisible() on '#mathai-transition-slot button' in game-flow, level-progression, or contract tests. The transition slot button is ABSENT after startGame(), ABSENT between rounds in auto-advance games, and ABSENT in contract test flows. Using '#mathai-transition-slot button' as a selector in these contexts causes 100% test failures. Only the clickNextLevel() helper may interact with this selector — do NOT use it directly in test assertions or await chains.

Progress slot selectors:
  - Rounds/progress: page.locator('#mathai-progress-slot .mathai-progress-text')
  - Lives: page.locator('#mathai-progress-slot .mathai-lives-display')

Game-specific selectors: USE THE DOM SNAPSHOT below. Do NOT guess element IDs.
- CSS SELECTOR SAFETY: If an element has an ID containing commas or special CSS chars (e.g. id="edge-el-0,0-0,1"), NEVER use page.locator('#edge-el-0,0-0,1') — commas make it an invalid CSS selector and cause "unexpected token" parse errors that fail ALL tests in the file. Use attribute selector instead: page.locator('[id="edge-el-0,0-0,1"]') or better page.locator('[data-edge="0,0-0,1"]') if a data attribute is available.

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
- NEVER directly assign to window.gameState properties (e.g. window.gameState.score = X, window.gameState.phase = 'gameover') to set up test state — direct assignment bypasses game logic and leaves harness out of sync. For contract tests: play through the game via answer() or use skipToEnd(page, 'victory') to naturally reach game-over, then read postMessage via const msg = await page.evaluate(() => window.__ralph.getLastPostMessage()); expect(msg.type).toBe('game_complete');
- LIVES SYSTEM CHECK: Before generating any test that asserts lives/hearts decrease on a wrong answer, check the spec (embedded in the HTML or provided above) for the ProgressBar configuration. If totalLives: 0, livesEnabled: false, "no lives", or totalLives is absent/0, do NOT generate a lives-decrement assertion. Instead assert accuracy tracking or score changes. Only generate expect(await getLives(page)).toBe(N-1) style assertions when the spec explicitly sets a finite totalLives (e.g. totalLives: 3).
- NEVER assert exact timer text like toBe('00:00') — check visibility: await expect(page.locator('#mathai-timer-slot')).toBeVisible()
- To trigger endGame without playing all rounds: use skipToEnd(page, 'victory')
- When testing re-clicking a "correct" cell: use cell.click({ force: true }) — CSS pointer-events:none prevents plain click
${category === 'mechanics' ? `
MECHANICS-SPECIFIC RULES (highest failure rate category — follow precisely):
M1. NEVER hardcode expected lives/score values — always read the INITIAL value first, then assert the delta:
    WRONG: expect(await getLives(page)).toBe(2);
    RIGHT: const livesBefore = await getLives(page); await answer(page, false); await expect.poll(() => getLives(page), { timeout: 5000 }).toBe(livesBefore - 1);
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
    await expect.poll(() => getScore(page), { timeout: 5000 }).toBeGreaterThan(0); // use toBeGreaterThan(0) not toBe(exact_value) unless spec defines exact points
M6. For games with ANIMATION or REVEAL phases before player interaction (shuffle games, memory-reveal games):
    NEVER call answer() or click an option immediately after startGame(). The game has reveal/shuffle phases where
    gameState.isActive = false — clicks are silently swallowed. ALWAYS wait for isActive=true first:
    await expect.poll(() => page.evaluate(() => window.gameState?.isActive === true), { timeout: 15000 }).toBeTruthy();
    Then call answer() or click. Without this wait, the answer is silently ignored, the round never completes,
    and any test waiting for the next transition-screen button will timeout (Lesson 102, keep-track #465).
M7. For games where the CORRECT TARGET changes position after shuffling (shell games, card-swap games):
    NEVER use a hardcoded data-signal-id or fixed index to identify the correct element after shuffles.
    The correct element tracks DOM position (data-testid="option-N"), not its original signal-id.
    ALWAYS read the current correct position from gameState dynamically:
    const correctPos = await page.evaluate(() => window.gameState?.correctCup ?? window.gameState?.correctIndex ?? 0);
    await expect(page.locator(\`[data-testid="option-\${correctPos}"]\`)).toHaveClass(/correct/);
    (Lesson 103, keep-track #465 mechanics failure)
M8. For games with a REVEAL/PREVIEW PHASE inside each round (dots appear then disappear, cards flip then hide, pattern shows then clears):
    NEVER call answer() immediately after the previous answer() completes. The game may delay rendering option buttons with a setTimeout reveal animation. Wait for option buttons to be VISIBLE in DOM before calling answer():
    await expect(page.locator('.option-btn').first()).toBeVisible({ timeout: 5000 });
    await answer(page, true);
    Without this wait: answer() sees isProcessing=false (set at round start), calls querySelectorAll('.option-btn') → empty list → click silently fails → 10s timer fires → game advances without player input → phase never reaches gameover → test times out waiting for gameover.
    (Lesson 109, count-and-tap #457 game-flow failure)
M9. Shell games (cup shuffle + guess): ALWAYS await waitForPhase(page, 'guess') before clicking any cup/option selector. Clicking during the shuffle animation causes interaction failure — the click lands on an element that is moving/transitioning and is silently ignored. The game enters a 'guess' phase (data-phase="guess") only after shuffling completes; only then is a cup click valid. Pattern:
    WRONG: await startGame(page); await page.locator('[data-testid="option-0"]').click(); // during shuffle → ignored
    RIGHT: await startGame(page); await waitForPhase(page, 'guess', 15000); await page.locator('[data-testid="option-0"]').click();
    (keep-track #477 mechanics failure)
M10. NEVER build a selector using a gameState value read at test-gen time. If the option buttons use data-value attributes (e.g. '.option-btn[data-value="X"]'), always read the value at runtime from window.gameState:
    WRONG: await page.locator('.option-btn[data-value="7"]').click(); // "7" was hardcoded from snapshot — may differ at runtime
    WRONG: await page.locator(\`.option-btn[data-value="\${window.gameState.content[0]}"]\`).click(); // interpolated at gen time → "undefined"
    RIGHT: const val = await page.evaluate(() => window.gameState?.content?.[0]?.value ?? window.gameState?.currentAnswer);
           await page.locator(\`.option-btn[data-value="\${val}"]\`).click();
    Use data-testid="option-N" selectors (option-0, option-1 …) whenever possible — they are stable across rounds.
    (count-and-tap #471: selector '.option-btn[data-value="undefined"]' → timeout on every test)
M11. For games with MULTI-SUB-PHASE rounds (e.g. phase1 → phase2 within a single round), NEVER check phase2 visibility after completing only partial phase1 actions. Read the DOM snapshot to understand how many phase1 steps the game requires before phase2 unlocks, and complete ALL of them:
    WRONG: await answer(page, true); await expect(page.locator('#phase2-area')).not.toHaveClass(/hidden/); // only 1 of N phase1 steps done
    RIGHT: // Complete all N required phase1 actions first, e.g.:
           for (let i = 0; i < requiredPhase1Steps; i++) { await answer(page, true); }
           await expect.poll(() => page.locator('#phase2-area').getAttribute('class'), { timeout: 5000 })
             .not.toMatch(/hidden/);
    Check the DOM snapshot's gameState shape for fields like 'phase1Complete', 'matchesNeeded', or step counters to know how many sub-steps are required.
    (two-digit-doubles-aided #306: phase2-area stayed hidden because phase1 required 2 matches, test only did 1)
M12. For COUNTER-INCREMENT tests (pairs found, score display, accuracy), each test must begin from a known-zero baseline by calling startGame(page) at the top of the test to reset game state. Never assume a counter starts at 0 because the page loaded — a prior test in the same file may have incremented it:
    WRONG: await answer(page, true); await answer(page, true); await expect(page.locator('#pairs-found-display')).toHaveText('2'); // counter was already at 1 from previous test
    RIGHT: await startGame(page); // resets state to round 1, all counters zero
           await answer(page, true); await answer(page, true);
           await expect(page.locator('#pairs-found-display')).toHaveText('2');
    (speedy-taps #310: pairs-found-display showed "1" not "2" — previous test had already found 1 pair)
M13. SYNCDOMESTATE RACE GUARD — NEVER read getLives/getScore/getRound immediately after a state-changing action (click, answer, etc.). syncDOMState() polls every 500ms — the attribute may not have updated yet. ALWAYS use expect.poll():
    await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(N);
    await expect.poll(() => getScore(page), { timeout: 3000 }).toBe(N);
    await expect.poll(() => getRound(page), { timeout: 3000 }).toBe(N);
    Direct reads like: const lives = await getLives(page); expect(lives).toBe(N); will produce flaky tests.
M14. WRONG ANSWER PATH — every mechanics test file MUST include at least one test that submits a wrong answer and verifies the consequence (lives decrease OR accuracy tracking update). Do NOT generate only correct-answer paths. Pattern:
    await startGame(page);
    const livesBefore = await getLives(page);
    await answer(page, false);
    await expect.poll(() => getLives(page), { timeout: 5000 }).toBe(livesBefore - 1); // or check accuracy if no lives system
    If the spec has no lives system (totalLives: 0 or livesEnabled: false), assert that score does NOT increase after a wrong answer instead.
M15. CSS CLASS ASSERTIONS (correct/wrong/disabled/active) — NEVER use direct .toHaveClass() immediately after an action (click, answer, timeout). Game CSS class updates may be deferred inside setTimeouts or requestAnimationFrame — the class may not be applied for 300-800ms after the triggering action. ALWAYS use expect.poll() or increase timeout to minimum 10s:
    WRONG: await answer(page, true); await expect(btn).toHaveClass(/correct/, { timeout: 5000 }); // 5s misses deferred class update
    RIGHT: await answer(page, true);
           await expect.poll(() => btn.getAttribute('class'), { timeout: 5000 }).toMatch(/correct/);
    If the game uses animation frames or CSS transitions before updating classes, 5s will miss it on cold CDN.
    (two-player-race #506: .p1-option[data-index="1"] had class "p1-option disabled" not "correct" — class update fired in setTimeout after answer event)` : ''}
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
GF3: GAME-OVER PHASE TRANSITION (amended) — NEVER assert data-phase="gameover" immediately after the last wrong answer. Lives decrement and the gameover transition fire asynchronously; the phase may stay "playing" for 300–800ms after lives reach 0. ALWAYS use waitForPhase(page, 'gameover', 20000) (20s timeout) — CDN cold-start + deferred endGame can exceed 15s. NEVER a short toHaveAttribute assertion with the default 10s timeout. Pattern:
    WRONG: await answer(page, false); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'gameover', { timeout: 10000 });
    RIGHT: await answer(page, false); await waitForPhase(page, 'gameover', 20000);
    If 'gameover' is not in the phase list (GF1), use the end-phase name that IS listed (e.g. 'results' for games with no separate gameover phase).
    (count-and-tap #471/#457/#440, matching-doubles #305, keep-track #483 — all stuck at "playing" with 10s timeout)
GF4: RESULTS PHASE AFTER skipToEnd/endGame — ALWAYS use waitForPhase(page, 'results', 20000) (20s timeout) after skipToEnd() or window.__ralph.endGame(). The results screen transition can involve: endGame() call → gameState update → syncDOMState 500ms poll → DOM attribute set. A 10s timeout is frequently insufficient. Pattern:
    WRONG: await skipToEnd(page, 'victory'); await expect(page.locator('#app')).toHaveAttribute('data-phase', 'results', { timeout: 10000 });
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000);
    If testing CSS visibility of #results-screen instead of data-phase: also increase timeout to 20s and ensure you are NOT checking #game-screen toBeHidden before #results-screen toBeVisible — check results visible FIRST.
    (light-up #473/#463, associations #462, free-the-key #404, jelly-doods #298, listen-and-add #302)
GF5: DO NOT USE #mathai-transition-slot button IN GAME-FLOW TESTS. The transition slot is owned by the CDN and may auto-dismiss without rendering a button (type='level-transition' auto-advances; only type='level-up' or 'game-over' renders a button). Waiting for '#mathai-transition-slot button' in game-flow tests causes systematic timeouts. Instead:
    — To advance past a round/phase boundary: call await answer(page, true) and then await waitForPhase(page, '<next-phase>', 15000) to detect when the next state begins.
    — To reach results from any point: use await skipToEnd(page, 'victory') + await waitForPhase(page, 'results', 20000).
    — NEVER: await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible() in game-flow tests.
    (light-up #411, associations #405, count-and-tap #440 — 9 test failures from this single pattern)
GF6: SUB-PHASE WAITFORPHASE GUARD — Only use waitForPhase('playing') if the DOM snapshot shows data-phase="playing" as the actual active phase. Games with sub-phases (reveal→guess, input→feedback, etc.) may NEVER show 'playing'. If the DOM snapshot shows a different phase string (e.g. 'reveal', 'guess', 'input'), use that phase string instead. Check ACTUAL RUNTIME DOM section for the phase value observed during gameplay.
    WRONG: await waitForPhase(page, 'playing', 10000); // times out if game uses 'reveal' or 'guess' sub-phases
    RIGHT: await waitForPhase(page, 'guess', 10000); // use the phase name shown in ACTUAL RUNTIME DOM
GF7: LIVES-EXHAUSTION GAME-OVER PATH — every game-flow test file MUST include at least one test that exhausts all lives via wrong answers and verifies the gameover phase is reached. This path is distinct from skipToEnd('game_over') — it tests the real lives countdown. Pattern (for games with finite lives):
    await startGame(page);
    await expect.poll(() => getLives(page), { timeout: 5000 }).toBeGreaterThan(0);
    const lives = await getLives(page);
    for (let i = 0; i < lives; i++) { await answer(page, false); }
    await waitForPhase(page, 'gameover', 20000);
    If the game has no lives system (spec shows totalLives: 0 or livesEnabled: false), skip this test and note "no lives system" in its name. ONLY generate this test when the spec explicitly configures a finite totalLives.
GF8. SCREEN VISIBILITY ASSERTIONS (toBeVisible/toBeHidden) — after any state-changing action (endGame, restart, skipToEnd), NEVER assert screen visibility (e.g. toBeHidden('#game-screen'), toBeVisible('#results-screen')) with the default 5s Playwright timeout. Screen visibility changes may lag behind data-phase changes by 500ms-2s. ALWAYS wait for the target phase FIRST, then assert visibility:
    WRONG: await skipToEnd(page, 'victory'); await expect(page.locator('#game-screen')).toBeHidden({ timeout: 5000 }); // game-screen still visible — phase not yet settled
    RIGHT: await skipToEnd(page, 'victory');
           await waitForPhase(page, 'results', 20000);  // wait for phase FIRST
           await expect(page.locator('#game-screen')).toBeHidden({ timeout: 10000 }); // then check visibility with 10s budget
    For restart flows: wait for phase 'start' or 'playing' before asserting screen visibility.
    (identify-pairs-list #515: #game-screen still visible at results — fixed iter 2; two-player-race #506: #game-screen not visible after restart)
GF9: NEVER use '#mathai-transition-slot button' as a selector in game-flow tests. This is an internal CDN container that is absent or auto-dismissed in the vast majority of game-flow scenarios: (a) after startGame() — the slot is cleared; (b) between rounds on auto-advance games — no button ever renders; (c) in contract/results flows — skipToEnd() bypasses the slot entirely. 100% of builds that use this selector in game-flow tests produce test failures. Instead:
    — To navigate from start screen to gameplay: use startGame(page) — it handles all transition screens internally.
    — To advance past a round boundary: use await answer(page, true) + await waitForPhase(page, '<next-phase>', 15000) to detect when the next state begins.
    — To reach results from any point: use await skipToEnd(page, 'victory') + await waitForPhase(page, 'results', 20000).
    WRONG: await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible(); // times out — button absent in game-flow
    RIGHT: await startGame(page); // navigates through start screen; OR await waitForPhase(page, 'playing', 15000);
    (11/11 recent approved builds violated this — linter R&D finding)
`;
})() : ''}
${category === 'level-progression' ? `
LEVEL-PROGRESSION SPECIFIC RULES:
LP1. CRITICAL: Do NOT use clickNextLevel() for games where the transition slot auto-advances (no visible button between rounds). Some games call transitionScreen.show({ type: 'level-transition' }) WITHOUT a buttons config — the CDN auto-dismisses this type after a brief display. In these cases, #mathai-transition-slot button NEVER appears between rounds and clickNextLevel() will timeout. Instead use:
    await waitForPhase(page, 'reveal') — to detect when the next round starts (or whatever phase the game enters post-round)
    Check the DOM snapshot and GAME FEATURE FLAGS to determine whether a button appears. If the snapshot shows #mathai-transition-slot was rendered at runtime but no button child, the slot is auto-advancing.
    WRONG: await answer(page, true); await clickNextLevel(page); // timeouts if slot auto-advances
    RIGHT: await answer(page, true); await waitForPhase(page, 'reveal', 10000); // detect next round start
LP2. Use getRound(page) to assert round counter changes between rounds. Do NOT try to read round numbers from text content — use the data-round attribute via getRound().
LP3. If a game has levels (GAME FEATURE FLAGS shows hasLevels: true), test that content changes between levels by comparing fallbackContent.rounds per level, not by asserting specific text values.
LP4. NEVER wait for '#mathai-transition-slot button' between rounds in level-progression tests. The transition slot in level-progression context is almost always type='level-transition' which auto-dismisses without rendering a button. Waiting for a button causes systematic timeouts every iteration. ALWAYS detect round advancement via waitForPhase() or getRound() polling:
    WRONG: await answer(page, true); await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible(); await page.locator('#mathai-transition-slot button').first().click(); // button never appears → timeout
    RIGHT: await answer(page, true); await expect.poll(() => getRound(page), { timeout: 10000 }).toBeGreaterThan(startRound); // detects round increment via data-round
    OR RIGHT: await answer(page, true); await waitForPhase(page, '<next-phase>', 10000); // detects phase change when next round starts
    (speedy-taps #310 round-1-to-round-2-difficulty-increase, two-digit-doubles-aided #306 prompt-number-updates-each-round, matching-doubles #305 round_1_to_3 — all timeout on '#mathai-transition-slot button' between rounds)
LP5. ALWAYS use expect.poll() with a timeout when asserting getRound() after answering. syncDOMState() updates data-round on a 500ms poll interval — asserting getRound() synchronously immediately after answer(page, true) reads the stale pre-answer value. Pattern:
    WRONG: await answer(page, true); expect(await getRound(page)).toBe(2); // reads data-round before syncDOMState fires → gets 1
    RIGHT: await answer(page, true); await expect.poll(() => getRound(page), { timeout: 10000 }).toBe(2); // waits for 500ms syncDOMState poll to update data-round
    Also applies to data-score and data-lives: always use expect.poll() when asserting DOM-sync'd attributes immediately after a game action.
    (count-and-tap #471 "Expected: 1 Received: 0" round after answer, count-and-tap #457 round scheduling Expected: true Received: false — both stale data-round reads)
LP6. NEVER hardcode spec-derived difficulty thresholds (pair counts, item counts, number ranges) as exact toBe() values without accounting for off-by-one boundary conditions. Spec descriptions like "rounds 1–3 have 3 pairs, rounds 4–6 have 4 pairs" are often implemented as >=3 or >N rather than ===N, and counting items from a live DOM may include hidden/disabled elements. ALWAYS assert with toBeGreaterThanOrEqual() or toBeGreaterThan() for difficulty quantities, and filter to only visible/enabled elements when counting:
    WRONG: expect(await page.locator('.pair-cell').count()).toBe(4); // round 4 "should have 4 pairs" — counts hidden cells too, or boundary is >=4
    RIGHT: expect(await page.locator('.pair-cell:visible').count()).toBeGreaterThanOrEqual(4); // visible cells only, allows spec's boundary math
    (matching-doubles #305 round_4_has_4_pairs Expected:3 Received:2, matching-doubles #305 round_7_has_5_pairs Expected:6 Received:5, make-x #304 level3_rounds_use_larger_numbers Expected:3 Received:2)
` : ''}${category === 'contract' ? `
CONTRACT SPECIFIC RULES:
C1. CRITICAL: Contract tests MUST reach the results screen via: await skipToEnd(page, 'victory') — NEVER by clicking through rounds manually. Clicking through rounds may timeout if the game uses auto-advancing transitions (no button on #mathai-transition-slot between rounds). Pattern:
    WRONG: await answer(page, true); await clickNextLevel(page); await answer(page, true); // times out on auto-advance games
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 10000);
    Then: const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
C2. ALWAYS read postMessage via window.__ralph.getLastPostMessage() — never via window.parent.postMessage which is inaccessible to test code. Pattern:
    await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 10000);
    const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
    expect(msg).not.toBeNull(); expect(msg.type).toBe('game_complete');
C3. For testing different star values, use skipToEnd(page, 'game_over') for 0-star scenarios and setLives() before skipToEnd to control lives-based stars. Do NOT use setLives() for accuracy-based or timer-based star games.
CT3. NEVER use '#mathai-transition-slot button' to reach game completion in contract tests — the transition slot may auto-dismiss without rendering a button (type='level-transition'). This causes 'element(s) not found' timeouts that prevent the postMessage from ever firing. ALWAYS use skipToEnd() + waitForPhase('results', 20000):
    WRONG: await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible(); await page.locator('#mathai-transition-slot button').first().click();
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000);
    The 20s timeout is required — results transition involves endGame() → gameState update → syncDOMState 500ms poll → DOM attribute set.
    (associations #405, light-up #411, adjustment-strategy #381, keep-track #477 — all contract failures from transition-slot waiting)
CT4. (STRENGTHENED) waitForPhase('results', 20000) MUST come BEFORE getLastPostMessage(). Mandatory sequence — copy this exactly:
    await waitForPhase(page, 'results', 20000);
    // CT6: postMessage dispatches async — use expect.poll() on getLastPostMessage() below rather than a fixed wait
    const msg = await expect.poll(() => page.evaluate(() => window.__ralph.getLastPostMessage()), { timeout: 5000, intervals: [200] }).not.toBeNull().catch(() => null);
    if (msg === null) { test.skip(true, 'CT6: postMessage not received after results phase — CDN race condition'); return; }
    expect(msg).not.toBeNull();
    NEVER call getLastPostMessage() before waitForPhase('results'). Never assert .not.toBeNull() before the null check.
    WRONG: await skipToEnd(page, 'victory'); const msg = await page.evaluate(() => window.__ralph.getLastPostMessage()); expect(msg).not.toBeNull(); // null — results phase not reached
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000); const msg = await expect.poll(() => page.evaluate(() => window.__ralph.getLastPostMessage()), { timeout: 5000, intervals: [200] }).not.toBeNull().catch(() => null); if (msg === null) { test.skip(true, 'CT6: postMessage not received after results phase — CDN race condition'); return; } expect(msg).not.toBeNull();
    (disappearing-numbers #479/#480, keep-track #465, interactive-chat #387 — all returned null because results phase was not awaited)
CT5. ALWAYS assert postMessage payload using the NESTED data structure — NEVER assert top-level fields. CDN games send type: 'game_complete' (NOT 'gameOver'). CRITICAL: assert the EXACT field names from the spec's postMessage contract — do NOT use generic field names. The nested structure is: msg.type === 'game_complete', msg.data.metrics.{spec-defined-fields}. Examples: worked-example games assert msg.data.metrics.rounds_completed, msg.data.metrics.wrong_in_practice, msg.data.metrics.duration_ms; lives-based games assert msg.data.metrics.score, msg.data.metrics.livesRemaining. Asserting flat top-level fields (msg.score, msg.stars) ALWAYS fails because CDN games wrap all metrics under msg.data:
    WRONG: expect(msg.score).toBeDefined(); expect(msg.type).toBe('gameOver'); expect(msg.duration_data).toBeDefined(); // 'gameOver' is NOT the type CDN games send; flat fields ALWAYS fail
    RIGHT: expect(msg.type).toBe('game_complete'); expect(msg.data.metrics.stars).toBeGreaterThanOrEqual(0); expect(msg.data.metrics.rounds_completed).toBeDefined(); // use spec-defined field names
CT7. postMessage TYPE FIELD — CDN games send type: 'game_complete' (from the gen prompt postMessage template). Contract tests MUST assert msg.type === 'game_complete', NOT 'gameOver'. The 'gameOver' value is the normalized harness event name; the raw postMessage payload from CDN games always uses 'game_complete':
    WRONG: expect(msg.type).toBe('gameOver'); // fails — game sends 'game_complete'
    RIGHT: expect(msg.type).toBe('game_complete'); // matches CDN game postMessage template
    (hidden-sums #227, match-the-cards #226, matching-doubles #382, speedy-taps #310, two-digit-doubles-aided #306 — all 'toHaveProperty' failures on flat fields)
CT6. ALWAYS add a 200ms wait after waitForPhase('results') before calling getLastPostMessage() — CDN games dispatch postMessage asynchronously after the results phase DOM attribute is set, so getLastPostMessage() may still return null if called immediately. Also ALWAYS null-guard the result before asserting fields — if msg is null, log a warning and skip payload assertions rather than failing (prevents false failures from CDN race conditions). Pattern:
    WRONG: await waitForPhase(page, 'results', 20000); const msg = await page.evaluate(() => window.__ralph.getLastPostMessage()); expect(msg).not.toBeNull(); // may be null — postMessage not yet dispatched
    RIGHT: await waitForPhase(page, 'results', 20000);
           // Poll for postMessage instead of fixed wait — CDN dispatches it async after results phase
           const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
           if (msg === null) { test.skip(true, 'CT6: postMessage not received after results phase — CDN race condition'); return; }
           expect(msg.type).toBe('game_complete'); expect(msg.data.metrics.score).toBeDefined();
CT8. NEVER assign the return value of expect.poll() to a variable. expect.poll() returns an Expect object, NOT the callback's return value — assigning it always gives undefined. This caused build #546's contract tests to be deleted by the triage step (msg.type → TypeError: Cannot read properties of undefined).
    FORBIDDEN:
      const msg = await expect.poll(async () => capturePostMessage(page));  // undefined!
      const result = await expect.poll(async () => window.gameState);       // undefined!
    CORRECT patterns for waiting and capturing values:
      // Pattern A: capture then assert (PREFERRED for postMessage)
      let msg;
      await expect.poll(async () => {
        msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
        return msg?.type;
      }, { timeout: 5000, intervals: [200] }).toBe('game_complete');
      expect(msg.data.metrics.stars).toBeGreaterThan(0);

      // Pattern B: use page.waitForFunction
      await page.waitForFunction(() => window.__ralph?.getLastPostMessage()?.type === 'game_complete', { timeout: 15000 });
      const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());

      // Pattern C: evaluate then null-guard (see CT4/CT6 for the canonical sequence)
      const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
      if (msg === null) { test.skip(true, 'CT8: postMessage not received'); return; }
    (build #546 — contract tests deleted because expect.poll() return value was undefined → TypeError on msg.type)
` : ''}${category === 'edge-cases' ? `
EDGE-CASES SPECIFIC RULES (these 3 patterns account for the majority of edge-cases iter-2 failures — follow precisely):
EC1. GAMEOVER PHASE AFTER GUARD TRIGGER — NEVER assert data-phase="gameover" with a short toHaveAttribute timeout immediately after the action that should trigger game-over (e.g. isProcessing guard fires, double-click prevention, final life lost via rapid clicks). The gameover transition is asynchronous — the phase stays "playing" for 300–800ms after the triggering action. ALWAYS use waitForPhase(page, 'gameover', 20000) with a 20s timeout (CDN cold-start + deferred endGame can exceed 15s):
    WRONG: await page.locator('#answer-btn').click(); await page.locator('#answer-btn').click(); // rapid double-click
           await expect(page.locator('#app')).toHaveAttribute('data-phase', 'gameover', { timeout: 10000 }); // stays "playing" — times out
    RIGHT: await page.locator('#answer-btn').click(); await page.locator('#answer-btn').click();
           await waitForPhase(page, 'gameover', 20000); // wait for async gameover transition
    (build 288 one-digit-doubles end_game_guard_against_double_call, build 304 make-x restart_resets_all_state, build 479 disappearing-numbers — all stuck at "playing" with 10s timeout after guard trigger)
EC2. DEBOUNCE / isProcessing GUARD TESTS — NEVER click an element and immediately assert the guard prevented a second state change (e.g. score/count did not double-increment). The isProcessing flag is set and cleared asynchronously; a rapid second click may arrive BEFORE the flag is set, bypassing the guard at the JS level. ALWAYS wait for isProcessing to be true before firing the second click, OR use expect.poll() to assert the FINAL stabilized state after both clicks have resolved:
    WRONG: await page.locator('#submit-btn').click(); await page.locator('#submit-btn').click(); // second fires before isProcessing set
           expect(await page.evaluate(() => window.gameState.score)).toBe(1); // may be 2 — guard not yet active
    RIGHT: await page.locator('#submit-btn').click();
           await expect.poll(() => page.evaluate(() => window.gameState?.isProcessing === true), { timeout: 3000 }).toBeTruthy();
           await page.locator('#submit-btn').click(); // now fires while guard is active
           await expect.poll(() => page.evaluate(() => !window.gameState?.isProcessing), { timeout: 5000 }).toBeTruthy();
           expect(await page.evaluate(() => window.gameState.score)).toBe(scoreBefore + 1); // only 1 increment despite double-click
           // Requires: const scoreBefore = await page.evaluate(() => window.gameState.score); before the first click
    (build 288 one-digit-doubles double_click_prevention Expected:2 Received:3, build 286 queens Interaction After Round Solved Expected:5 Received:6, build 453 memory-flip Click Matched Card Prevention Expected:0 Received:2)
EC3. ELEMENT-STATE SETUP FOR EDGE-CASE NAVIGATION — NEVER use a hardcoded start-button selector to navigate to a mid-game state for edge-case testing (rapid clicks, wrong answer guards, final-life scenarios). Generic selectors like 'button:has-text("Start"), #start-button, .start-btn' may resolve to the RESTART button on a results screen instead of the actual start button, causing locator.click() to timeout or navigate to wrong state. ALWAYS use startGame(page) to reach playing state, then use answer() or window.__ralph helpers to reach the specific mid-game scenario:
    WRONG: await page.locator('button:has-text("Start"), #start-button, .start-btn').first().click(); // may click restart — wrong state
           await page.locator('#rapid-click-target').click({ clickCount: 5 }); // element may not be in correct phase
    RIGHT: await startGame(page); // reliable — clicks through ALL transition screens
           await expect.poll(() => page.evaluate(() => window.gameState?.isActive === true), { timeout: 10000 }).toBeTruthy();
           await page.locator('#rapid-click-target').click(); // now in playing phase, element is interactive
    (build 191 identify-pairs-list Rapid Click Guard timeout, build 211 right-triangle-area Wrong Answer Collision Guard timeout, build 387 interactive-chat Empty Input Disable timeout — all caused by wrong start-button selector clicking restart instead of start)
EC4. TIMER EXPIRY PATH — if the spec defines a countdown timer (timerType: 'decrease' OR spec mentions "time limit", "time runs out", "timer reaches zero"), the edge-cases file MUST include a test verifying that the game ends (gameover or results phase) when the timer expires. Do NOT assert exact timer text — check phase transition. Since real wall-clock waits are too slow for tests, trigger the expiry by calling window.__ralph.endGame('game_over') after verifying the timer is running:
    await startGame(page);
    await expect(page.locator('#mathai-timer-slot')).toBeVisible({ timeout: 10000 }); // confirm timer is active
    await page.evaluate(() => window.__ralph.endGame('game_over')); // simulate timer expiry
    await waitForPhase(page, 'gameover', 20000);
    If the spec has NO countdown timer (timerType: 'increase' or timer not mentioned), OMIT this test and add a comment explaining why.
EC5. ANSWER OPTIONS VIEWPORT VISIBILITY — if the spec lists N answer choices (e.g. 4 options, a grid of cards, multiple choice buttons), the edge-cases file MUST include a test verifying all N options are visible in the mobile viewport (480×800px) without requiring scroll. Use Playwright's isIntersectingViewport() or check that ALL option elements report isVisible(). Pattern:
    await startGame(page);
    const options = page.locator('[data-testid^="option-"]'); // use DOM snapshot selector for this game
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(options.nth(i)).toBeVisible({ timeout: 5000 }); // all options visible without scrolling
    }
    If the game has dynamic/variable option counts (e.g. grid puzzles), skip this test and note why in its name.
EC6. LOCATOR ARGUMENT TYPE — NEVER pass a non-string value to page.locator(). The locator() API requires a CSS selector string. Passing a DOM element (ElementHandle), object, or undefined causes: "locator.click: selector: expected string, got object". Always use string literals or template literals:
    WRONG: const el = await page.$('#btn'); await page.locator(el).click(); // el is ElementHandle, not string
    WRONG: const sel = { testid: 'option-1' }; await page.locator(sel).click(); // object, not string
    RIGHT: await page.locator('#btn').click(); // string selector always
    RIGHT: await page.locator('[data-testid="option-1"]').click(); // attribute selector string
    If you need a dynamic selector: const val = await page.evaluate(() => window.gameState.correctAnswer);
    await page.locator('[data-value="' + val + '"]').click(); // string concatenation = string
    (position-maximizer #507: "selector: expected string, got object" — locator() called with DOM element)
EC-FIX-1. SELECTOR UNIQUENESS REQUIRED — Never use \`[data-testid="option-N"]\` or similar attribute selectors unless you first verify the selector matches exactly ONE element.
    If the DOM snapshot shows multiple elements with data-testid="option-0", data-testid="option-1", etc., use .nth(0) index access or a more specific ancestor+descendant selector.
    Pattern: page.locator('[data-testid="option-0"]').nth(0) or page.locator('#gameContent [data-testid="option-0"]').first()
    NEVER write \`await page.locator('[data-testid="option-0"]').click()\` if that selector could match >1 element in the DOM — this causes strict mode violations and test skips.
    When in doubt, always append .first() or .nth(0) to option selectors, or scope them under #gameContent.
EC-FIX-2. LIVES DEDUCTION: DO NOT ASSUME SINGLE-WRONG-ANSWER BEHAVIOR — Do NOT write a test that assumes: "click one wrong option → lives decrement by 1 immediately."
    Many games require multiple wrong answers before a life is lost, have immunity periods, or only deduct lives at round-end.
    Instead: use the window.__ralph.answer() API to submit a wrong answer, then check window.gameState.lives directly.
    If lives did NOT change after one wrong answer, do NOT fail the test — instead check if lives change after exhausting all attempts on a round.
    Pattern:
        const livesBefore = await page.evaluate(() => window.gameState?.lives);
        await page.evaluate(() => window.__ralph.answer(false));
        const livesAfter = await page.evaluate(() => window.gameState?.lives);
        if (livesAfter === livesBefore) {
          // Game requires multiple wrong answers per life — exhaust attempts instead
          await skipToEnd(page, 'cannot verify single-wrong-answer lives deduction — game uses multi-attempt mechanic');
          return;
        }
        expect(livesAfter).toBeLessThan(livesBefore);
    Fallback: use skipToEnd(page, 'cannot verify lives-deduction without correct selector') if the lives mechanic cannot be verified from the DOM snapshot.
EC-FIX-3. TIMER TESTS: SHORT TIMER REQUIRED OR SKIP — Do NOT write a timer-expiry test for a game that has timeLimit > 30 seconds — the test would take too long and timeout.
    Before writing a timer test, check window.gameState for a \`timeLimit\` or \`timer\` property from the DOM snapshot.
    If timeLimit > 30, use skipToEnd(page, 'timer too long to test expiry (>30s)') — do NOT fake-advance the clock, as games don't use vi.useFakeTimers().
    If timeLimit is undefined or unknown, write the test with an inline guard:
        await startGame(page);
        const timerTooLong = await page.evaluate(() => (window.gameState?.timeLimit ?? window.gameState?.timer ?? 0) > 30);
        if (timerTooLong) { await skipToEnd(page, 'timer too long to test expiry (>30s)'); return; }
        await expect(page.locator('#mathai-timer-slot')).toBeVisible({ timeout: 10000 });
        await page.evaluate(() => window.__ralph.endGame('game_over'));
        await waitForPhase(page, 'gameover', 20000);
    This guard is MANDATORY in every timer-expiry test — never omit it.
` : ''}${(specScenarios && specScenarios.length > 0 && ['game-flow', 'mechanics', 'edge-cases'].includes(category)) ? `
REQUIRED SCENARIO COVERAGE (extracted from spec):
The spec defines these user interaction scenarios. For this '${category}' category, you MUST write at least one test that covers each applicable scenario below. If a scenario is not testable in this category (e.g. a lives scenario in a no-lives game), use skipToEnd(page, 'reason') but document why in the test name:
${specScenarios.map((s, i) => `${i + 1}. ${s}`).join('\n')}
` : ''}- Wrap output in a \`\`\`javascript code block
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

EC-TRIAGE-1 — STRICT EVIDENCE GATE FOR skip_test (enforced, no exceptions):
Before returning skip_test for any failure, you MUST cite the exact DOM selector or HTML element from the test file that proves the test assumption is wrong. Vague claims ("spec is ambiguous", "timing issue", "may not exist") do NOT satisfy this gate.
- BANNED reasons for skip_test: "element not found", "strict mode violation" (locator resolved to N elements), TimeoutError waiting for a selector — these are FIXABLE selector bugs in the test, not grounds for skipping.
- BANNED reasons for skip_test: the test uses a wrong CSS class, wrong attribute name, or wrong selector — those are test generation bugs; mark fix_html=false and use the test-fix path instead.
- ALLOWED reasons for skip_test (must cite exact evidence): (a) behavior requires real elapsed time with no fast-forward API (e.g. 60s timer, no jumpToRound equivalent); (b) Playwright API fundamentally cannot interact with the element type (e.g. input[type=number] + non-numeric fill, force-click on display:none); (c) window.gameState property or method the test relies on is provably absent from the HTML source (cite the property name and confirm absence by reading the test file).
- If you cannot cite specific DOM/HTML proof, default to fix_html, not skip_test.

KNOWN TEST BUGS — always diagnose as skip_test:
- TimeoutError: locator.click timeout on a .correct cell → pointer-events:none; test is re-clicking a disabled cell.
- TypeError on window.gameState.events.filter|length → game doesn't track events array; test assumption wrong.
- Cannot redefine property: visibilityState → already defined in beforeEach initScript.
- "unexpected token" / "is not valid selector" error with page.locator('#id-with,commas') → element ID contains commas (invalid CSS) → test generated invalid selector → skip_test and re-gen with attribute selector [id="..."].
- Test directly assigns to window.gameState properties (e.g. window.gameState.score = X, window.gameState.phase = 'gameover') to trigger game completion or state changes instead of playing through the game → test logic bug; direct assignment bypasses game handlers and may leave DOM/harness out of sync. Fix: interact through the game UI (click buttons, call answer()) and use skipToEnd(page, reason) to reach end state, then capture postMessage via window.__ralph.getLastPostMessage(). skip_test.
- TypeError accessing properties on fallbackContent (e.g. round.validSolution, fallbackContent.puzzle) when those properties are absent from the test file's fallbackContent definition → test data mismatch, skip_test.

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
 * @param {string} opts.lessonHintsContext - Matched pipeline lesson hints (may be empty)
 * @param {number} opts.failed - Number of failing tests
 * @param {string} opts.failuresStr - Formatted failure descriptions
 * @param {string} opts.passingContext - Currently passing test bodies context (may be empty)
 * @param {string} opts.priorBatchContext - Prior batch passing tests context (may be empty)
 * @param {string} opts.batchTests - Full content of the batch spec files
 * @param {string} opts.htmlForPrompt - HTML to fix (may be full HTML or script sections only); used when htmlPath is not provided
 * @param {string} opts.outputInstructions - Output format instructions
 * @param {string} [opts.scriptDiffContext] - Optional diff of script sections between prev and curr iteration (iteration 2+)
 * @param {string} [opts.htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildFixPrompt(opts) {
  const {
    batchLabel,
    fixStrategy,
    fixHintContext,
    specScoringContext,
    fixLearningsContext,
    lessonHintsContext,
    failed,
    failuresStr,
    passingContext,
    priorBatchContext,
    batchTests,
    htmlForPrompt,
    outputInstructions,
    brokenPageErrorContext,
    scriptDiffContext,
    htmlPath,
  } = opts;

  const diffSection = scriptDiffContext
    ? `\nPREVIOUS FIX ATTEMPT DIFF (what changed from last iteration → current):\n\`\`\`diff\n${scriptDiffContext}\n\`\`\`\n`
    : '';

  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(htmlForPrompt)}`;

  return `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}${specScoringContext}${fixLearningsContext}${lessonHintsContext || ''}${brokenPageErrorContext || ''}${diffSection}
FAILING TESTS (${failed} failures):
${failuresStr}
${passingContext}${priorBatchContext}
FAILING TEST FILE(S):
\`\`\`javascript
${batchTests}
\`\`\`

${htmlSection}

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
 * @param {string} opts.currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [opts.brokenPageErrorContext] - Console errors from a rolled-back broken page (may be empty)
 * @param {string} [opts.htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
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
    brokenPageErrorContext = '',
    htmlPath,
  } = opts;

  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;

  return `The following HTML game still has test failures after per-category fix loops have run.

This is GLOBAL FIX iteration ${globalIter}/${maxGlobalIterations}. You are seeing ALL failing categories simultaneously so you can diagnose cross-category root causes that are not visible when looking at one category in isolation.

INSTRUCTION: Diagnose the ROOT CAUSE common across failing categories. A single HTML bug often manifests as different symptoms across categories. Fix the root cause — do NOT patch each category's symptom independently.
${fixLearningsContext}${brokenPageErrorContext}
FAILING CATEGORIES:

${globalFailureSummary}
${globalPassingContext}${additionalPriorContext ? `\nADDITIONAL PRIOR PASSING TESTS (do not regress):\n${additionalPriorContext}\n` : ''}
FAILING TEST FILES:
\`\`\`javascript
${globalTestFilesBlock}
\`\`\`

${htmlSection}

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
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildReviewPrompt(categoryResultsSummary, specContent, currentHtml, htmlPath) {
  return `You are a game quality reviewer. Review the following HTML game against its specification.

TEST RESULTS BY CATEGORY:
${categoryResultsSummary}

${_buildReviewBody(specContent, currentHtml, htmlPath)}`;
}

// ─── Step 4b: Review fix prompt ───────────────────────────────────────────────

/**
 * Builds the prompt to fix a review rejection.
 *
 * @param {string} rejectionReason - Full rejection output from reviewer
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildReviewFixPrompt(rejectionReason, specContent, currentHtml, htmlPath) {
  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;
  return `The following HTML game was reviewed against its specification and REJECTED.

REJECTION REASON:
${rejectionReason}

SPECIFICATION:
${specContent}

${htmlSection}

Fix ALL issues listed in the rejection reason in ONE pass.
CRITICAL: Do NOT change ANYTHING not mentioned in the rejection reason — do not refactor, rewrite, or touch code that already works.
Output the complete corrected HTML wrapped in a \`\`\`html code block.`;
}

// ─── Step 4b: Re-review prompt ────────────────────────────────────────────────

/**
 * Builds the re-review prompt used after a review fix attempt.
 *
 * @param {string} specContent - Spec markdown content
 * @param {string} currentHtml - Current HTML content (post-fix) (used when htmlPath is not provided)
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildReReviewPrompt(specContent, currentHtml, htmlPath) {
  return `You are a game quality reviewer. Review the following HTML game against its specification.

${_buildReviewBody(specContent, currentHtml, htmlPath)}`;
}

/** Shared body for review and re-review prompts. */
function _buildReviewBody(specContent, currentHtml, htmlPath) {
  const htmlSection = htmlPath
    ? `HTML:\n@${htmlPath}`
    : `HTML:\n${stripCssFromHtml(currentHtml)}`;
  return `The SPECIFICATION contains a 'Verification Checklist' section with detailed checks across Structural, Functional, Design & Layout, Rules Compliance, Game-Specific, and Contract Compliance categories. Use that checklist as your PRIMARY review guide.

Walk through EVERY item in the checklist. For each item, verify it passes in the HTML.

${REVIEW_SHARED_GUIDANCE}

Respond with EXACTLY one of:
- APPROVED — if all checklist items pass
- REJECTED: <list the specific checklist items that failed>

SPECIFICATION:
${specContent}

${htmlSection}`;
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
 * @param {string} currentHtml - Current HTML content (used when htmlPath is not provided)
 * @param {string} specContent - Spec markdown content
 * @param {number} currentlyPassing - Number of currently passing tests
 * @param {string} [htmlPath] - Absolute path to HTML file; when provided, uses @path reference instead of inline content
 * @returns {string}
 */
function buildTargetedFixPrompt(feedbackPrompt, failingContext, passingContext, currentHtml, specContent, currentlyPassing, htmlPath) {
  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;
  return `You are fixing an HTML game based on user feedback.

USER FEEDBACK:
${feedbackPrompt}
${failingContext}
${passingContext}

${htmlSection}

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

// ─── Step 1d: Smoke-regen surgical CDN init fix prompt ───────────────────────

/**
 * Builds a surgical fix prompt for smoke-regen (Step 1d).
 *
 * Instead of regenerating the entire game from scratch (full regen), this prompt
 * gives the LLM the FAILING HTML and asks it to fix ONLY the CDN init sequence
 * inside DOMContentLoaded. All game logic, UI, styling, and other code must be
 * preserved unchanged.
 *
 * @param {string} failingHtml - The current HTML content that failed the smoke check
 * @param {string} fatalError - The fatal error message from smokeResult.fatalErrors[0]
 * @param {object} specMeta - Spec metadata with at least { isCdnGame, partFlags }
 * @returns {string}
 */
function buildSmokeRegenFixPrompt(failingHtml, fatalError, specMeta, cdnUrlContext = '') {
  const needsFeedbackManagerInit = specMeta.partFlags?.['PART-017'] === 'YES';
  const needsTimerComponent = /\bTimerComponent\b/.test(failingHtml);
  const needsTransitionScreen = /\bTransitionScreenComponent\b/.test(failingHtml);
  const needsProgressBar = /\bProgressBarComponent\b/.test(failingHtml);
  const htmlForPrompt =
    failingHtml.length > 120000 ? failingHtml.slice(0, 120000) + '\n<!-- [truncated for token limit] -->' : failingHtml;

  const feedbackManagerStep = needsFeedbackManagerInit
    ? `    await FeedbackManager.init();  // PART-017=YES — MUST be called before ScreenLayout.inject()`
    : `    // FeedbackManager.init() — SKIP (PART-017=NO; calling it shows a blocking popup → 100% test failure)`;

  const cdnUrlSection = cdnUrlContext
    ? `\n⚠️ BROKEN CDN SCRIPT URLS (HIGH PRIORITY — fix these first):${cdnUrlContext}\n`
    : '';

  return `You are fixing a CDN game HTML file that fails to initialise due to a broken CDN init sequence.

FATAL ERROR detected during page load smoke check:
${fatalError}
${cdnUrlSection}
This error means the CDN init sequence inside DOMContentLoaded is broken. The page loads a blank screen because ScreenLayout.inject() never ran and #gameContent was never created in the DOM.

## CRITICAL CDN GAME INIT FIXES — #gameContent missing is ALWAYS caused by one of these three bugs

**BUG 1 — ScreenLayout.inject() missing the \`slots:\` wrapper key**
\`\`\`js
// WRONG — #gameContent is NEVER created without the slots: wrapper:
ScreenLayout.inject('app', { progressBar: true, transitionScreen: true })

// CORRECT — slots: wrapper is REQUIRED:
ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })
\`\`\`
Look in the failing HTML for any ScreenLayout.inject() call. If the argument object does NOT have a \`slots:\` key wrapping the component flags, this is the bug — add the \`slots:\` wrapper.

**BUG 2 — Missing or wrong CDN \`<script src>\` tags**
The game MUST have these exact \`<script>\` tags in \`<head>\` (or before the inline script), in this order:
\`\`\`html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
\`\`\`
If the spec requires FeedbackManager (PART-017=YES), also add:
\`\`\`html
<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
\`\`\`
The domain MUST be \`storage.googleapis.com/test-dynamic-assets\` — NEVER any other domain.

**KNOWN VALID CDN SCRIPT URLS** — use ONLY these exact URLs, no others:
- \`https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js\` ✅ (HTTP 200)
- \`https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js\` ✅ (HTTP 200)
- \`https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js\` ✅ (HTTP 200, only if PART-017=YES)

**THESE URLS ARE WRONG AND WILL 404/403 — DO NOT USE:**
- ❌ \`https://cdn.homeworkapp.ai/...\` — returns 403 for ALL paths
- ❌ \`https://cdn.mathai.ai/...\` — wrong domain for package scripts
- ❌ \`https://unpkg.com/@mathai/...\` — @mathai packages are NOT published to unpkg.com (404)
- ❌ \`https://cdn.homeworkapp.ai/cdn/components/web/...\` — wrong sub-path, returns 403
- ❌ Any \`/games/v1/\`, \`/games/v2/\`, \`/v1/\`, \`/v2/\` paths — only \`/packages/\` sub-path is valid

Without these tags, waitForPackages() polls until it throws "Packages failed to load within 180s".

**BUG 3 — initSentry() called BEFORE waitForPackages() resolves**
\`\`\`js
// WRONG — Sentry SDK is loaded by CDN; calling initSentry() before CDN loads crashes:
initSentry();
await waitForPackages();
ScreenLayout.inject(...)

// CORRECT — CDN must load first:
await waitForPackages();
initSentry();
ScreenLayout.inject(...)
\`\`\`
Check the DOMContentLoaded callback. If initSentry() appears before \`await waitForPackages()\`, move it after.

**BUG 4 — Canvas API with CSS variables (ONLY if error mentions "CanvasGradient" or "could not be parsed as a color")**
Canvas2D is a low-level graphics API that does NOT resolve CSS custom properties. If the fatal error is "The value provided ('var(--color-x)') could not be parsed as a color", the bug is in Canvas drawing code — NOT in the CDN init sequence.
\`\`\`js
// WRONG — Canvas API cannot resolve CSS variables:
ctx.addColorStop(0, 'var(--color-sky)')
ctx.fillStyle = 'var(--color-primary)'

// CORRECT — use literal color values:
ctx.addColorStop(0, '#87CEEB')
ctx.fillStyle = '#4A90E2'
\`\`\`
Search the failing HTML for ALL canvas gradient/fill/stroke calls and replace any \`var(--...)\` with the equivalent literal hex/rgba color value.

**BUG 5 — TimerComponent 'mathai-timer-slot' container not found (ONLY if error mentions "Container with id \\"mathai-timer-slot\\" not found")**
ScreenLayout.inject() only creates DOM slots for components listed in the slots config. If the fatal error is 'Container with id "mathai-timer-slot" not found', the TimerComponent is trying to render into a slot that was never created because timer: true is missing from ScreenLayout.inject slots.
\`\`\`js
// WRONG — timer slot never created:
ScreenLayout.inject('app', { slots: { progressBar: true } });
const timer = new TimerComponent('mathai-timer-slot', { ... });

// CORRECT — include timer: true in slots:
ScreenLayout.inject('app', { slots: { progressBar: true, timer: true } });
const timer = new TimerComponent('mathai-timer-slot', { ... });
\`\`\`
Find the ScreenLayout.inject() call in the HTML and add timer: true to the slots object. Do NOT change any other code.

**BUG 6 — ProgressBarComponent method does not exist (ONLY if error mentions "progressBar.init is not a function" OR "progressBar.start is not a function" OR "progressBar.reset is not a function" OR "progressBar.setLives is not a function" OR "progressBar.pause is not a function" OR "progressBar.resume is not a function")**
ProgressBarComponent has exactly 3 API points: constructor(slotId, config), .update(currentRound, totalRounds), and .destroy(). There is NO .init(), .start(), .reset(), .setLives(), .pause(), .resume(), or any other method. Calling any of these throws TypeError → blank page.
\`\`\`js
// WRONG — these methods do not exist:
progressBar.init();         // TypeError
progressBar.start();        // TypeError
progressBar.reset();        // TypeError
progressBar.setLives(3);    // TypeError
progressBar.pause();        // TypeError
progressBar.resume();       // TypeError

// CORRECT — constructor IS the init; use .update() to set initial display:
progressBar = new ProgressBarComponent('mathai-progress-bar-slot', config);
progressBar.update(0, totalRounds);  // set initial round display
\`\`\`
Find ALL calls to progressBar.init(), progressBar.start(), progressBar.reset(), progressBar.setLives(), progressBar.pause(), progressBar.resume() or any other undefined method and remove or replace them. The ONLY valid calls after construction are progressBar.update(currentRound, totalRounds) and progressBar.destroy().

## YOUR TASK — SURGICAL CDN INIT FIX ONLY

Fix ONLY the CDN init sequence inside the DOMContentLoaded async callback. Do NOT change anything else.

### EXACT required CDN init order inside DOMContentLoaded:
\`\`\`js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await waitForPackages();
${feedbackManagerStep}
    initSentry();  // ONLY if PART-030=YES — initSentry() is NOT a CDN function, you MUST define it yourself above DOMContentLoaded; skip entirely if PART-030=NO
    ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } });
    // 'slots' wrapper is MANDATORY — omitting it means #gameContent is never created → blank page
    // Add timer: true if the game uses new TimerComponent('mathai-timer-slot', ...)
    // e.g. { slots: { progressBar: true, timer: true, transitionScreen: true } }
    // Now #gameContent exists — clone game-template into it:
    const tpl = document.getElementById('game-template');
    if (tpl) document.getElementById('gameContent').appendChild(tpl.content.cloneNode(true));
    // THEN initialize other CDN components (TimerComponent, ProgressBarComponent, VisibilityTracker, etc.)
    // ... rest of init ...
  } catch (e) {
    console.error('Init error: ' + e.message);
    window.__initError = e.message;
  }
});
\`\`\`

### waitForPackages() requirements:
- MUST have a 180000ms (3 min) timeout that THROWS: \`if(elapsed>=180000){throw new Error('Packages failed to load within 180s')}\` — CDN cold-start in fresh Playwright test browsers takes 30-150s on GCP; 120s timeout races against CDN cold-start and loses; use 180000 always (Lesson 117, Lesson 143)
- typeof check MUST match what IS loaded: ${needsFeedbackManagerInit ? 'check FeedbackManager (PART-017=YES)' : 'check ScreenLayout (PART-017=NO — FeedbackManager is NOT loaded; checking it causes guaranteed 10s timeout + crash)'}${needsProgressBar ? '\n- This HTML uses ProgressBarComponent — you MUST also add "|| typeof ProgressBarComponent === \'undefined\'" to the while-loop condition. ProgressBarComponent loads at step 3 of the CDN chain, AFTER ScreenLayout (step 2); without this guard the game crashes with ReferenceError.' : ''}${needsTransitionScreen ? '\n- This HTML uses TransitionScreenComponent — you MUST also add "|| typeof TransitionScreenComponent === \'undefined\'" to the while-loop condition. TransitionScreenComponent loads at step 4 of the CDN chain, AFTER ProgressBarComponent; without this guard the game crashes with ReferenceError.' : ''}${needsTimerComponent ? '\n- This HTML uses TimerComponent — you MUST also add "|| typeof TimerComponent === \'undefined\'" to the while-loop condition. TimerComponent loads at step 7 of the CDN chain (last); without this guard the game crashes with ReferenceError before TimerComponent is ready.\n- CRITICAL TimerComponent constructor signature: new TimerComponent(\'container-id\', { options }) — FIRST argument MUST be the container element ID string (e.g. \'timer-container\'), NOT a config object and NOT a DOM element. new TimerComponent({ container: ..., timerType: ... }) is WRONG and causes \'Container with id [object Object] not found\' crash → blank page (Lesson 99).\n- TimerComponent MUST be initialized AFTER ScreenLayout.inject() + template clone. The #timer-container element lives inside <template id="game-template"> and is NOT in the live DOM until after document.getElementById(\'gameContent\').appendChild(tpl.content.cloneNode(true)). Initializing TimerComponent before the template clone causes \'Container with id ... not found\' even with the correct string ID.' : ''}
- CDN script URLs MUST use storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai or any other domain

### ABSOLUTE CONSTRAINTS — do NOT violate:
- Do NOT change any game logic, game state, scoring, UI, CSS, event handlers, or any code outside the CDN init sequence
- Do NOT move or reorder CDN <script> tags
- Do NOT remove or rename elements in <template id="game-template">
- Do NOT remove data-testid attributes
- Do NOT add new functionality — only fix the broken init sequence
- Preserve ALL existing code outside the DOMContentLoaded initialization block verbatim

Output the complete fixed HTML file wrapped in a \`\`\`html code block.

## FAILING HTML FILE:
\`\`\`html
${htmlForPrompt}
\`\`\``;
}

// ─── CSS stripping utility ────────────────────────────────────────────────────

/**
 * Strips CSS content from <style> blocks in HTML, replacing it with a short
 * placeholder. Keeps the <style> tags so the LLM knows CSS exists.
 *
 * Used before passing HTML to fix/review LLMs — CSS is irrelevant for JS logic
 * fixes and review checks, and can account for 30-50% of prompt tokens.
 *
 * Do NOT call this for:
 *   - Initial generation prompts (LLM needs CSS context)
 *   - DOM snapshot / smoke-regen steps
 *   - Test generation (tests don't receive HTML)
 *
 * @param {string} html - Full HTML content
 * @returns {string} HTML with CSS content replaced by placeholder
 */
function stripCssFromHtml(html) {
  return html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (match, open, css, close) => {
    return `${open}\n/* [CSS stripped — ${css.length} chars, not relevant to JS fix] */\n${close}`;
  });
}

/**
 * Extracts all <script> block content from an HTML string.
 * Returns the concatenated text content of all <script> tags (inline only, not src=).
 * @param {string} html
 * @returns {string}
 */
function extractScriptContent(html) {
  const lines = [];
  const re = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    // Skip external scripts (src attribute present without content)
    if (m[1].trim().length > 0) {
      lines.push(m[1]);
    }
  }
  return lines.join('\n');
}

/**
 * Generates a compact line-level diff of the <script> sections between two HTML strings.
 * Shows only changed lines with +/- prefix, plus up to 2 lines of context around each change.
 * Caps output at MAX_DIFF_LINES lines to avoid token explosion.
 *
 * Used by buildFixPrompt on iteration 2+ to show what changed from the previous fix attempt
 * rather than repeating the full HTML. Reduces iteration-2+ fix prompt size significantly.
 *
 * @param {string} prevHtml - HTML from the previous iteration
 * @param {string} currHtml - HTML from the current iteration
 * @param {number} [maxLines=100] - Maximum diff output lines
 * @returns {string} Compact unified-style diff, or empty string if no script content
 */
function buildScriptDiff(prevHtml, currHtml, maxLines) {
  const MAX_DIFF_LINES = maxLines || 100;
  const CONTEXT_LINES = 2;

  const prevScript = extractScriptContent(prevHtml || '');
  const currScript = extractScriptContent(currHtml || '');

  if (!prevScript && !currScript) return '';
  if (!prevScript) return '(no previous script content to diff)';
  if (!currScript) return '(no current script content to diff)';

  const prevLines = prevScript.split('\n');
  const currLines = currScript.split('\n');

  // Build a simple LCS-based line diff.
  // For large scripts, use a fast heuristic: chunk by equal prefix/suffix, diff the middle.
  // This avoids O(n^2) LCS on 1000+ line scripts.

  // Find common prefix
  let prefixLen = 0;
  const minLen = Math.min(prevLines.length, currLines.length);
  while (prefixLen < minLen && prevLines[prefixLen] === currLines[prefixLen]) prefixLen++;

  // Find common suffix (excluding prefix)
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    prevLines[prevLines.length - 1 - suffixLen] === currLines[currLines.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const prevMiddle = prevLines.slice(prefixLen, prevLines.length - suffixLen || undefined);
  const currMiddle = currLines.slice(prefixLen, currLines.length - suffixLen || undefined);

  // If middle is identical, scripts are the same
  if (prevMiddle.join('\n') === currMiddle.join('\n')) {
    return '(no script changes between iterations)';
  }

  // Build hunks: context + removed + added
  const diffLines = [];

  // Show context before change (up to CONTEXT_LINES)
  const contextStart = Math.max(0, prefixLen - CONTEXT_LINES);
  for (let i = contextStart; i < prefixLen; i++) {
    diffLines.push(` ${prevLines[i]}`);
  }

  // Show removed lines (from prev)
  for (const line of prevMiddle) {
    diffLines.push(`-${line}`);
  }

  // Show added lines (from curr)
  for (const line of currMiddle) {
    diffLines.push(`+${line}`);
  }

  // Show context after change (up to CONTEXT_LINES)
  const suffixStart = prevLines.length - suffixLen;
  const contextEnd = Math.min(prevLines.length, suffixStart + CONTEXT_LINES);
  for (let i = suffixStart; i < contextEnd; i++) {
    diffLines.push(` ${prevLines[i]}`);
  }

  // Cap at MAX_DIFF_LINES
  if (diffLines.length > MAX_DIFF_LINES) {
    const truncated = diffLines.slice(0, MAX_DIFF_LINES);
    truncated.push(`... (diff truncated at ${MAX_DIFF_LINES} lines — ${diffLines.length - MAX_DIFF_LINES} more lines not shown)`);
    return truncated.join('\n');
  }

  return diffLines.join('\n');
}

module.exports = {
  REVIEW_SHARED_GUIDANCE,
  CDN_CONSTRAINTS_BLOCK,
  stripCssFromHtml,
  buildScriptDiff,
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
  extractUserScenarios,
  buildSmokeRegenFixPrompt,
};
