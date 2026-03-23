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
- GEN RULE-003 TRANSITION: ALL \`await transitionScreen.hide()\` and \`await transitionScreen.show(...)\` calls MUST be wrapped in try/catch. WRONG: \`await transitionScreen.hide()\` / RIGHT: \`try { await transitionScreen.hide(); } catch(e) { console.error('transitionScreen.hide failed', e); }\`

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
- ALL \`transitionScreen.show({...})\` calls MUST use \`await\`. Unawaited calls corrupt CDN component state — subsequent show() calls hang with button visibility:hidden (Lesson 101, keep-track #465). CONFIRMED: adjustment-strategy build #381 had 3/3 transitionScreen.show() calls unawaited → ALL mechanics tests timed out at 15000ms with "waiting for #mathai-transition-slot button" — button was rendered but stayed visibility:hidden due to CDN state machine corruption. Root cause confirmed 2026-03-23 (TE: ebd5ad8). WRONG: transitionScreen.show({...}); RIGHT: await transitionScreen.show({...});
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
- GEN-PROGRESSBAR-DESTROY: NEVER use setTimeout to destroy ProgressBarComponent. CDN components have no benefit to being destroyed after endGame(). The CORRECT pattern is to leave progressBar alive and call progressBar.update() to reset its visual state. If destroy is called and progressBar is set to null inside a setTimeout, any subsequent restartGame() that calls progressBar.update() will crash with TypeError: Cannot read properties of null (reading 'update') — P0: game cannot be restarted. RULE 1 — Never destroy in endGame(): WRONG: setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000); RIGHT: progressBar.update(1, gameState.totalLives); // visually reset — leave component alive. RULE 2 — If destroy is unavoidable: guard EVERY subsequent call site: if (!progressBar) { progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', ... }); } progressBar.update(...); (right-triangle-area #543 browser audit P0 UI-RTA-B-001)
- TimerComponent IS available in the CDN bundle, BUT it loads AFTER ScreenLayout/FeedbackManager. If you use it, you MUST add "|| typeof TimerComponent === 'undefined'" to the waitForPackages() while-loop condition — otherwise you get ReferenceError at runtime. Safer alternative: use a plain setInterval/setTimeout for countdown/elapsed timers, which has zero CDN dependency risk. CONSTRUCTOR SIGNATURE: new TimerComponent('container-id', { timerType: 'increase', startTime: 0, endTime: 3600, autoStart: false, format: 'min' }) — first argument MUST be the container element ID string, NOT a DOM element and NOT an options object. Passing an object as first arg causes 'Container with id [object Object] not found' crash (Lesson 98). CRITICAL — NO HEADLESS/NULL TIMER: new TimerComponent(null, {...}) THROWS "Container with id 'null' not found" — null is NEVER a valid containerId. TimerComponent ALWAYS requires a real <div> to render into: (1) Add <div id="timer-container"></div> inside <template id="game-template">, (2) Use new TimerComponent('timer-container', {...}). If you need a background-only countdown with NO visible timer UI, use plain setInterval/clearInterval instead — no CDN dependency, no DOM required. DO NOT pass null or undefined as the first argument (T1 §5f4 rejects this — right-triangle-area #538/#540 root cause).
- ProgressBarComponent DOES NOT EXPOSE a .timer PROPERTY: Never do progressBar.timer — it is always undefined → timer.start() throws → blank page (T1 §5f7). ProgressBarComponent tracks lives/round display ONLY. For a countdown timer, ALWAYS create TimerComponent separately: const timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: N, endTime: 0, onEnd: handleTimeout }); timer.start(); (right-triangle-area #541 root cause)
- ProgressBarComponent API IS EXACTLY: constructor(slotId, config) + .update(currentRound, livesRemaining) + .destroy(). NO OTHER METHODS EXIST. There is NO .init(), .start(), .reset(), .setLives(), .pause(), .resume(), or any other method. Calling any undefined method throws TypeError → blank page. The constructor IS the init — do NOT call progressBar.init() (T1 §5f9, right-triangle-area #543 root cause).
- TIMERTIMER SLOT IN SCREENLAYOUT: If you use new TimerComponent('mathai-timer-slot', ...), you MUST include timer: true in ScreenLayout.inject slots: ScreenLayout.inject('app', { slots: { progressBar: true, timer: true } }). Without timer: true, the 'mathai-timer-slot' div is NEVER created → TimerComponent throws 'Container with id "mathai-timer-slot" not found' → blank page (T1 §5f8, right-triangle-area #542 root cause). NOTE: If you use ProgressBarComponent with showTimer: true, do NOT also create a separate new TimerComponent('mathai-timer-slot', ...) — the timer is managed inside ProgressBarComponent internally.
- CANVAS API DOES NOT RESOLVE CSS VARIABLES: Never pass var(--color-x) or any CSS custom property to Canvas API calls. ctx.addColorStop(offset, 'var(--color-sky)') → DOMException: "could not be parsed as a color" → blank page (T1 §5f6). Use literal color values in ALL canvas calls: '#87CEEB', 'rgba(135,206,235,1)', 'skyblue'. (right-triangle-area #540 root cause)
- NEVER define a custom updateLivesDisplay() — ProgressBarComponent handles lives via progressBar.update()
- endGame() MUST be declared async if it contains await calls
- endGame, restartGame, and nextRound MUST be exposed on window; window.gameState MUST be on window — syncDOMState() reads window.gameState; if absent data-phase is NEVER set and ALL waitForPhase() calls timeout
- GEN-119: fallbackContent closing brace MUST be on its own line — NEVER squash closing } or ] inline at the end of the rounds array:
  WRONG:
    const fallbackContent = {
      rounds: [{...}]};      ← closing } squashed inline → SyntaxError → DOMContentLoaded never fires → smoke check fails (which-ratio #558)
  RIGHT:
    const fallbackContent = {
      rounds: [
        {...},
      ],
    };                       ← closing } on own line
- window.gameState.content MUST be pre-populated with the fallback/default round data before waiting for game_init. The DOM snapshot tool reads window.gameState.content synchronously — if it is only set on game_init message, the snapshot captures null and test gen gets corrupted fallback data. Pattern: define fallbackContent with real rounds above DOMContentLoaded, then set window.gameState.content = fallbackContent at the START of DOMContentLoaded (before await waitForPackages()), then override with real content when game_init arrives.
- waitForPackages() MUST have a 180000ms (3 min) timeout that THROWS: if(elapsed>=timeout){throw new Error('Packages failed to load within 180s')} — CDN cold-start in fresh Playwright test browsers takes 30-150s on GCP; 120s timeout races against CDN cold-start and loses; use 180000 always (Lesson 117, Lesson 143)
- DOMContentLoaded catch block MUST set window.__initError = e.message to surface init errors to the test harness. This makes CDN package load failures visible instead of silent: window.addEventListener('DOMContentLoaded', async () => { try { ... } catch(e) { console.error('Init error: ' + e.message); window.__initError = e.message; } });
- waitForPackages() typeof check MUST match what IS loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout. NEVER check typeof FeedbackManager when PART-017=NO — it is never loaded and causes guaranteed 120s timeout + crash (gameState stays empty, all tests fail)
- SCREENLAYOUT GUARD: immediately after ScreenLayout.inject(), add: if (!document.getElementById('gameContent')) { throw new Error('ScreenLayout.inject() did not create #gameContent — check slots: wrapper'); } — this converts silent inject failures into visible errors caught by window.__initError
- TransitionScreen MUST be used for victory/game-over/level transitions if the spec defines it
- ANTI-PATTERN: NEVER create a separate handleGameOver() function that bypasses endGame(). ALL game-ending paths (lives exhausted, time up, all rounds complete) MUST call endGame(reason). The single endGame() function handles TransitionScreen.show() for both 'victory' and 'game_over'. A separate handleGameOver() that directly shows results without calling endGame() causes: (1) TransitionScreen not shown for game-over, (2) duplicate postMessage cleanup code, (3) review rejection. WRONG: function handleGameOver() { showResults(); postMessage(); } RIGHT: call endGame('game_over') from any game-over trigger.
- Preserve ALL existing data-testid attributes — never remove them
- GEN-TESTID-MATCH: EVERY element with a data-testid attribute MUST have EXACTLY the same value as its id attribute. Divergence between testid and id causes selector inconsistency — some tests use getByTestId(), others use #id, and they may resolve to different elements. WRONG: <div id="results-screen" data-testid="results"> — RIGHT: <div id="results-screen" data-testid="results-screen">. Conventions: game container = id="app" data-testid="app", results screen = id="results-screen" data-testid="results-screen", feedback area = id="feedback-area" data-testid="feedback-area". Apply to ALL elements that have both id and data-testid. (word-pairs audit #529)
- GEN-MOBILE-RESULTS: results/game-over/completion screens MUST use position:fixed; top:0; left:0; width:100%; height:100%; z-index≥100 — static-positioned end screens scroll off-screen on 480×800 mobile viewport and are invisible to Playwright tests
- GEN-RESULTS-FIXED: The results screen element MUST use position:fixed; top:0; left:0; width:100%; height:100%; z-index:100 (or higher) in its CSS declaration. NEVER use position:static or position:relative for the results screen. This applies to #results-screen, #game-over-screen, #end-screen, #completion-screen, and any full-screen end-state overlay. WRONG: #results-screen { display: none; } (static position — stacks in DOM flow, clipped below 800px on mobile). RIGHT: #results-screen { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: #fff; } (6 confirmed instances: quadratic-formula, soh-cah-toa, right-triangle-area, word-pairs, name-the-sides, find-triangle-side)
- GEN-TOUCH-TARGET / GEN-UX-002: ALL interactive buttons MUST have min-height:44px; min-width:44px — this applies to every button class (.game-btn, .choice-btn, .adj-btn, .reset-btn, .option-btn, .btn-restart, .btn-play-again, .btn-try-again, .restart-btn, .play-again-btn, and any other clickable element) AND every button inside #results-screen, #game-over-screen, .mathai-transition-screen. CSS class name does NOT exempt a button from the touch target requirement. Any element with onclick, cursor:pointer, or role="button" MUST have min-height:44px. BANNED: .choice-btn{padding:14px 8px} with NO min-height (associations pattern — padding-only collapses below 44px); .adj-btn{height:36px} (adjustment-strategy — fixed height below 44px); any button with height below 44px. RIGHT: always add min-height:44px explicitly alongside any padding. Confirmed: real-world-problem #564 results screen Play Again button measured 41px (below 44px min) — unreachable on small touch targets. Undersized touch targets cause missed taps on mobile and 0% mechanics test pass rates
- GEN ARIA-001 (WCAG SC 4.1.3): ALL dynamic feedback elements MUST have aria-live="polite" AND role="status". This applies to ANY element whose text content changes in response to user interaction: answer feedback panels, correct/incorrect indicators, score updates, hint text, phase announcements, worked-example feedback. The rule applies regardless of element id or class name — if it updates dynamically, it needs aria-live="polite". ARIA-001 INLINE PANELS — the following selectors MUST have aria-live="polite" role="status" with no exceptions: #feedback-panel, #faded-feedback, #practice-feedback, #feedback-area, #feedback-message, #answer-feedback, #result-feedback, #feedback, .feedback-message, #correct-feedback, #incorrect-feedback, #skip-note, #hint-text, and ANY div whose id or class contains the substring 'feedback'. WRONG: <div id="feedback-panel">. RIGHT: <div id="feedback-panel" aria-live="polite" role="status">. (Note: aria-live="assertive" is ONLY correct for a div with \`role="alert"\` OR id or class containing "error" — NEVER use assertive for correct/incorrect answer feedback. Any other use of assertive is a bug. 9+ confirmed missing instances: name-the-sides, count-and-tap, find-triangle-side, quadratic-formula, soh-cah-toa, right-triangle-area, word-pairs, real-world-problem, addition-mcq-lives)
- GEN-SLOT-A11Y: Interactive slot/grid divs MUST have role="button", tabindex="0", and a descriptive aria-label. For any game where non-button div elements are the primary interactive targets (position slots, grid cells, card slots, answer slots, drag targets): WRONG: <div class="slot-cell" onclick="selectSlot(this)"> (no role, no aria-label, tabIndex=-1 — invisible to screen readers and keyboard). RIGHT: <div class="slot-cell" role="button" tabindex="0" aria-label="hundreds position" onclick="selectSlot(this)">. WHY: clickable divs without role="button" are invisible to screen readers and unreachable by keyboard — any spatial/positional game where slot position has semantic meaning (e.g. hundreds/tens/ones, row/col coordinates) MUST label that position in aria-label. Rule: any div with onclick (or addEventListener click) that represents an interactive game element must have role="button", tabindex="0", and a descriptive aria-label. (Source: position-maximizer #507 UI/UX audit — all slot cells had role=null, aria-label=null, tabIndex=-1)
- GEN-CARD-A11Y: Memory/flip game cards must have ARIA role + label + tabindex. For games where cards or tiles are the primary interactive targets (memory-flip, match-the-cards, pairs): WRONG: <div class="card" onclick="flipCard(this)"> (no role, no aria-label, tabIndex=-1). RIGHT: <div class="card" role="button" tabindex="0" aria-label="card 3, face down" onclick="flipCard(this)">. On flip: update aria-label to describe revealed content: aria-label="card 3: lion (revealed)". On match: aria-label="card 3: lion (matched)". WHY: Card games are entirely pointer-driven without role="button" + keyboard support. Screen readers cannot announce card state (face-down, revealed, matched). (Source: memory-flip #505 — all 12 cards had role=null, tabIndex=-1, aria-label=null)
- gameState.phase MUST be set at every state transition: 'playing', 'transition', 'gameover', 'results'. Call syncDOMState() immediately after every gameState.phase assignment. IMPORTANT: 'gameover' (no underscore) is the canonical gameState.phase value — NEVER set gameState.phase = 'game_over' (underscore). The underscore form 'game_over' is ONLY used as the reason argument to endGame('game_over') and as the outcome argument to calcStars('game_over'). These are different things: endGame reason vs gameState.phase are separate strings.
- endGame() GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- GEN-ENDGAME-GUARD: endGame() MUST use ONLY gameState.gameEnded as its re-entry guard — NEVER use !gameState.isActive as a guard condition in endGame(). The isActive flag is set to false in the correct-answer handler (before the nextRound() timeout fires); if endGame() also checks !isActive, it exits early on a perfect playthrough and the results screen is never shown (visual-memory #528 P0). For double-click protection in answer handlers, use a separate isProcessing flag in the handler — NOT in endGame().
  WRONG: function endGame(isVictory) { if (gameState.gameEnded || !gameState.isActive) return; /* results screen never shown on perfect playthrough */ }
  RIGHT: function endGame(isVictory) { if (gameState.gameEnded) return; gameState.gameEnded = true; /* ... show results ... */ }
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
- TransitionScreen ROUTING: every transitionScreen.show() buttons[].action callback MUST (1) call transitionScreen.hide() first, then (2) explicitly show #gameContent, then (3) set gameState.phase, then (4) call nextRound(). The CDN TransitionScreenComponent does NOT auto-hide when its button fires AND does NOT auto-show #gameContent — caller MUST do BOTH. WRONG: action: () => { gameState.phase = 'playing'; syncDOMState(); nextRound(); } RIGHT: action: async () => { await transitionScreen.hide(); document.getElementById('gameContent').style.display = 'block'; /* REQUIRED — transitionScreen.hide() does NOT auto-show #gameContent (GEN-118) */ gameState.phase = 'playing'; syncDOMState(); nextRound(); } (GEN-117, GEN-118)
- TransitionScreen AWAIT: ALL transitionScreen.show() calls MUST use await — write: await transitionScreen.show({...}). Without await, the function completes before the transition animation finishes, causing race conditions where the next-round setup runs before the slot is visible. WRONG: transitionScreen.show({...}); RIGHT: await transitionScreen.show({...}); CONFIRMED: adjustment-strategy build #381 had 3/3 transitionScreen.show() calls unawaited → ALL mechanics tests timed out at 15000ms ("waiting for #mathai-transition-slot button") — button rendered but stayed visibility:hidden due to CDN state machine corruption. This is the SECOND most catastrophic gen failure after wrong waitForPackages timeout. (diagnosis 2026-03-23, TE: ebd5ad8)
- RULE-003 TRANSITION: ALL \`await transitionScreen.hide()\` and \`await transitionScreen.show(...)\` calls MUST be wrapped in try/catch. WRONG: \`await transitionScreen.hide()\` / RIGHT: \`try { await transitionScreen.hide(); } catch(e) { console.error('transitionScreen.hide failed', e); }\`
- TransitionScreen BUTTONS API: transitionScreen.show() MUST use the "buttons: [{ text, type, action }]" array format. NEVER use "hasButton", "buttonText", or "onComplete" — these do not exist in the TransitionScreenComponent API and produce an empty #transitionButtons div (no button rendered, all tests timeout). WRONG: transitionScreen.show({ hasButton: true, buttonText: 'Start', onComplete: fn }); RIGHT: transitionScreen.show({ buttons: [{ text: 'Start', type: 'primary', action: () => startGame() }] }); (Lesson 118, disappearing-numbers #475)
- GEN-SENTRY-VERSION: IF spec uses PART-030/Sentry, the <head> MUST load Sentry SDK v10.23.0 as THREE scripts in this EXACT order (NEVER v7 single-bundle):
  RIGHT:
    <script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
    <script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
    <script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>
  WRONG (banned — v7 single-bundle):
    <script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>
  WRONG (banned — any @sentry/browser or sentry-7 variant):
    <script src="https://unpkg.com/@sentry/browser@7..."></script>
  The captureconsole and browserprofiling scripts MUST follow the main bundle — order is non-negotiable.
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
  ✗ NEVER: signalCollector.reset()                      — DOES NOT EXIST in CDN API, throws TypeError; use re-instantiation instead (see GEN-SIGNAL-RESET)
- GEN-SIGNAL-RESET: restartGame() MUST re-instantiate SignalCollector BEFORE calling showStartScreen() — endGame() seals the collector; re-instantiation is the ONLY safe reset. DO NOT call signalCollector.reset() — it does not exist in the CDN API and throws TypeError.
  WRONG: function restartGame() { gameState.currentRound = 0; showStartScreen(); }         // collector still sealed
  WRONG: function restartGame() { signalCollector.reset(); /* ... */ showStartScreen(); }  // reset() does not exist — TypeError
  RIGHT: function restartGame() {
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null
    });
    gameState.currentRound = 0; /* ... */ showStartScreen();
  }
  WHY: endGame() calls signalCollector.seal() to finalize the payload. A sealed collector silently ignores all subsequent recordViewEvent()/startProblem() calls, so all analytics in session 2+ are silently lost. signalCollector.reset() does NOT exist in the CDN API and throws TypeError.
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
  Correct waitForPackages() check: typeof ScreenLayout === 'undefined' (or typeof window.ScreenLayout === 'undefined')
- GEN FIX-001 (PRESERVE CSS): NEVER remove, replace, or empty the <style> block when making a targeted fix. If your fix only touches JavaScript, the <style> block must remain EXACTLY as it was. A <style> block containing only comments is ALWAYS a bug. WRONG: replacing <style> with /* CSS preserved */. RIGHT: leave <style>...</style> unchanged. Stripping CSS causes blank/unstyled pages — T1 check PART-028-CSS-STRIPPED will REJECT any HTML where the <style> block contains only comments. (Root cause: build #560 targeted fix stripped entire stylesheet)
- GEN-UX-003 (PROGRESSBAR SLOT ID): ProgressBarComponent MUST be initialized with the exact options object { slotId: 'mathai-progress-slot' }. NEVER use '#mathai-progress-slot' (hash prefix), 'mathai-progress-bar' (wrong name), any '-bar-' infix variant, or a positional string as the first argument. WRONG: new ProgressBarComponent('#mathai-progress-slot', {...}); new ProgressBarComponent('mathai-progress-bar-slot', {...}). RIGHT: new ProgressBarComponent({ slotId: 'mathai-progress-slot', autoInject: true, totalRounds: N, totalLives: N }); (4 confirmed instances — find-triangle-side #549, quadratic-formula #546, right-triangle-area #543, real-world-problem #564)
- GEN-UX-004 (NO alert/confirm): NEVER call alert(), confirm(), or prompt() anywhere in game code. These block the main thread and break iframe embedding. For input validation errors or user messages, update the textContent of an existing inline aria-live feedback div and use CSS to show/hide it. WRONG: alert('Please enter a number'); RIGHT: feedbackEl.textContent = 'Please enter a number'; feedbackEl.classList.remove('hidden');
- GEN-UX-005 (SIGNALCOLLECTOR CONSTRUCTOR ARGS): SignalCollector MUST always be instantiated with required constructor arguments. NEVER call new SignalCollector() with no arguments. RIGHT: signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(), studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null }); (2 confirmed instances — find-triangle-side #549, real-world-problem #564)
- GEN-MCQ-PHASE / GEN-PHASE-MCQ-FULL (ALL GAMES — MANDATORY data-phase state machine — ALL 4 syncDOMState() call sites REQUIRED): EVERY Ralph pipeline game MUST declare data-phase transitions. This is NOT optional for any game type — drag-and-drop, canvas, worked-example, text-input, and MCQ games all require it. Each function that changes game phase MUST set gameState.phase AND call syncDOMState() immediately after — in this exact order. ALL 4 REQUIRED CALL SITES:
  (1) showStartScreen()  → gameState.phase = 'start';    syncDOMState();  // before transitionScreen.show() — WRONG: omit syncDOMState → waitForPhase('start') times out
  (2) startGame()/renderRound() → gameState.phase = 'playing'; syncDOMState(); // before rendering options — WRONG: renderOptions() before syncDOMState → data-phase still 'start'
  (3) endGame() lives=0  → gameState.phase = 'gameover'; syncDOMState();  // BEFORE TransitionScreen.show() — WRONG: show TransitionScreen first → waitForPhase('gameover') races
  (4) endGame() lives>0  → gameState.phase = 'results';  syncDOMState();  // BEFORE TransitionScreen.show() or showResults() — WRONG: missing → waitForPhase('results') times out
  WRONG: gameState.phase = 'playing'; renderOptions(); (syncDOMState() missing or deferred after any of the 4 call sites)
  RIGHT: gameState.phase = 'playing'; syncDOMState(); renderOptions();
  WHY: syncDOMState() writes gameState.phase to #app[data-phase]. waitForPhase() in tests polls data-phase — if syncDOMState() is not called immediately after the assignment, waitForPhase() times out and 100% of game-flow tests fail. Missing even ONE of the 4 call sites causes all tests dependent on that phase to fail. (Root cause: 22% game-flow failures across ALL game types including drag-and-drop math-cross-grid F4 — first confirmed non-MCQ instance)
- GEN-MCQ-TIMER (MCQ/TIMED GAMES — timer.start() placement): timer.start() MUST be called ONLY inside renderRound() — NEVER inside setupGame() or startGame(). Calling timer.start() in setupGame() and then timer.reset() in renderRound() creates a race condition: the timer fires its onEnd callback before the first round is rendered, triggering endGame() on an empty gameState. WRONG: function setupGame() { timer = new TimerComponent(...); timer.start(); } RIGHT: function setupGame() { timer = new TimerComponent(...); } function renderRound() { timer.reset(); timer.start(); /* start ONLY here */ } (Source: addition-mcq-blitz spec audit)
- GEN-WINDOW-EXPOSE (rule 36 — ALL GAMES): window.endGame, window.restartGame, window.nextRound, and window.gameState MUST be assigned in DOMContentLoaded after all function definitions. Pattern: window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound; window.gameState = gameState; Also add window.loadRound = function(n) { ... } for test harness __ralph.jumpToRound(). If any assignment is missing, test harness calls to window.endGame() silently fail → 100% game-over test failures.
- GEN-INPUT-001 (TEXT INPUT ENTER KEY): Any game with a text input field for answer submission MUST include a keydown event listener that triggers answer submission when Enter is pressed. WRONG: only a submit button with no keyboard handler. RIGHT: answerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }); This applies to ALL text input games — mathematical answer entry, fill-in-the-blank, word entry. (2 confirmed instances: real-world-problem spec, adjustment-strategy build #385)
- GEN-PM-001 (GAME_COMPLETE POSTMESSAGE — MANDATORY): endGame() MUST call window.parent.postMessage() on BOTH the victory path AND the game-over path. WRONG: postMessage only on win, not on game-over. WRONG: type: 'completed' (wrong field name). RIGHT: window.parent.postMessage({ type: 'game_complete', data: { metrics: { score: gameState.score, stars: calcStars(outcome), ... }, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*'); The postMessage MUST use exactly type: 'game_complete' (not 'complete', not 'completed', not 'game-complete'). It MUST fire on the game-over path (lives=0, stars=0) AND the victory path (all rounds complete, stars>0). Missing this call on EITHER path causes ALL contract tests to fail. (46 confirmed test failures — top failure pattern in DB across all recent builds)
- GEN-STEP-001 (STEP-BASED GAME ROUND RESET): In any game with sequential step panels (step1→step2→step3 or equivalent), the round reset function MUST explicitly set ALL step panels to hidden=true / display=none BEFORE setting step1 as active. Never rely on previous round's DOM state. Sequence at round start: (1) hide all step panels, (2) set gameState.step = 'step1', (3) call syncDOMState(), (4) show step1 panel only.
- GEN-CANVAS-001 (CANVAS RESPONSIVE SIZING — MANDATORY): Canvas elements MUST include \`style="max-width: 100%; height: auto;"\` or equivalent CSS. Do NOT hardcode \`width="500"\` or any fixed pixel width on canvas elements — this causes horizontal overflow on 375-480px mobile screens. WRONG: <canvas id="game-canvas" width="500" height="400"></canvas>. RIGHT: <canvas id="game-canvas" width="500" height="400" style="max-width: 100%; height: auto; display: block;"></canvas>. The width/height HTML attributes set the internal drawing resolution (keep them) — add the CSS style to make the canvas scale down on small screens. (Source: UI/UX audit right-triangle-area #543)
- GEN-CSS-TOKENS (FEEDBACK COLOR CSS VARIABLES — MANDATORY): Feedback colors MUST use ONLY these CSS custom properties: \`--mathai-success\` (correct answer), \`--mathai-error\` (incorrect answer), \`--mathai-warning\` (neutral/warning). NEVER use: \`--color-orange\`, \`--mathai-green\`, \`--color-red\`, \`--color-green\`, \`--color-success\`, \`--feedback-color\`, \`--answer-color\`, \`--status-green\`, or any ad-hoc custom property for feedback colors. Do NOT invent new \`--my-color\` tokens for feedback. ONLY use \`--mathai-success\`, \`--mathai-error\`, \`--mathai-warning\`. Using undefined token names produces invisible or wrong-color feedback text — the browser silently falls back to the element's inherited color. WRONG: color: var(--mathai-green); WRONG: color: var(--color-red); WRONG: color: var(--color-green); WRONG: color: var(--color-success); WRONG: color: var(--status-green); RIGHT: color: var(--mathai-success); / color: var(--mathai-error);. (Source: UI/UX audit right-triangle-area #543; expanded CR-024)
- GEN-HIDE-SHOW (hide()/show() helpers MUST receive DOM elements, NOT strings): When hide() and show() shorthand helpers are defined as element-expected (e.g. \`const hide = el => el.style.display = 'none'\` or \`const hide = el => el.classList.add('hidden')\`), they MUST ALWAYS receive a DOM element object obtained from document.getElementById(), NEVER a CSS selector string. Passing a string causes a silent TypeError — \`'.results-screen'.style\` is undefined — which swallows the error and leaves the element visible or hidden in the wrong state. WRONG: hide('.results-screen'); WRONG: show('#game-content'); RIGHT: hide(document.getElementById('results-screen')); RIGHT: show(document.getElementById('game-content')); (Safest alternative: use \`document.getElementById('results-screen').classList.add('hidden')\` directly — this bypasses the helper entirely and avoids the string-vs-element mistake.) NOTE: soh-cah-toa #544 citation RETRACTED — that game's hide() uses \`querySelector(selector)\` (accepts strings correctly); no TypeError occurred. This rule applies to any game defining \`hide = el => el.classList.add(...)\` or \`hide = el => el.style.display = 'none'\` (element-expected helpers). (Source: CR-017; CR-026)
- GEN-RESTART-RESET (RESTART MUST RESET ALL MUTABLE GAMESTATE FIELDS): restartGame() MUST reset ALL mutable gameState fields to initial values before calling showStartScreen(). PRINCIPLE: For ANY field initialized in DOMContentLoaded / setupGame() / startGame(), reset it in restartGame() — not just the standard fields. THIS INCLUDES ALL CUSTOM GAME-SPECIFIC FIELDS (e.g. selectedCards, currentWord, streak, timeLeft, selectedPairs, matchedCount, boardState). WRONG (only resets standard fields, custom fields from previous game persist into session 2): function restartGame() { gameState.gameEnded = false; gameState.phase = 'start'; syncDOMState(); showStartScreen(); } RIGHT (resets ALL fields including custom ones): function restartGame() { gameState.currentRound = 0; gameState.lives = gameState.totalLives; gameState.score = 0; gameState.events = []; gameState.attempts = []; gameState.gameEnded = false; gameState.phase = 'start'; /* ALSO reset every custom field this game added: */ gameState.selectedPairs = []; gameState.currentWord = null; /* adapt to this game's DOMContentLoaded init */ syncDOMState(); signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(), studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null }); window.signalCollector = signalCollector; showStartScreen(); } WHY: 3 confirmed browser instances — quadratic-formula #546, find-triangle-side #549, associations #472. Standard fields caught by T1 check W13. Custom fields are NOT caught by static validation — they surface as second-playthrough bugs in browser. RULE: every gameState field initialized in DOMContentLoaded MUST appear in restartGame(). (CR-032; CR-014)
  SUB-RULE (UI-WP-B-002 — SYNCDOMESTATE PLACEMENT): syncDOMState() MUST be called AFTER resetting ALL gameState fields (currentRound, score, lives, phase, gameEnded, and all custom fields), not just after gameState.phase. syncDOMState() writes data-round, data-score, data-lives, and data-phase to #app — if called before score/round/lives are reset, or omitted entirely, those DOM attributes remain stale from the previous game session. Stale attributes persist during the TransitionScreen phase (visual reset is correct but DOM is not). Tests that read data-round or data-score during TransitionScreen or at the start of the new game before syncDOMState fires will get false results. Confirmed: word-pairs #529 — after Play Again, #app[data-round]="3" and #app[data-score]="11" were stale during TransitionScreen. The correct pattern (shown in RIGHT above) places syncDOMState() as the LAST step before showStartScreen(), after ALL field resets — this guarantees all DOM attributes reflect the reset state before any UI component renders.
- GEN-PHASE-ALL (data-phase / syncDOMState REQUIRED FOR ALL GAME TYPES, NOT JUST MCQ): ALL games with 2 or more named phases (start_screen → playing → results, or gameplay → results, etc.) MUST call syncDOMState() at each phase transition, regardless of game type. This applies to MCQ, drag-and-drop, card-matching, puzzle, canvas, multi-step interaction, text-input, worked-example, shell/cup games — ANY game type. WRONG (card-matching): function showResults() { document.getElementById('results-screen').style.display = 'block'; } RIGHT (card-matching): function showResults() { gameState.phase = 'results'; syncDOMState(); document.getElementById('results-screen').style.display = 'block'; } WHY: The test harness waitForPhase() reads data-phase for flow assertions on ALL game types — missing syncDOMState() causes timeout regardless of game type. (math-cross-grid spec F4, 1 confirmed non-MCQ instance)
- GEN-PHASE-INIT: The #app element's initial data-phase attribute in HTML MUST match the initial value that syncDOMState() would write. If gameState.phase initializes to 'start_screen', the HTML must have data-phase="start_screen" (not "start"). Mismatched initial values cause test fragility: cold-load tests see one value, post-restart tests see another. WRONG: <div id="app" data-phase="start">  with  gameState.phase = 'start_screen'. CORRECT: <div id="app" data-phase="start_screen">  with  gameState.phase = 'start_screen'. (crazy-maze UI-CM-003 #481)
- GEN-TIMER-ONLY (timer.start() MUST ONLY APPEAR IN renderRound(), NEVER IN setupGame()): For timer-based games, \`timer.start()\` MUST ONLY be called inside \`renderRound()\` (or \`loadQuestion()\`). NEVER call \`timer.start()\` in \`setupGame()\` or \`startGame()\`. Pattern: setupGame() → renderRound() → timer.start(). Calling timer.start() in setupGame() BEFORE renderRound() creates a race condition: if timer fires onEnd before renderRound() runs, handleTimeout() executes with currentQuestion===null, crashing the game. WRONG: function setupGame() { timer.start(); renderRound(); } /* timer fires before currentQuestion is set */ RIGHT: function renderRound() { currentQuestion = questions[gameState.currentRound]; /* data ready first */ timer.start(); } WHY: timer.start() must only be called AFTER renderRound() sets currentQuestion — placing it before renderRound() in setupGame() means handleTimeout(null) can crash immediately. (addition-mcq-blitz spec audit, 1 confirmed instance; CR-016)
- GEN-TRANSITION-API (GEN-TS-ONEARG): transitionScreen.show() MUST always be called with ONE argument — the config object. NEVER pass a string as the first argument. There is NO string-mode shorthand in the CDN API.
  WRONG: transitionScreen.show('start', { title: 'Ready?', icons: [], buttons: [...] });   ← TWO args: string + config — CDN receives config='start', all fields undefined
  WRONG: transitionScreen.show('victory', { score: 10, onRestart: restartGame });           ← same two-arg pattern — ALL screens blank
  WRONG: transitionScreen.show('gameover', { ... });                                        ← same
  WRONG: transitionScreen.show('start', config);                                            ← variable form — still two args, still broken
  RIGHT: transitionScreen.show({ icons: ['🎉'], title: 'Well Done!', subtitle: 'You completed all rounds', buttons: [{ text: 'Play Again', type: 'primary', action: restartGame }] });
  WHY: The CDN TransitionScreenComponent.show(config) takes ONE argument. Passing a string as first argument means config='start' (a string) — destructuring {title, buttons, icons} from a string gives all undefined. Blank white screen, no buttons, user stranded. CRITICAL: if every show() call uses the two-arg pattern (start, between-round, victory, game-over, restart), the ENTIRE game is unplayable from load. (which-ratio #561 BROWSER-P0-001 — victory only; keep-track #503 P0-A — ALL screens broken)
- GEN-TRANSITION-ICONS: The icons array in transitionScreen.show() MUST contain plain emoji strings or be an empty array. NEVER pass SVG markup, HTML strings, or local file paths.
  WRONG: icons: ['<svg xmlns="http://www.w3.org/2000/svg"><path d="..."/></svg>']   ← SVG markup rendered as raw text
  WRONG: icons: ['<img src="star.png">']                                              ← HTML tag rendered as literal string
  WRONG: icons: ['assets/game_find_triangle_side_icon.svg']                           ← local path — 404 in CDN deployment
  WRONG: icons: ['/images/trophy.png']                                                ← absolute local path — 404
  WRONG: icons: ['./icons/star.svg']                                                  ← relative path — 404
  RIGHT: icons: ['🎉'] or icons: ['⭐', '🏆'] or icons: ['📐'] or icons: []
  WHY: The CDN TransitionScreenComponent inserts icons into <span> elements using textContent, which HTML-escapes all markup. SVG strings appear as raw code text covering the screen. Local file paths (assets/, /images/, ./) DO NOT EXIST in deployed builds — they 404. Use emoji which render correctly as Unicode characters. (which-ratio #561 browser audit, BROWSER-P0-002; find-triangle-side #549 UI-FTS-005)
- GEN-PROGRESSBAR-LIVES: totalLives in ProgressBarComponent constructor MUST be a positive integer (≥1). NEVER pass 0, null, undefined, or a negative value.
  WRONG: new ProgressBarComponent({ totalLives: 0, totalRounds: 5, slotId: 'mathai-progress-slot' });
  RIGHT: new ProgressBarComponent({ totalLives: gameState.totalLives, totalRounds: gameState.totalRounds, slotId: 'mathai-progress-slot' });
  ALSO RIGHT: new ProgressBarComponent({ totalLives: 3, totalRounds: 9, slotId: 'mathai-progress-slot' });
  WHY: The CDN ProgressBar computes a lives indicator repeat count as (totalLives - currentLives). If totalLives=0 and currentLives=5, result is -5 — RangeError crashes progressBar.update() on every round. For no-lives games, pass totalLives equal to totalRounds and pass livesRemaining=0 to progressBar.update(). (which-ratio #561 browser audit, BROWSER-NEW-001)
- GEN-SVG-CONTRAST: SVG stroke and fill colors MUST meet WCAG 1.4.11 Non-Text Contrast (≥3:1 for UI components against background). NEVER use: stroke="#64748b" (fails 3:1 in CDN grey/dark contexts), fill="#94a3b8" (2.56:1 — fails both standards), fill="#6b7280" (fails in CDN non-white contexts). ALWAYS use: stroke="#374151" (9.3:1 on white), stroke="#1f2937" (14:1 on white), or stroke="currentColor" (inherits accessible text color). WHY: these colors fail WCAG 1.4.11 Non-Text Contrast (3:1 minimum for UI components) against the CDN slot backgrounds — not all fail on pure white but many fail in the CDN's grey/dark contexts. (find-triangle-side #549 UI-FTS-007, which-ratio #561 — 2 confirmed instances)
- GEN-LOCAL-ASSETS: NEVER reference local file paths for assets (images, icons, SVGs). All asset references must be (1) CDN URLs (https://...), (2) plain emoji strings in icons arrays, or (3) inline SVG markup in HTML. WRONG: icons: ['assets/game_icon.svg'] — 404s in CDN deployment. WRONG: <img src="assets/triangle.png"> — local path not available. RIGHT: icons: ['📐'] — emoji renders without any file load. RIGHT: inline <svg>...</svg> markup. WHY: Games are served from CDN with no local filesystem access — any relative path starting with 'assets/', 'images/', '../', or './' will 404. (find-triangle-side #549 UI-FTS-005 — 1 confirmed instance)
- GEN-SLOT-A11Y: Interactive slot/grid divs MUST have role="button", tabindex="0", and a descriptive aria-label. WRONG: <div class="slot-cell" onclick="selectSlot(this)"> (no role, no aria-label, tabIndex=-1 — invisible to screen readers). RIGHT: <div class="slot-cell" role="button" tabindex="0" aria-label="hundreds position" onclick="selectSlot(this)">. WHY: clickable divs without role="button" are invisible to screen readers and keyboard-unreachable. Any div with onclick that represents an interactive game element (position slot, grid cell, card slot, answer slot, drag target) must have role="button", tabindex="0", and a descriptive aria-label. (position-maximizer #507 — all slot cells had role=null, aria-label=null, tabIndex=-1)
- GEN-CARD-A11Y: Memory/flip game cards must have ARIA role + label + tabindex. For games where cards or tiles are the primary interactive targets (memory-flip, match-the-cards, pairs): WRONG: <div class="card" onclick="flipCard(this)"> (no role, no aria-label, tabIndex=-1). RIGHT: <div class="card" role="button" tabindex="0" aria-label="card 3, face down" onclick="flipCard(this)">. On flip: update aria-label to describe revealed content: aria-label="card 3: lion (revealed)". On match: aria-label="card 3: lion (matched)". WHY: Card games are entirely pointer-driven without role="button" + keyboard support. Screen readers cannot announce card state (face-down, revealed, matched). (Source: memory-flip #505 — all 12 cards had role=null, tabIndex=-1, aria-label=null)
- LP-PROGRESSBAR-CLAMP: Before calling progressBar.update(), ALWAYS clamp lives to 0 — NEVER pass a negative value.
  WRONG: progressBar.update(gameState.currentRound, gameState.lives);  // lives can go negative when a life is lost while lives===0
  RIGHT: const displayLives = Math.max(0, gameState.lives); progressBar.update(gameState.currentRound, displayLives);
  WHY: ProgressBarComponent.update(currentRound, livesRemaining) internally computes String.prototype.repeat(livesRemaining). If lives goes below 0 (e.g. -1), repeat(-1) throws RangeError: "Invalid count value: -1" — crashes the game on every round after the player runs out of lives. T1 check W14 rejects any HTML that calls progressBar.update(gameState.lives, ...) or progressBar.update(..., gameState.lives) without a Math.max(0, ...) wrapper. (~50% of LP failures across all recent builds)
- CT-POSTMESSAGE-REQUIRED: window.parent.postMessage MUST be in the DIRECT unconditional path inside endGame() — NEVER inside an if-block or optional branch.
  WRONG: if (outcome === 'victory') { window.parent.postMessage({...}, '*'); }  // game_over path never sends message
  WRONG: try { const payload = buildPayload(); window.parent.postMessage(payload, '*'); } catch(e) { /* postMessage skipped on error */ }
  RIGHT: window.parent.postMessage({ type: 'game_complete', data: { ... } }, '*');  // called unconditionally in endGame()
  ALSO: gameState.events MUST be initialized as [] in the gameState object — accessing gameState.events when undefined throws "Cannot read properties of undefined (reading 'type')" which cancels the postMessage call entirely.
  WRONG: window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };  // events missing
  RIGHT: window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false, events: [], attempts: [] };
  WHY: undefined.type TypeError (~55% of CT failures) occurs when the LLM wraps postMessage in a try/catch or if-condition that can silently fail — parent never receives game_complete → contract tests all fail. (~55% of CT failures)
- GEN-PM-DUAL-PATH: game_complete postMessage MUST fire on ALL endGame() paths — both 'victory' AND 'game_over'. Never guard the postMessage inside an if (reason === 'victory') check. The postMessage call must be unconditional inside endGame(). Tests call endGame('game_over') directly and expect to receive game_complete.
  WRONG:
    function endGame(reason) {
      if (reason === 'victory') {
        window.parent.postMessage({ type: 'game_complete', ... }, '*');
      }
      // game_over path: NO postMessage — WRONG
    }
  CORRECT:
    function endGame(reason) {
      gameState.gameEnded = true;
      syncDOMState();
      window.parent.postMessage({
        type: 'game_complete',
        gameId: gameState.gameId,
        reason: reason,
        score: gameState.score,
        events: gameState.events || [],
        attempts: gameState.attempts || { total: gameState.score, correct: gameState.score, wrong: 0 },
        metrics: { duration_data: { start: gameState.startTime || Date.now(), end: Date.now() } }
      }, '*');
    }
  WHY: messaging category pass rate is 56% — the primary root cause is postMessage guarded by victory-only check. game_over path silently exits with no postMessage, so all contract tests that call endGame('game_over') fail to receive game_complete. (Analytics: messaging 56% pass rate, top failure pattern)
- GEN-DATA-LIVES-SYNC: For games with totalLives > 0, syncDOMState() MUST write app.dataset.lives = String(gameState.lives) so that getLives() in the test harness can read the current lives count from the DOM. getLives() reads #app[data-lives] — if syncDOMState() does not set this attribute, getLives() returns undefined and ALL mechanics assertions on life decrements fail silently.
  REQUIRED pattern inside syncDOMState():
    function syncDOMState() {
      const app = document.getElementById('app');
      if (!app) return;
      app.dataset.phase = gameState.phase || 'start';
      app.dataset.round = String(gameState.currentRound || 0);
      app.dataset.score = String(gameState.score || 0);
      if (gameState.totalLives > 0) {
        app.dataset.lives = String(gameState.lives);  // REQUIRED for lives games — getLives() reads this
      }
    }
  WRONG: syncDOMState() that never sets app.dataset.lives — getLives() always returns undefined → all lives-decrement assertions fail.
  RIGHT: always include app.dataset.lives = String(gameState.lives) when totalLives > 0.
  ALSO WRONG: app.dataset.lives = gameState.lives (without String() conversion — may store [object Object] or undefined).
  RIGHT: app.dataset.lives = String(gameState.lives) — always a string.
  WHY: The test harness getLives() function reads parseInt(app.getAttribute('data-lives'), 10). If data-lives is never set, getAttribute() returns null → parseInt(null) = NaN → all numeric comparisons fail. (Source: UI/UX audit addition-mcq-lives F7 — games with totalLives > 0 that only track gameState.lives but never write data-lives caused 100% mechanics assertion failures on life decrements. GEN-DATA-LIVES-SYNC)
- GEN-TESTID-STEP: multi-step interactions MUST use namespaced data-testids. When a single round contains multiple sequential interactive steps (Step 1, Step 2, etc.) that coexist in the DOM simultaneously (regardless of display:none or visibility:hidden state — querySelector always returns the FIRST DOM match even when hidden), each step's buttons/inputs MUST use a unique prefix. WRONG: both Step 1 and Step 2 buttons use data-testid="option-0" — querySelector('[data-testid="option-0"]') always hits Step 1, making Step 2 unreachable by tests. RIGHT: Step 1 uses data-testid="part1-option-0", Step 2 uses data-testid="part2-option-0". Rule: when multiple interactive steps coexist in the DOM, prefix each step's elements with part1-, part2-, step1-, step2-, etc. Never reuse the same data-testid across concurrent steps. (Source: UI/UX audit expression-completer #511 — EC-002)
- GEN-TESTID-MULTIPLAYER: Multi-player games must use player-prefixed data-testids. When a game has N ≥ 2 simultaneous player areas (both present in DOM at once), each player's interactive elements must use player-prefix testids. WRONG: Both P1 and P2 buttons use data-testid="option-0" — querySelector returns P1 always. RIGHT: P1 buttons: data-testid="p1-option-0", P2 buttons: data-testid="p2-option-0". WHY: Both player areas render simultaneously in DOM — querySelector always hits first match, making P2 interactions completely untestable via testid selectors. Apply to: answer buttons, input fields, any interactive element inside a player container. (Source: two-player-race #506 UI/UX MEDIUM-003 — 2 instances of each testid in DOM)
- GEN-WINDOW-NEXTROUNDEXPOSED: window.nextRound MUST always be exposed, even when the internal function has a different name. The test harness requires window.nextRound to advance between rounds. Even if your internal function is named roundComplete, loadRound, or advanceRound, you MUST expose it as window.nextRound: window.nextRound = roundComplete; // alias to internal name. WRONG: exposes window.roundComplete but NOT window.nextRound — test harness emits "[ralph-test-harness] MISSING window.nextRound" and all round-advancement tests fail. RIGHT: always assign window.nextRound regardless of internal function name. If the game has exactly ONE explicitly defined interaction (one puzzle, no rounds, no levels), define a no-op: window.nextRound = () => {}. When in doubt, use the real advance function — no-op is ONLY for genuinely single-interaction games. (Source: UI/UX audit expression-completer #511 — EC-001; adjustment-strategy #385)`;

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
- GEN-TESTID-MATCH: data-testid value MUST exactly match the element's id attribute — NEVER diverge. WRONG: <div id="results-screen" data-testid="results"> RIGHT: <div id="results-screen" data-testid="results-screen">. Elements with both id and data-testid MUST use identical values. Conventions: id="app" data-testid="app", id="results-screen" data-testid="results-screen", id="feedback-area" data-testid="feedback-area". (word-pairs audit #529)
- RULE-DUP: data-testid attributes MUST be globally unique across all screens. A testid like data-testid="option-0" appearing on both start screen and game screen causes strict-mode locator violations. Prefix testids by screen: data-testid="game-option-0", data-testid="start-play-btn", etc.
- GEN-GRID-TESTID (puzzle/grid games): For games with a puzzle grid (light-up, kakuro, nonogram, crossword, spatial), the grid container MUST use data-testid="game-grid", NOT data-testid="answer-input". Interactive cells: data-testid="cell-R-C" where R=row and C=col (0-indexed). WRONG: <div class="game-grid" data-testid="answer-input"> RIGHT: <div class="game-grid" data-testid="game-grid"> WHY: "answer-input" implies a text input field to Playwright selectors; "game-grid" is semantically correct and unambiguous for spatial puzzle games. (light-up #508 UI/UX audit, CR-072)
- GEN-TESTID-RESTART: The restart / play-again button MUST use data-testid="btn-restart". Never use "restart-btn", "play-again-btn", "replay-btn", or any other variant. The test harness clicks document.querySelector('[data-testid="btn-restart"]') — any other name causes the test to fail silently. WRONG: <button data-testid="restart-btn"> RIGHT: <button data-testid="btn-restart"> (UI/UX audit one-digit-doubles #487)
- GEN-BTN-START: The "Let's go!" / start button on the start/transition screen MUST have data-testid="btn-start". This includes any button that starts gameplay from the initial or interstitial screen. Tests use document.querySelector('[data-testid="btn-start"]') to click start. WRONG: <button class="btn-start"> (no data-testid) RIGHT: <button class="btn-start" data-testid="btn-start"> (crazy-maze UI-CM-003 #481)

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
   TIMEOUT MUST BE 180000ms (3 minutes). CDN packages load from storage.googleapis.com — in a fresh Playwright browser (no CDN cache) on a cold GCP server, CDN cold-start can take 120-150s. A 120s timeout races against CDN cold-start and loses (~30% of builds), crashing the game with "Packages failed to load" before CDN finishes. Use 180000 always — this safely clears the ~150s CDN cold-start window. (Lesson 117, Lesson 143) WRONG: waitForPackages(10000) or waitForPackages(5000) or ANY value below 180000. RIGHT: timeout = 180000 always. CONFIRMED: adjustment-strategy builds #376-378 used timeout=10000ms — ALL beforeEach calls threw "Packages failed to load" → every test in every batch got toBeVisible failure → 0% pass rate across ALL categories. 68 builds, only 6 approved (8.8%); 10s timeout is the #1 root cause. (adjustment-strategy diagnosis 2026-03-23, TE: ebd5ad8)
   BANNED PACKAGE NAMES — NEVER use these in the typeof check (they are NEVER window globals — CDN does not export them):
     WRONG (T1 GEN-WAITFOR-BANNEDNAMES rejects these — white screen guaranteed):
       while (typeof Components === 'undefined' || typeof Helpers === 'undefined') { ... }
       while (typeof Game === 'undefined') { ... }
       while (typeof Utils === 'undefined') { ... }
       while (typeof Module === 'undefined') { ... }
       while (typeof Lib === 'undefined') { ... }
     RIGHT (only use actual CDN package names):
       while (
         typeof ScreenLayout === 'undefined' ||
         typeof ProgressBarComponent === 'undefined' ||
         typeof FeedbackManager === 'undefined'
       ) { await sleep(50); iteration++; }
   (disappearing-numbers #509 UI/UX audit root cause: typeof Components/Helpers never resolved → while loop ran until 180s timeout → white screen → all tests fail, 2026-03-23)
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

5. GEN-PM-001 (POSTMESSAGE ON BOTH PATHS — MANDATORY): window.parent.postMessage({ type: 'game_complete', data: { metrics: { score, stars, ... }, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*') MUST be called in BOTH: (1) the game-over branch of endGame() (lives=0, stars=0), and (2) the victory branch of endGame() (all rounds complete, stars>0). The type field MUST be exactly 'game_complete' — not 'complete', not 'completed', not 'game-complete', not 'gameOver'. Missing this on either path causes ALL contract tests to fail. 46 confirmed failures — top pattern in DB.

   POSTMESSAGE — always send to PARENT: window.parent.postMessage(payload, '*')
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
   Note: startGame() MUST call transitionScreen.hide() AND then explicitly show #gameContent. transitionScreen.hide() ONLY dismisses the transition overlay — it does NOT reveal #gameContent. You MUST explicitly set #gameContent visible. WRONG: async function startGame() { await transitionScreen.hide(); gameState.phase = 'playing'; nextRound(); } RIGHT: async function startGame() { await transitionScreen.hide(); document.getElementById('gameContent').style.display = 'block'; /* REQUIRED — transitionScreen.hide() does NOT auto-show #gameContent */ gameState.phase = 'playing'; nextRound(); } (GEN-117, GEN-118)

20. ROUND LIFECYCLE RESET — required at the START of every loadRound() / initRound() / setupRound() call:
    gameState.isProcessing = false;   // reset from previous round — NEVER omit
    gameState.isActive = true;        // re-enable click handlers — NEVER omit
    syncDOMState();                   // push current phase to #app data-* attributes
    These MUST be the FIRST three lines inside loadRound(). If omitted, isProcessing=true from the
    prior round silently blocks ALL clicks and edge-case tests timeout with locator.click Timeout.
    This is the #1 cause of game-flow and edge-case test timeouts in the fix loop.
    GEN-FLIP-RESET: Per-round counters must reset on round transition.
    Round-scoped counters (flips, moves, attempts, errors) must reset to 0 at the start of each new round.
    WRONG: display totalFlips which accumulates across all rounds (shows 14 at Round 3 start)
    RIGHT: reset roundFlips = 0 at the start of each round; display roundFlips not totalFlips
    WHY: Cumulative counters across rounds give misleading feedback — a student sees 14 flips at Round 3
    start before making any move. Round-scoped counters are the pedagogically correct default.
    function nextRound() {
      gameState.currentRound++;
      gameState.roundFlips = 0;   // ← REQUIRED: reset on each round
      // ... rest of round init
    }
    (Source: memory-flip #505 HIGH-2 — totalFlips shown instead of roundFlips per round)
    GEN-ROUND-INDEX: currentRound MUST be 0-based throughout. Never mix 0-based and 1-based indexing.
    CORRECT pattern:
      gameState.currentRound = 0;  // initialize at 0
      renderRound();               // reads rounds[gameState.currentRound]
      function nextRound() { gameState.currentRound++; renderRound(); }
      window.loadRound = (n) => { gameState.currentRound = n - 1; renderRound(); }  // loadRound is 1-based input, 0-based internal
      function trackAttempt() { const round = rounds[gameState.currentRound]; ... }  // NO -1

    WRONG patterns (each causes TypeError or wrong round loaded):
      const round = rounds[gameState.currentRound - 1];  // WRONG — index -1 on first click
      function loadRound(n) { gameState.currentRound = n - 1; nextRound(); }  // WRONG — double-increments
      function loadRound(n) { gameState.currentRound = n; renderRound(); }  // WRONG — loadRound(1) loads index 1 (round 2)

21. SYNCDOMESTATE CALL SITES — call syncDOMState() immediately after EVERY gameState.phase assignment:
    - game_init → gameState.phase = 'playing'; syncDOMState();        // already in rule 4
    - round complete → gameState.phase = 'transition'; syncDOMState();
    - transitionScreen.show() buttons[].action callback → gameState.phase = 'playing'; syncDOMState();
    - endGame (game over path) → gameState.phase = 'gameover'; syncDOMState();
    - endGame (victory path) → gameState.phase = 'results'; syncDOMState();
    - restartGame (with TransitionScreen interstitial) → gameState.phase = 'start_screen'; syncDOMState(); then transitionScreen.show(...) — see GEN-RESTART-PHASE below
    - restartGame (no interstitial, goes direct to gameplay) → gameState.phase = 'playing'; syncDOMState();
    Missing ANY of these causes data-phase to lag, making waitForPhase() timeout indefinitely.
    GEN-RESTART-PHASE: When restartGame() shows a TransitionScreen interstitial ("Ready to play again?") before actual gameplay resumes, syncDOMState() MUST be called with 'start_screen' phase, NOT 'playing':
      function restartGame() {
        gameState.gameEnded = false;
        gameState.phase = 'start_screen';
        syncDOMState();                   // ← MUST be 'start_screen' here
        transitionScreen.show({...});     // show "Ready to play again?" interstitial
        // Phase only transitions to 'playing' when gameplay actually starts (after user clicks "Let's go!")
      }
    WRONG: syncDOMState() with 'playing' at start of restartGame() when TransitionScreen interstitial is shown
    RIGHT: syncDOMState() with 'start_screen' until user confirms and gameplay begins
    WHY: Test harness may see data-phase='playing' before the game is interactive, causing waitForPhase('playing') to resolve too early — clicks during the interstitial are ignored and tests fail with timeout. (light-up #508 UI/UX audit MEDIUM-3, CR-072)

22. PHASE-GATED ELEMENT VISIBILITY — game elements MUST be visible in the correct phase for tests to pass:
    - PLAYING phase: answer-input, btn-check/btn-submit, score-display, lives-display, question/problem area MUST be visible
    - GAMEOVER/RESULTS phase: stars-display, final score, btn-restart MUST be visible; question area SHOULD be hidden
    - START (transition slot): #mathai-transition-slot button visible BEFORE startGame, HIDDEN after startGame — achieved by calling transitionScreen.hide() in startGame() (NOT automatic)
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
    CONFIRMED FAILURE: adjustment-strategy build #381 — 3/3 transitionScreen.show() calls unawaited → ALL mechanics tests timed out at 15000ms ("waiting for #mathai-transition-slot button") — button rendered but stayed visibility:hidden.
    WRONG: transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });  // not awaited → CDN state corruption
    RIGHT: await transitionScreen.show({ buttons: [{ text: 'Next', type: 'primary', action: () => nextRound() }] });  // CDN resolves when animation completes
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

26b. GEN-GAMEID (gameState.gameId MANDATORY FIRST FIELD): \`gameId\` MUST always be the FIRST field in the gameState object literal, set to the game's template ID from the spec Section 1. This field is required for SignalCollector event attribution and postMessage correlation.
    WRONG: window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };
    RIGHT: window.gameState = { gameId: 'my-game-id', score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };
    The template ID is found in the spec Section 1 (e.g. "Template ID: my-game-id"). Copy it verbatim as the gameId string.
    (3 confirmed missing instances: associations build #513, adjustment-strategy build #385, addition-mcq spec)

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

29b. GEN-SENTRY-VERSION: When PART-030=YES (Sentry enabled), the <head> section MUST load Sentry SDK v10.23.0
    using THREE separate scripts in this exact order — NEVER the v7 single-bundle pattern:
    \`\`\`html
    <script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
    <script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
    <script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>
    \`\`\`
    BANNED patterns (v7 single-bundle — DO NOT generate):
    \`\`\`html
    <script src="https://browser.sentry-cdn.com/7.x.x/bundle.min.js"></script>        ← WRONG: v7 single-bundle
    <script src="https://unpkg.com/@sentry/browser@7..."></script>                    ← WRONG: npm CDN v7
    \`\`\`
    WHY: v7 single-bundle lacks the CaptureConsole and BrowserProfiling plugins that the three-script v10
    pattern provides. Version drift across builds causes inconsistent error tracking. Always use v10.23.0.
    The three scripts MUST appear in the listed order — captureconsole and browserprofiling extend the main bundle.
    If PART-030=NO, include NO Sentry scripts at all.

30. GEN ARIA-001 (FEEDBACK ACCESSIBILITY — WCAG SC 4.1.3): ALL dynamic feedback elements MUST have aria-live="polite" AND role="status". This rule applies to ANY element whose text content changes in response to user interaction — the rule is about behavior, not element naming. Apply to: answer feedback panels, correct/incorrect indicators, score updates, hint text, phase announcements, worked-example feedback, and any div whose content or visibility changes based on game state.
    ARIA-001 INLINE PANELS — these selectors MUST have aria-live="polite" role="status" with NO exceptions:
    - #feedback-panel, #faded-feedback, #practice-feedback, #feedback-area, #feedback-message
    - #answer-feedback, #result-feedback, #feedback, .feedback-message
    - #correct-feedback, #incorrect-feedback, #skip-note, #hint-text
    - ANY div whose id or class contains the substring 'feedback' (e.g. id="my-feedback-area" → must have aria-live="polite")
    Do NOT use aria-live="assertive" unless the div also has role="alert" AND its id/class contains "error".
    WRONG: <div id="feedback-panel">
    WRONG: <div id="correct-feedback" class="feedback hidden">
    WRONG: <div id="feedback" class="feedback-message">
    WRONG: <div id="faded-feedback">  ← 7+ confirmed audit failures on this selector alone
    RIGHT:  <div id="feedback-panel" aria-live="polite" role="status">
    RIGHT:  <div id="correct-feedback" aria-live="polite" role="status" class="feedback hidden">
    RIGHT:  <div id="feedback" aria-live="polite" role="status" class="feedback-message">
    RIGHT:  <div id="faded-feedback" aria-live="polite" role="status">
    (Note: aria-live="assertive" is ONLY correct for a div with \`role="alert"\` OR id or class containing "error" — NEVER use assertive for correct/incorrect answer feedback. Any other use of assertive is a bug.)
    GEN-SLOT-A11Y: Interactive slot/grid divs MUST have role="button", tabindex="0", and a descriptive aria-label.
    For games where non-button div elements are the primary interactive targets (position slots, grid cells, card slots, answer slots, drag targets):
    WRONG: <div class="slot-cell" onclick="selectSlot(this)">  <!-- no role, no aria-label, tabIndex=-1 -->
    RIGHT: <div class="slot-cell" role="button" tabindex="0" aria-label="hundreds position" onclick="selectSlot(this)">
    WHY: Clickable divs are invisible to screen readers and keyboard navigation without role="button".
    This is especially important for spatial/positional games where the slot's position has semantic meaning.
    Rule: Any div with an onclick handler (or addEventListener click) that represents an interactive game element
    must have role="button", tabindex="0", and a descriptive aria-label.
    (Source: position-maximizer #507 UI/UX audit — all slot cells had no role, no aria-label, tabIndex=-1)
    GEN-CARD-A11Y: Memory/flip game cards must have ARIA role + label + tabindex.
    For games where cards or tiles are the primary interactive targets (memory-flip, match-the-cards, pairs):
    WRONG: <div class="card" onclick="flipCard(this)">  <!-- no role, no aria-label, tabIndex=-1 -->
    RIGHT: <div class="card" role="button" tabindex="0" aria-label="card 3, face down" onclick="flipCard(this)">
    On flip: update aria-label to describe revealed content: aria-label="card 3: lion (revealed)"
    On match: add aria-label="card 3: lion (matched)"
    WHY: Card games are entirely pointer-driven without role="button" + keyboard support.
    Screen readers cannot announce card state (face-down, revealed, matched).
    (Source: memory-flip #505 — all 12 cards had role=null, tabIndex=-1, aria-label=null)

31. GEN-MOBILE-RESULTS (RESULTS SCREEN POSITION — mobile viewport): The results/game-over/completion screen element MUST use position:fixed so it covers the full viewport on mobile (480×800px). A static-positioned results screen is at y>800px (below the fold) and is invisible on mobile — Playwright asserts data-phase='results' but the element is scrolled off-screen.
    WRONG: #results-screen { display: block; width: 100%; }  ← scrolled off-screen at y=1037px on 480×800 viewport
    RIGHT:  #results-screen { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; display: none; }
            then in showResults(): document.getElementById('results-screen').style.display = 'flex'; (or 'block')
    Apply to: #results-screen, #game-over-screen, #end-screen, #completion-screen, and any full-screen overlay that shows game end state.
    The z-index MUST be ≥100 to appear above ScreenLayout CDN elements (z-index 50-99 range).

32. GEN-TOUCH-TARGET (BUTTON TOUCH TARGETS — Apple HIG): All interactive buttons and clickable option elements MUST have min-height: 44px and min-width: 44px in CSS. This meets the Apple Human Interface Guidelines minimum touch target specification (44pt = 44px at 1x). Undersized buttons cause missed taps on mobile, leading to 0% interaction pass rates in mechanics tests run at 480×800 viewport.
    WRONG: .option { padding: 8px 12px; }  ← renders at ~32px height — too small for reliable touch
    RIGHT:  .option { padding: 12px 16px; min-height: 44px; min-width: 44px; }
    Apply to: .option, .answer-btn, button, [data-testid^="option-"], any clickable element. Do NOT rely on padding alone — padding collapses on small text. Set min-height: 44px explicitly.
    GEN-UX-002 (ALL BUTTON CLASSES — CSS class name does NOT exempt from touch target requirement): Every interactive button including secondary, utility, choice, and custom widget buttons MUST have min-height: 44px. This applies to ALL of: .game-btn, .choice-btn, .adj-btn, .reset-btn, .option-btn, .btn-restart, .btn-play-again, .btn-try-again, .restart-btn, .play-again-btn, and any other non-.game-btn interactive element. ALSO APPLIES TO: every button inside #results-screen, #game-over-screen, .mathai-transition-screen — these are confirmation buttons the user must tap to continue. A button with an unusual class name is NOT exempt — if it is clickable, it needs min-height: 44px. Confirmed: real-world-problem #564 results screen Play Again button measured 41px (below 44px min) — unreachable on small touch targets.
    GEN-UX-002 BANNED PATTERNS (3 confirmed audit instances):
      WRONG: .choice-btn { padding: 14px 8px; }  /* padding-only, NO min-height — associations pattern: renders below 44px on small text */
      WRONG: .adj-btn { height: 36px; }           /* fixed height below 44px — adjustment-strategy pattern */
      WRONG: .submit-btn { height: 21.5px; }      /* CSS strip removes min-height — word-pairs pattern */
      RIGHT: .choice-btn { padding: 14px 8px; min-height: 44px; }
      RIGHT: .adj-btn { min-height: 44px; }
      RIGHT: .submit-btn { min-height: 44px; }
    Any element with an onclick handler, cursor:pointer style, or role="button" attribute MUST have min-height: 44px explicitly — do NOT rely on padding alone.

33. GEN-MCQ-PHASE / GEN-PHASE-MCQ-FULL (ALL GAMES — MANDATORY explicit data-phase state machine with syncDOMState()):
    EVERY Ralph pipeline game MUST implement data-phase transitions — this is NOT optional for any
    game type. Drag-and-drop, canvas, worked-example, text-input, and MCQ games all require it.
    Every function that transitions the game phase MUST set gameState.phase AND call syncDOMState()
    immediately after — in this exact order, before any rendering or CDN calls.

    ALL 4 REQUIRED syncDOMState() CALL SITES (MCQ / timed games — must have ALL four):

    CALL SITE 1 — showStartScreen():
      WRONG: function showStartScreen() { transitionScreen.show({ title: 'Ready?', buttons: [...] }); }
             // ← gameState.phase never set to 'start'; waitForPhase('start') times out immediately
      RIGHT: function showStartScreen() {
               gameState.phase = 'start';
               syncDOMState();  // ← REQUIRED before transitionScreen.show()
               transitionScreen.show({ ... });
             }

    CALL SITE 2 — startGame() / renderRound() (whichever renders the first round):
      WRONG: function startGame() { renderRound(); }
             function renderRound() { renderOptions(); }  // ← syncDOMState() missing; data-phase still 'start'
      RIGHT: function startGame() { gameState.phase = 'playing'; syncDOMState(); renderRound(); }
             // OR: function renderRound() { gameState.phase = 'playing'; syncDOMState(); /* then render options */ }

    CALL SITE 3 — endGame() game-over path (lives = 0):
      WRONG: function endGame() { if (!lives) { transitionScreen.show({ title: 'Game Over', ... }); } }
             // ← data-phase never set to 'gameover'; waitForPhase('gameover') times out
      RIGHT: function endGame() {
               if (gameState.lives === 0) {
                 gameState.phase = 'gameover';
                 syncDOMState();  // ← REQUIRED before TransitionScreen.show() or showResults()
                 transitionScreen.show({ ... });
               }
             }

    CALL SITE 4 — endGame() victory path (all rounds complete, lives > 0):
      WRONG: function endGame() { if (allRoundsDone) { showResults(); } }
             // ← data-phase never set to 'results'; waitForPhase('results') times out
      RIGHT: function endGame() {
               if (gameState.currentRound >= gameState.totalRounds) {
                 gameState.phase = 'results';
                 syncDOMState();  // ← REQUIRED before TransitionScreen.show() or showResults()
                 transitionScreen.show({ ... });
               }
             }

    SUMMARY — all 4 call sites in one view:
      showStartScreen() → gameState.phase = 'start';    syncDOMState();  // before transitionScreen.show()
      startGame()       → gameState.phase = 'playing';  syncDOMState();  // after transitionScreen.hide(), before renderRound()
      renderRound()     → gameState.phase = 'playing';  syncDOMState();  // first lines, before rendering options
      // (renderRound() or equivalent: renderGrid(), loadPuzzle(), initBoard(), setupRound() — any function that renders per-round content)
      endGame() lives=0 → gameState.phase = 'gameover'; syncDOMState();  // BEFORE TransitionScreen.show() or showResults()
      endGame() lives>0 → gameState.phase = 'results';  syncDOMState();  // BEFORE TransitionScreen.show() or showResults()

    WRONG — phase set without immediate syncDOMState():
      gameState.phase = 'playing';
      renderOptions();   // ← syncDOMState() missing; data-phase still 'start'; waitForPhase('playing') times out

    RIGHT — syncDOMState() called immediately after assignment:
      gameState.phase = 'playing';
      syncDOMState();    // ← data-phase='playing' written to #app immediately
      renderOptions();

    WHY: syncDOMState() writes gameState.phase to #app[data-phase]. The test harness waitForPhase()
    polls data-phase — any gap between the phase assignment and syncDOMState() causes waitForPhase()
    to timeout, failing 100% of game-flow and mechanics tests. Root cause of 22% game-flow failures
    across ALL game types — first confirmed non-MCQ instance: drag-and-drop math-cross-grid (F4).
    T1 static check: if MCQ pattern detected (option buttons + lives/timer) with < 3 syncDOMState()
    calls, validator emits WARNING [GEN-PHASE-MCQ]: "MCQ game has fewer than 3 syncDOMState() calls".

34. GEN-MCQ-TIMER (MCQ AND TIMED GAMES — timer.start() placement):
    timer.start() MUST be called ONLY inside renderRound() — NEVER inside setupGame() or startGame().

    WRONG — timer started in setupGame() before first round exists:
      function setupGame() {
        timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: 30, endTime: 0, onEnd: handleTimeout });
        timer.start();  // ← WRONG: fires onEnd → endGame() before round 1 is rendered
      }
      function renderRound() { timer.reset(); /* ← race: timer already ticking */ renderOptions(); }

    RIGHT — timer created in setupGame(), started only in renderRound():
      function setupGame() {
        timer = new TimerComponent('timer-container', { timerType: 'decrease', startTime: 30, endTime: 0, onEnd: handleTimeout });
        // ← do NOT call timer.start() here
      }
      function renderRound() {
        timer.reset();
        timer.start();  // ← CORRECT: starts fresh for each round, after round content is ready
        renderOptions();
      }

    WHY: Calling timer.start() in setupGame() starts the countdown before renderRound() is called.
    If the CDN init or transitionScreen.show() takes >0ms, the timer's onEnd fires before the first
    question appears, instantly triggering endGame() with an empty gameState. The result is a game
    that ends before the player sees any content. (Source: addition-mcq-blitz spec audit)

35. GEN-INPUT-001 (TEXT INPUT ENTER KEY — ACCESSIBILITY): If the game has a text <input> for answer entry, you MUST add an Enter key handler: answerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); } }); The submit button alone is not sufficient — mobile keyboards show a return key that users expect to work. 2 confirmed missing instances: real-world-problem spec (F5), adjustment-strategy build #385 (F5). WRONG: <input id="answer-input"> with only a button click handler. RIGHT: input has BOTH button click AND keydown Enter listener.

36. GEN-WINDOW-EXPOSE (ALL GAMES — MANDATORY window assignments at bottom of DOMContentLoaded):
    window.endGame, window.restartGame, window.nextRound (or alias), and window.gameState MUST all
    be assigned at the bottom of DOMContentLoaded, BEFORE any user interaction is possible. This
    applies to ALL game types — drag-and-drop, canvas, worked-example, text-input, and MCQ games.

    REQUIRED at the bottom of DOMContentLoaded (before closing bracket):
      window.gameState    = gameState;
      window.endGame      = endGame;
      window.restartGame  = restartGame;
      window.nextRound    = nextRound;    // or alias: window.loadRound / window.jumpToRound

    WRONG — missing window assignments:
      document.addEventListener('DOMContentLoaded', () => {
        setupGame();
        showStartScreen();
        // ← no window.endGame assignment — test harness cannot call endGame()
      });

    RIGHT — window assignments at bottom of DOMContentLoaded:
      document.addEventListener('DOMContentLoaded', () => {
        setupGame();
        showStartScreen();
        window.gameState   = gameState;
        window.endGame     = endGame;
        window.restartGame = restartGame;
        window.nextRound   = nextRound;
      });

    WHY: The test harness calls window.endGame() to force game-over scenarios, and reads
    window.gameState to inspect state. Missing window assignments cause ALL contract tests and
    targeted test harness calls to fail. (4 confirmed missing instances — math-cross-grid F4)

37. GEN-STEP-001 (STEP-BASED ROUND RESET — MANDATORY for any game with sequential step panels):
    If the game has multiple sequential step panels (e.g. step1-panel, step2-panel, step3-panel, or any phase-gated content panels that advance within a round), the round reset logic MUST follow this exact sequence:

    WRONG (causes level-progression failures — panel from previous round stays visible):
      function startRound(n) {
        gameState.step = 'step1';
        syncDOMState();  // step3-panel might still be visible from last round
        // ...
      }

    RIGHT (explicitly hide all step panels before showing step1):
      function startRound(n) {
        // STEP 1: Hide ALL step panels explicitly
        document.querySelectorAll('[data-step]').forEach(el => el.style.display = 'none');
        // Or if panels have specific IDs:
        // step1Panel.style.display = 'none'; step2Panel.style.display = 'none'; step3Panel.style.display = 'none';

        // STEP 2: Set phase and sync
        gameState.step = 'step1';
        gameState.phase = 'playing';
        syncDOMState();

        // STEP 3: Show only step1
        step1Panel.style.display = 'block';
        // ...
      }

    The syncDOMState() call alone does NOT hide step panels — it only updates data-phase/data-lives/data-score attributes. Explicit DOM manipulation to hide panels is ALWAYS required at round start.

    Evidence: real-world-problem builds #563, #564, #565 — level-progression test failed across 5 fix attempts (3 per-batch + 2 global) because step3-panel was not explicitly hidden at round start. Review approved despite this failure.

38. GEN-112 (PROGRESSBAR UPDATE ARGS — MANDATORY): progressBar.update() takes EXACTLY 2 args: (currentRound, livesRemaining). The 2nd arg is ALWAYS lives remaining — NEVER totalRounds.

    CRITICAL WRONG PATTERNS (cause RangeError: Invalid count value — negative repeat count):
      WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds); // 2nd arg is NOT totalRounds
      WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives); // 3-arg form does not exist
    CORRECT (always):
      progressBar.update(gameState.currentRound, gameState.lives); // 2nd arg is ALWAYS lives remaining
      // For no-lives games: progressBar.update(gameState.currentRound, 0);

    WHY: Passing totalRounds as the 2nd arg passes a positive integer as "lives remaining" to a bar initialized with totalLives=0 — the bar computes a negative fill ratio and throws "RangeError: Invalid count value: -5". (which-ratio builds #559/#560/#561 all failed with this error — totalRounds=5 passed as lives to totalLives=0 bar)

39. GEN-CANVAS-001 (CANVAS RESPONSIVE SIZING — MANDATORY for any game using <canvas>):
    Canvas elements MUST include responsive CSS to prevent horizontal overflow on 375-480px mobile screens.
    The HTML width/height attributes set the internal drawing buffer resolution — keep them. Add CSS style
    to make the canvas scale down proportionally on small screens.

    WRONG — hardcoded pixel width causes overflow on mobile:
      <canvas id="game-canvas" width="500" height="400"></canvas>
      ← At 375px viewport width, canvas overflows by 125px; horizontal scrollbar appears; game unplayable.

    RIGHT — internal resolution preserved, canvas scales down on mobile:
      <canvas id="game-canvas" width="500" height="400" style="max-width: 100%; height: auto; display: block;"></canvas>

    CSS alternative (in <style> block):
      #game-canvas { max-width: 100%; height: auto; display: block; }

    Apply to ALL canvas elements: the main game canvas, any overlay canvas, background canvas, etc.
    (Source: UI/UX audit right-triangle-area #543 — width="500" caused overflow on 375-480px viewport)

40. GEN-CSS-TOKENS (FEEDBACK COLOR CSS VARIABLES — MANDATORY):
    Feedback colors MUST use ONLY these CSS custom properties:
    - \`--mathai-success\` — correct answer feedback text/background
    - \`--mathai-error\`   — incorrect answer feedback text/background
    - \`--mathai-warning\` — neutral/warning states

    NEVER use ad-hoc custom properties for feedback colors:
    WRONG: color: var(--mathai-green);      ← undefined token → invisible text
    WRONG: color: var(--color-red);         ← undefined token → invisible text
    WRONG: color: var(--color-orange);      ← undefined token → invisible text
    WRONG: color: var(--color-green);       ← undefined token → invisible text
    WRONG: color: var(--color-success);     ← undefined token → invisible text
    WRONG: color: var(--feedback-color);    ← undefined token → invisible text
    WRONG: color: var(--answer-color);      ← undefined token → invisible text
    WRONG: color: var(--status-green);      ← undefined token → invisible text
    RIGHT: color: var(--mathai-success);
    RIGHT: color: var(--mathai-error);

    Do NOT invent new \`--my-color\` tokens for feedback. ONLY use \`--mathai-success\`, \`--mathai-error\`, \`--mathai-warning\`.
    Do NOT invent any new --custom-color-name token. If you need a feedback color, use ONLY the
    three tokens above (--mathai-success, --mathai-error, --mathai-warning).

    WHY: Undefined CSS custom properties silently fall back to the browser default (usually black or
    the inherited color), making feedback text invisible against dark feedback backgrounds or rendering
    in the wrong color entirely. (Source: UI/UX audit right-triangle-area #543; expanded CR-024)

41. GEN-HIDE-SHOW (hide()/show() helpers MUST receive DOM elements, NOT selector strings):
    When hide() and show() shorthand helpers are defined as element-expected
    (e.g. \`const hide = el => el.style.display = 'none'\` or \`const hide = el => el.classList.add('hidden')\`),
    they MUST ALWAYS receive a DOM element reference, NEVER a CSS selector string.

    WRONG: hide('.results-screen');       ← TypeError: '.results-screen'.style is undefined
    WRONG: show('#game-content');         ← TypeError: '#game-content'.style is undefined
    RIGHT: hide(document.getElementById('results-screen'));
    RIGHT: show(document.getElementById('game-content'));

    WHY: The TypeError risk is real ONLY when the helper is defined as \`el => el.style.display = 'none'\`
    or \`el => el.classList.add('hidden')\` (DOM element expected). Strings don't have a .style or
    .classList property — the TypeError is swallowed silently, leaving elements visible or hidden in
    the wrong state with no console error.
    NOTE: soh-cah-toa #544 citation RETRACTED — that game's hide() uses
    \`(selector) => document.querySelector(selector)?.classList.add('hidden')\` (accepts selector strings
    correctly); no TypeError occurred. This rule applies to any game defining \`hide = el => el.classList.add(...)\`
    or \`hide = el => el.style.display = 'none'\` (element-expected helpers).
    Safest alternative: use \`document.getElementById('results-screen').classList.add('hidden')\` directly
    — this bypasses the helper entirely and avoids the string-vs-element mistake.
    (Source: CR-017; CR-026)

42. GEN-RESTART-RESET (RESTART MUST RESET ALL MUTABLE GAMESTATE FIELDS):
    restartGame() MUST reset ALL mutable gameState fields to initial values before calling showStartScreen().
    PRINCIPLE: For ANY field initialized in DOMContentLoaded / setupGame() / startGame(), reset it in
    restartGame() — not just the standard fields.

    CRITICAL — CUSTOM GAME-SPECIFIC FIELDS MUST ALSO BE RESET:
    Standard fields (lives, score, currentRound, gameEnded, phase, events, attempts) are caught by T1
    check W13, but custom game fields are NOT caught by static validation. Forgetting them causes
    second-playthrough bugs visible only in the browser. Every custom field must be reset:
      gameState.selectedPairs = [];    // card-matching, word-pairs games
      gameState.currentWord = null;    // word/fill-in-blank games
      gameState.streak = 0;            // streak-based games
      gameState.selectedCards = [];    // any selection-based game
      gameState.matchedCount = 0;      // matching games
      gameState.boardState = null;     // board/grid games
      (adapt to each game's actual DOMContentLoaded initialization)

    WRONG (only resets standard fields — custom fields from previous game persist into session 2):
      function restartGame() {
        gameState.gameEnded = false;
        gameState.phase = 'start';
        syncDOMState();
        showStartScreen();
      }

    RIGHT (resets ALL fields — standard AND custom — before showStartScreen()):
      function restartGame() {
        gameState.currentRound = 0;
        gameState.lives = gameState.totalLives;
        gameState.score = 0;
        gameState.events = [];
        gameState.attempts = [];
        gameState.gameEnded = false;
        gameState.phase = 'start';
        // ALSO reset every custom field this game initialized in DOMContentLoaded:
        gameState.selectedPairs = [];   // example — adapt to this game's actual custom fields
        gameState.currentWord = null;   // example — adapt to this game's actual custom fields
        syncDOMState();
        signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(), studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null });
        window.signalCollector = signalCollector;
        showStartScreen();
      }

    WHY: 3 confirmed browser instances — quadratic-formula #546 (data-lives="2" and data-round="3" at second
    game start), find-triangle-side #549, associations #472 — all had restartGame() that only reset
    gameEnded/phase but not lives/currentRound/score/events/attempts. T1 check W13 (GEN-RESTART-RESET)
    now catches standard fields at static validation. Custom game-specific fields are NOT detectable by
    static validation — they must be reset explicitly or they cause second-playthrough bugs. (CR-032; CR-014)

    SUB-RULE — GEN-RESTART-SYNC (UI-WP-B-002): syncDOMState() MUST be placed AFTER resetting ALL
    gameState fields (currentRound, score, lives, phase, gameEnded, AND all custom fields) — not just after gameState.phase.
    syncDOMState() writes data-round, data-score, data-lives, and data-phase to #app[data-*]. If called
    before score/round/lives are reset, or not called at all, those DOM attributes remain stale from the
    previous game session. These stale attributes persist visually during the TransitionScreen phase —
    the visual overlay is correct, but the underlying DOM attributes reflect the old game's final state.
    Any test that reads data-round or data-score during TransitionScreen, or at game start before the
    next syncDOMState fires, will see the old values and produce false failures.
    CONFIRMED: word-pairs #529 — after Play Again, #app[data-round]="3" and #app[data-score]="11"
    were stale during TransitionScreen because restartGame() reset the gameState fields but did not
    call syncDOMState() immediately after all resets.
    CORRECT PLACEMENT: syncDOMState() is the LAST step before showStartScreen() in restartGame(),
    after ALL field resets — as shown in the RIGHT example above. This is already the canonical
    pattern; do NOT move syncDOMState() earlier (before score/round/lives resets) or omit it.

43. GEN-PHASE-ALL (data-phase / syncDOMState REQUIRED FOR ALL GAME TYPES, NOT JUST MCQ):
    ALL games with 2 or more named phases (start_screen → playing → results, or gameplay → results, etc.)
    MUST call syncDOMState() at each phase transition, regardless of game type.
    This applies to ALL game types: MCQ, drag-and-drop, card-matching, card-flip, puzzle, canvas, shell/cup
    games, multi-step interaction, text-input, worked-example — any interactive game type without exception.
    The test harness reads data-phase for flow assertions on ALL game types.

    WRONG (drag-and-drop — missing syncDOMState; harness waitForPhase('results') times out):
      function showResults() { document.getElementById('results-screen').style.display = 'block'; }

    WRONG (card-matching — missing syncDOMState; data-phase stays 'playing' forever):
      function endGame() { document.getElementById('win-screen').classList.remove('hidden'); }

    RIGHT (any game type — set phase then syncDOMState before showing new screen):
      function showResults() {
        gameState.phase = 'results';
        syncDOMState();
        document.getElementById('results-screen').style.display = 'block';
      }

    WHY: The test harness waitForPhase() polls #app[data-phase] — if syncDOMState() is not called
    immediately after the phase assignment, waitForPhase() times out regardless of game type.
    This is NOT an MCQ-only concern. ANY game type that skips syncDOMState() will have 100% game-flow
    test failures. (math-cross-grid spec F4 — first confirmed non-MCQ instance; rule applies universally)

44. GEN-TIMER-ONLY (timer.start() MUST ONLY APPEAR IN renderRound(), NEVER IN setupGame()):
    For timer-based games, timer.start() MUST ONLY be called inside renderRound() (or loadQuestion()).
    NEVER call timer.start() in setupGame() or startGame().
    Pattern: setupGame() → renderRound() → timer.start().
    Calling timer.start() in setupGame() BEFORE renderRound() creates a race condition: if timer fires
    onEnd before renderRound() runs, handleTimeout() executes with currentQuestion===null, crashing the game.

    WRONG — timer.start() in setupGame() fires before renderRound() sets currentQuestion:
      function setupGame() {
        timer.start();  // ← WRONG: timer running before round data is set
        renderRound();  // ← currentQuestion not ready when timer fires
      }

    RIGHT — timer.start() only inside renderRound():
      function renderRound() {
        currentQuestion = questions[gameState.currentRound];  // data ready first
        timer.start();  // ← timer fires only after round data is set
      }

    WHY: timer.start() must only be called AFTER renderRound() sets currentQuestion. Placing it before
    renderRound() in setupGame() means handleTimeout(null) can crash immediately.
    (addition-mcq-blitz spec audit, 1 confirmed instance; CR-016)

45. GEN-TRANSITION-API / GEN-TS-ONEARG (transitionScreen.show() ONE-ARGUMENT OBJECT API — MANDATORY):
    transitionScreen.show() MUST always be called with ONE argument — the config object.
    NEVER pass a string as the first argument — there is NO string-mode shorthand in the CDN API.

    WRONG (two-arg: string screen-type + config object — renders blank white screen with no buttons):
      transitionScreen.show('start', { title: 'Ready?', icons: [], buttons: [...] });
      // CDN receives: config = 'start' (a string). Destructuring {title,buttons,icons} from a string → all undefined.

      transitionScreen.show('victory', { score: 10, onRestart: restartGame });
      transitionScreen.show('gameover', { ... });
      transitionScreen.show('results', { ... });
      transitionScreen.show('start', config);  // variable form — same breakage

    WRONG PATTERN CONSEQUENCE: If the two-arg pattern is used for ALL show() calls (start, between-round,
    victory, game-over, restart), EVERY transition screen is blank and has no buttons — the game is
    completely unplayable from first load. This is exactly what happened in keep-track #503 — P0-A.

    RIGHT (object API — always, exactly ONE argument):
      await transitionScreen.show({
        icons: ['🎉'],
        title: 'Well Done!',
        subtitle: 'You completed all rounds',
        buttons: [{ text: 'Play Again', type: 'primary', action: restartGame }]
      });

    WHY: The CDN TransitionScreenComponent.show(config) takes ONE argument. When a string is passed as
    the first argument, config='start' (a string) — destructuring {title, buttons, icons} from a string
    gives all undefined. A blank white screen with no buttons renders. The user is stranded.
    CONFIRMED: which-ratio #561 (victory only, BROWSER-P0-001); keep-track #503 (ALL screens broken, P0-A)

46. GEN-TRANSITION-ICONS (icons array MUST contain emoji strings or empty array — NEVER markup or file paths):
    The icons array in transitionScreen.show() MUST contain plain emoji strings only, or be an empty array [].
    NEVER pass SVG markup, HTML strings, or local file paths — all produce broken output.

    WRONG (SVG markup — renders as raw code text filling the screen):
      icons: ['<svg xmlns="http://www.w3.org/2000/svg"><path d="..."/></svg>']

    WRONG (HTML tag — rendered as literal string):
      icons: ['<img src="star.png">']

    WRONG (local file path — 404 in CDN deployment, no local assets dir):
      icons: ['assets/game_find_triangle_side_icon.svg']   ← find-triangle-side #549 confirmed 404
      icons: ['/images/trophy.png']                        ← absolute path — does not exist in CDN
      icons: ['./icons/star.svg']                          ← relative path — 404

    RIGHT (emoji string — renders correctly as Unicode):
      icons: ['🎉']
      icons: ['⭐', '🏆']
      icons: ['📐']
      icons: []                                            ← empty array is valid — no icons shown

    WHY: The CDN TransitionScreenComponent inserts icon values into <span> elements using
    textContent (not innerHTML). textContent HTML-escapes all markup, so SVG strings appear as
    raw angle-bracket code visible across the entire screen. Local file paths (assets/, /images/, ./)
    DO NOT EXIST in CDN-deployed builds — the built artifact has no local filesystem access and any
    path reference will 404. Emoji are plain Unicode — they render correctly in any <span> via textContent.
    (which-ratio #561 browser audit, BROWSER-P0-002; find-triangle-side #549 UI-FTS-005 — 2 confirmed instances)

47. GEN-PROGRESSBAR-LIVES (totalLives MUST be a positive integer — NEVER 0 or negative):
    The totalLives field in the ProgressBarComponent constructor MUST be a positive integer (≥1).
    NEVER pass 0, null, undefined, or a negative value.

    WRONG (totalLives: 0 — RangeError on every progressBar.update() call):
      new ProgressBarComponent({ totalLives: 0, totalRounds: 5, slotId: 'mathai-progress-slot' });

    RIGHT (totalLives from gameState, always ≥1):
      new ProgressBarComponent({ totalLives: gameState.totalLives, totalRounds: gameState.totalRounds, slotId: 'mathai-progress-slot' });
      new ProgressBarComponent({ totalLives: 3, totalRounds: 9, slotId: 'mathai-progress-slot' });

    For no-lives games (unlimited lives, learning mode): pass totalLives equal to totalRounds,
    then call progressBar.update(currentRound, 0) — this produces a round-progress-only bar with
    no life indicators depleting.

    WHY: The CDN ProgressBar computes a lives indicator repeat count as (totalLives - currentLives).
    If totalLives=0 and the game tracks currentLives=5 internally, the repeat count is 0-5 = -5 —
    a RangeError: "Invalid count value: -5" crashes progressBar.update() on every single round.
    (which-ratio #561 browser audit, BROWSER-NEW-001; see also GEN-112 for progressBar.update() arg order)

48. GEN-SVG-CONTRAST (SVG STROKE/FILL COLORS — WCAG 1.4.11 Non-Text Contrast required):
    SVG stroke and fill colors MUST meet WCAG 1.4.11 Non-Text Contrast (≥3:1 for UI components against background).
    NEVER use: stroke="#64748b" (fails 3:1 in CDN grey/dark contexts),
               fill="#94a3b8" (2.56:1 — fails both standards), fill="#6b7280" (fails in CDN non-white contexts)
    ALWAYS use: stroke="#374151" (9.3:1 on white), stroke="#1f2937" (14:1 on white),
                or stroke="currentColor" (inherits accessible text color)

    WRONG:
      <path stroke="#64748b" .../>          ← borderline fail at small sizes (find-triangle-side #549)
      <circle fill="#94a3b8" .../>          ← 2.56:1, fails WCAG 1.4.11 Non-Text Contrast
      <line stroke="#6b7280" .../>          ← fails in CDN grey/dark contexts

    RIGHT:
      <path stroke="#374151" .../>          ← 9.3:1 on white — passes WCAG 1.4.11 Non-Text Contrast
      <path stroke="#1f2937" .../>          ← 14:1 on white — exceeds WCAG 1.4.11 Non-Text Contrast
      <path stroke="currentColor" .../>     ← inherits accessible text color from CSS

    WHY: SVG UI components must meet WCAG 1.4.11 Non-Text Contrast (3:1 minimum), not the 4.5:1 text
    standard. These colors fail 3:1 against the CDN slot backgrounds — not all fail on pure white
    but many fail in the CDN's grey/dark contexts. #94a3b8 fails both standards at 2.56:1.
    (find-triangle-side #549 UI-FTS-007, which-ratio #561 — 2 confirmed instances)

49. GEN-LOCAL-ASSETS (NO LOCAL FILE PATHS — all assets must be CDN URLs, emoji, or inline SVG):
    NEVER reference local file paths for images, icons, or SVG files. All asset references MUST be:
    (1) absolute CDN URLs (https://...), (2) plain emoji strings in icons arrays,
    or (3) inline SVG markup directly in HTML (not as file references).

    WRONG:
      icons: ['assets/game_find_triangle_side_icon.svg']   ← 404 in CDN deployment (find-triangle-side #549)
      <img src="assets/triangle.png">                      ← local path not available in CDN
      <img src="../images/icon.svg">                        ← relative path — 404
      url('assets/bg.png')                                  ← CSS asset relative path — 404

    RIGHT:
      icons: ['📐']                                        ← emoji renders without any file load
      icons: ['🎉', '⭐']                                  ← multiple emoji as icon array
      <img src="https://cdn.example.com/triangle.png">     ← absolute CDN URL
      <svg xmlns="..."><path d="..."/></svg>               ← inline SVG — no file load needed

    WHY: Games are served from CDN with no access to the local filesystem. Any relative path
    starting with 'assets/', 'images/', '../', or './' will 404. The TransitionScreenComponent
    icons array also 404s on relative paths — it tries to load the string as an <img> src.
    (find-triangle-side #549 UI-FTS-005 — 1 confirmed instance)

50. **GEN-SIGNAL-RESET: restartGame() must re-instantiate SignalCollector**
    WRONG: function restartGame() { gameState.currentRound = 0; /* ... */ showStartScreen(); }         // collector still sealed — session 2+ signals silently lost
    WRONG: function restartGame() { signalCollector.reset(); gameState.currentRound = 0; /* ... */ showStartScreen(); }  // reset() does NOT exist in CDN API — throws TypeError
    RIGHT: function restartGame() {
      signalCollector = new SignalCollector({
        sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
        studentId: window.gameVariableState?.studentId || null,
        templateId: gameState.gameId || null
      });
      gameState.currentRound = 0; /* ... */ showStartScreen();
    }
    WHY: endGame() calls signalCollector.seal() to finalize the postMessage payload. A sealed collector silently ignores all subsequent recordViewEvent()/startProblem() calls — all analytics in session 2+ are silently lost. DO NOT call signalCollector.reset() — it does not exist in the CDN API and throws TypeError. Re-instantiation is the only safe reset.
    CONFIRMED FAILURE: real-world-problem #564 — every round in a restarted session emits zero signals (sealed collector). Analytics show session 1 data only.

51. LP-PROGRESSBAR-CLAMP (LIVES VALUE MUST BE CLAMPED BEFORE progressBar.update()):
    Before calling progressBar.update(), ALWAYS clamp lives to 0 with Math.max(0, gameState.lives).
    NEVER pass gameState.lives directly — lives can go negative when a life is lost while already at 0.

    WRONG (RangeError on every round after player runs out of lives):
      progressBar.update(gameState.currentRound, gameState.lives);
      // If lives went to -1, repeat(-1) throws RangeError: "Invalid count value: -1"

    RIGHT (clamped — always safe):
      const displayLives = Math.max(0, gameState.lives);
      progressBar.update(gameState.currentRound, displayLives);

    WHY: ProgressBarComponent.update(currentRound, livesRemaining) computes String.prototype.repeat(livesRemaining)
    internally to render heart icons. If livesRemaining is -1, repeat(-1) throws RangeError immediately —
    the exception is caught by DOMContentLoaded catch, replacing body with an error message, destroying
    #gameContent, and failing ALL remaining tests. This accounts for ~50% of LP (level-progression) failures.
    T1 check W14 (LP-PROGRESSBAR-CLAMP) will reject any HTML that calls progressBar.update(..., gameState.lives)
    without a Math.max(0, ...) wrapper.

52. GEN-PROGRESSBAR-DESTROY (NEVER setTimeout-destroy ProgressBarComponent — null-trap crashes restartGame()):
    NEVER use setTimeout to destroy ProgressBarComponent and set it to null. CDN components have no reason
    to be destroyed after endGame() — they persist safely in their slot. Destroying and null-assigning creates
    a null-trap: restartGame() calls progressBar.update() 10+ seconds later → TypeError: Cannot read
    properties of null (reading 'update') — P0: the game cannot be restarted after the first play.

    WRONG (null-trap — restartGame() crashes after 10s):
      function endGame() {
        // ...
        setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000); // ← NEVER do this
      }
      function restartGame() {
        progressBar.update({ progress: 0, label: 'Q1' }); // ← TypeError: null crash if called after 10s
      }

    RIGHT (leave progressBar alive — just update its visual state):
      function endGame() {
        // Do NOT destroy progressBar. Just update state to show end-of-game display.
        // progressBar.destroy(); ← REMOVE THIS
        progressBar.update(gameState.totalRounds, 0); // visually reset — component stays alive
      }
      function restartGame() {
        progressBar.update(1, gameState.totalLives); // SAFE — progressBar is still alive
      }

    OR if destroy is truly required (rare — justify in a comment):
      function restartGame() {
        if (!progressBar) {
          progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', autoInject: true,
            totalRounds: gameState.totalRounds, totalLives: gameState.totalLives });
        }
        progressBar.update(1, gameState.totalLives);
      }

    WHY: ProgressBarComponent is a CDN wrapper that persists in its injected slot. Destroying it serves no
    purpose — the slot stays in the DOM, the component just becomes unreachable. The real cost is the null
    assignment: 10s after endGame(), progressBar === null. Any restartGame() click after that throws
    TypeError immediately, crashing the game permanently. There is no visible benefit and a guaranteed P0
    crash path. (right-triangle-area #543 browser audit P0, UI-RTA-B-001)

53. CT-POSTMESSAGE-REQUIRED (postMessage MUST be unconditional — NEVER inside optional branches):
    window.parent.postMessage MUST be called unconditionally inside endGame() — on BOTH the victory
    AND game-over path. It MUST NOT be inside a try/catch, an if-block, or any optional branch that
    can silently skip the call.

    WRONG (conditional — game_over path never sends message):
      if (outcome === 'victory') {
        window.parent.postMessage({ type: 'game_complete', ... }, '*');
      }

    WRONG (try/catch — error silently skips postMessage):
      try {
        const payload = buildPayload();  // if buildPayload() throws, postMessage is never reached
        window.parent.postMessage(payload, '*');
      } catch(e) { console.error(e); }

    RIGHT (unconditional — always fires):
      // Both paths call postMessage at the bottom of endGame(), no condition:
      window.parent.postMessage({ type: 'game_complete', data: { metrics, attempts, ...signalPayload, completedAt: Date.now() } }, '*');

    ALSO — gameState.events and gameState.attempts MUST be initialized as [] in the gameState object:
    WRONG: window.gameState = { score: 0, lives: 3, phase: 'start', isActive: true, gameEnded: false };
           // events/attempts missing → accessing gameState.events throws TypeError → postMessage never fires
    RIGHT: window.gameState = { gameId: '...', score: 0, lives: 3, phase: 'start', isActive: true,
                                 gameEnded: false, events: [], attempts: [] };

    WHY: The undefined.type TypeError (~55% of CT contract failures) occurs when gameState.events is
    undefined and the code accesses .type on it — this crashes the payload build and silently skips
    postMessage. Parent never receives game_complete → ALL contract tests fail. (~55% of CT failures
    and ~25% of CT failures from injected #mathai-transition-slot button — see CDN_CONSTRAINTS_BLOCK
    for the banned-button rule.)

54. GEN-ENDGAME-GUARD (endGame() re-entry guard MUST use ONLY gameEnded — NEVER !isActive):
    endGame() MUST check ONLY gameState.gameEnded as its guard condition. NEVER add !gameState.isActive
    to the endGame() guard. The isActive flag is set to false in the correct-answer handler (before the
    nextRound() setTimeout fires) — if endGame() also checks !isActive, it exits immediately on a perfect
    playthrough and the results screen is NEVER shown (visual-memory #528 P0).

    WRONG (results screen never shown on perfect playthrough — isActive=false when correct answer is handled):
      function endGame(isVictory) {
        if (gameState.gameEnded || !gameState.isActive) return;  // ← !isActive trips on correct-answer path
        // ... results screen code never reached on perfect game
      }

    RIGHT (only gameEnded used as guard — isActive is irrelevant to endGame):
      function endGame(isVictory) {
        if (gameState.gameEnded) return;   // ← ONLY gameEnded guards endGame
        gameState.gameEnded = true;
        // ... show results
      }

    For double-click protection in answer handlers: use a separate gameState.isProcessing flag in the
    HANDLER only — NEVER use isActive or isProcessing in the endGame() guard itself.
    WHY: isActive is a "currently processing answer" flag, not an "endGame allowed" flag. Mixing these
    two concerns causes endGame() to be blocked on the exact path (correct answer → isActive=false) where
    it must run. (visual-memory #528 P0, first confirmed 2026-03-23)

55. GEN-RESULTS-FIXED (results screen MUST be position:fixed full-viewport overlay — NEVER position:static):
    The results/game-over/completion screen element MUST have position:fixed; top:0; left:0; width:100%;
    height:100%; z-index:100 (or higher) in its CSS declaration. NEVER use position:static or
    position:relative for the results screen element. A static-positioned results screen stacks in normal
    DOM flow and is clipped or unreachable below the 800px fold on a 480×800 mobile viewport.

    WRONG (static position — results screen scrolled off-screen on mobile, unreachable in tests):
      #results-screen {
        display: none;
        /* no position set — defaults to static, stacks at y>800px in DOM flow */
      }

    RIGHT (fixed overlay — covers full viewport, always reachable):
      #results-screen {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        background: #fff;
      }
      /* Then in showResults(): document.getElementById('results-screen').style.display = 'flex'; */

    Apply to: #results-screen, #game-over-screen, #end-screen, #completion-screen, and any full-screen
    overlay that shows game end state. The z-index MUST be ≥100 to appear above ScreenLayout CDN elements.
    WHY: 6 confirmed instances — quadratic-formula, soh-cah-toa, right-triangle-area, word-pairs,
    name-the-sides, find-triangle-side — all used static position, causing the results screen to be
    clipped or invisible on mobile (480×800 viewport). Applies to every game type.

56. GEN-DATA-LIVES-SYNC (LIVES GAMES — syncDOMState() MUST write data-lives attribute):
    For any game where gameState.totalLives > 0 (a lives-based game), syncDOMState() MUST set
    app.dataset.lives = String(gameState.lives). The test harness getLives() function reads
    #app[data-lives] via getAttribute('data-lives') — if this attribute is never written,
    getLives() returns null (parsed as NaN/0) and ALL mechanics assertions on life decrements fail.

    WRONG (data-lives never set — getLives() returns undefined → all lives-decrement tests fail):
      function syncDOMState() {
        const app = document.getElementById('app');
        if (!app) return;
        app.dataset.phase = gameState.phase || 'start';
        app.dataset.round = String(gameState.currentRound || 0);
        app.dataset.score = String(gameState.score || 0);
        // ← MISSING: app.dataset.lives — getLives() reads data-lives, which is never set
      }

    RIGHT (data-lives written for lives games):
      function syncDOMState() {
        const app = document.getElementById('app');
        if (!app) return;
        app.dataset.phase = gameState.phase || 'start';
        app.dataset.round = String(gameState.currentRound || 0);
        app.dataset.score = String(gameState.score || 0);
        if (gameState.totalLives > 0) {
          app.dataset.lives = String(gameState.lives);  // REQUIRED — getLives() reads this
        }
      }

    ALSO WRONG: app.dataset.lives = gameState.lives (number stored directly — may coerce incorrectly).
    RIGHT: app.dataset.lives = String(gameState.lives) — always a string.
    WHY: getLives() runs parseInt(app.getAttribute('data-lives'), 10). If data-lives is absent,
    getAttribute() returns null → parseInt(null, 10) = NaN → expect(lives).toBe(2) always fails.
    This rule applies to ALL games where gameState.totalLives > 0. Non-lives games (totalLives === 0)
    do not need to set data-lives — the GEN-DATA-LIVES-GUARD in test gen already skips lives
    assertions for those games. (Source: UI/UX audit addition-mcq-lives F7; GEN-DATA-LIVES-SYNC)

57. GEN-TESTID-STEP (MULTI-STEP GAMES — data-testids MUST be namespaced per step):
    When a single round contains multiple sequential interactive steps (Step 1, Step 2, etc.)
    that coexist in the DOM simultaneously (regardless of display:none or visibility:hidden state —
    querySelector always returns the FIRST DOM match even when hidden), each step's buttons/inputs
    MUST use a unique prefix.

    WRONG (both Step 1 and Step 2 use same testids — querySelector always hits Step 1):
      <div class="step-panel" id="step1-panel">
        <button data-testid="option-0">A</button>
        <button data-testid="option-1">B</button>
      </div>
      <div class="step-panel" id="step2-panel">
        <button data-testid="option-0">X</button>  <!-- WRONG: duplicate testid -->
        <button data-testid="option-1">Y</button>  <!-- WRONG: duplicate testid -->
      </div>

    RIGHT (each step uses a unique prefix):
      <div class="step-panel" id="step1-panel">
        <button data-testid="part1-option-0">A</button>
        <button data-testid="part1-option-1">B</button>
      </div>
      <div class="step-panel" id="step2-panel">
        <button data-testid="part2-option-0">X</button>
        <button data-testid="part2-option-1">Y</button>
      </div>

    Rule: when multiple interactive steps coexist in the DOM, prefix each step's elements with
    part1-, part2-, step1-, step2-, etc. Never reuse the same data-testid across concurrent steps.
    WHY: querySelector('[data-testid="option-0"]') always returns the first match in DOM order —
    Step 2 buttons are permanently unreachable. (Source: UI/UX audit expression-completer #511 — EC-002)

58. GEN-TESTID-MULTIPLAYER (MULTI-PLAYER GAMES — player-prefixed data-testids MANDATORY):
    When a game has N ≥ 2 simultaneous player areas (both present in DOM at once),
    each player's interactive elements MUST use player-prefix testids.

    WRONG (both P1 and P2 use same testids — querySelector always returns P1):
      <div class="player-area" id="player1-area">
        <button data-testid="option-0">A</button>
        <button data-testid="option-1">B</button>
      </div>
      <div class="player-area" id="player2-area">
        <button data-testid="option-0">X</button>  <!-- WRONG: duplicate testid — P2 unreachable -->
        <button data-testid="option-1">Y</button>  <!-- WRONG: duplicate testid — P2 unreachable -->
      </div>

    RIGHT (each player uses a unique prefix):
      <div class="player-area" id="player1-area">
        <button data-testid="p1-option-0">A</button>
        <button data-testid="p1-option-1">B</button>
      </div>
      <div class="player-area" id="player2-area">
        <button data-testid="p2-option-0">X</button>
        <button data-testid="p2-option-1">Y</button>
      </div>

    Apply to: answer buttons, input fields, any interactive element inside a player container.
    WHY: Both player areas render simultaneously in DOM — querySelector always hits first match,
    making P2 interactions completely untestable via testid selectors.
    (Source: two-player-race #506 UI/UX MEDIUM-003 — 2 instances of each testid in DOM)

59. GEN-WINDOW-NEXTROUNDEXPOSED (window.nextRound MUST always be exposed):
    The test harness requires window.nextRound to advance between rounds. Even if your internal
    function has a different name (roundComplete, loadRound, advanceRound), you MUST expose it
    as window.nextRound.

    WRONG (internal alias exists but window.nextRound is absent):
      function roundComplete() { /* advance to next round */ }
      window.roundComplete = roundComplete;  // WRONG — harness looks for window.nextRound
      // window.nextRound is never assigned → "[ralph-test-harness] MISSING window.nextRound"

    RIGHT (alias assigned to window.nextRound):
      function roundComplete() { /* advance to next round */ }
      window.nextRound = roundComplete;  // alias — harness can call window.nextRound()

    If the game has exactly ONE explicitly defined interaction (one puzzle, no rounds, no levels),
    define a no-op: window.nextRound = () => {};
    When in doubt, use the real advance function — no-op is ONLY for genuinely single-interaction games.

    WHY: Test harness emits "[ralph-test-harness] MISSING window.nextRound: this function is
    not exposed on window" and all round-advancement tests fail silently.
    (Source: UI/UX audit expression-completer #511 — EC-001; adjustment-strategy #385)

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
- GEN-SENTRY-VERSION: IF spec uses PART-030/Sentry, <head> MUST include THREE Sentry v10.23.0 scripts in order: (1) https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js (2) https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js (3) https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js — all with crossorigin="anonymous". BANNED: any v7 single-bundle (sentry-7*.js, @sentry/browser@7). If PART-030=NO, include NO Sentry scripts.
- PART-012 DEBUG FUNCTIONS: debug/test functions (debugGame, testAudio, testPause, testResume, testSentry, verifySentry) MUST be assigned to window: window.debugGame = debugGame; etc. Copy the pattern from the spec verbatim. The spec checklist requires them on window — review rejects if they're missing from window.
- window EXPOSURE: add window.endGame=endGame; window.restartGame=restartGame; window.nextRound=nextRound; window.gameState=gameState; at global scope
- GEN-114. window.loadRound EXPOSURE: CDN games with multiple rounds MUST expose window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); } at global scope. The test harness __ralph.jumpToRound(n) checks for window.loadRound, window.jumpToRound, window.loadQuestion, or window.goToRound — if NONE exist, jumpToRound() is a silent no-op: it sets gameState.currentRound but never updates phase or renders the UI. This leaves data-phase='results' from a prior endGame() call, causing ALL waitForPhase(page, 'playing') calls to timeout → 100% mechanics/level-progression failure. (name-the-sides build #550 — 0/6 mechanics × 3 iterations)
- endGame GUARD: first lines must be: if(gameState.gameEnded)return; gameState.gameEnded=true; gameState.isActive=false;
- GEN-ENDGAME-GUARD: endGame() guard MUST use ONLY gameState.gameEnded — NEVER add !gameState.isActive to the endGame() guard. isActive is set to false in the correct-answer handler before nextRound() fires; if endGame() also checks !isActive it exits early on a perfect playthrough and results screen is never shown. WRONG: if (gameState.gameEnded || !gameState.isActive) return; RIGHT: if (gameState.gameEnded) return; (visual-memory #528 P0)
- GEN-RESULTS-FIXED: results screen MUST use position:fixed; top:0; left:0; width:100%; height:100%; z-index:100 — NEVER position:static or position:relative. WRONG: #results-screen { display: none; } RIGHT: #results-screen { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 100; background: #fff; } (6 confirmed instances — applies to every game type)
- GEN-RESTART-001 (RESTART GAME STATE RESET): restartGame() MUST fully reset ALL gameState fields before calling showStartScreen() or renderRound(). Required resets: gameState.currentRound = 0, gameState.score = 0, gameState.stars = 0, gameState.completed = false, gameState.gameEnded = false, gameState.isActive = true, gameState.isProcessing = false. For games with rounds array: MUST reinitialize gameState.rounds or gameState.content.rounds from the original data source — NEVER read gameState.rounds[currentRound] after restart without reinitializing it first (gameState.rounds is undefined after endGame() clears state). WRONG: function restartGame() { gameState.currentRound = 0; showStartScreen(); } (rounds is now undefined — next renderRound() throws TypeError). RIGHT: function restartGame() { gameState.currentRound = 0; gameState.score = 0; gameState.stars = 0; gameState.completed = false; gameState.gameEnded = false; gameState.isActive = true; gameState.isProcessing = false; gameState.lives = gameState.totalLives; syncDOMState(); showStartScreen(); } — for rounds-based games: also add gameState.rounds = [...fallbackContent.rounds] or re-assign from original data source before calling showStartScreen(). (17 confirmed 'rounds undefined on restart' failures in scoring category)
- CDN URL: ALWAYS storage.googleapis.com/test-dynamic-assets — NEVER cdn.homeworkapp.ai or cdn.mathai.ai. Use ONLY: feedback-manager/index.js, components/index.js, helpers/index.js from https://storage.googleapis.com/test-dynamic-assets/packages/
- PART-003 waitForPackages: timeout=180000ms (3 minutes), MUST throw on timeout (not console.error). CDN loads cold in fresh Playwright browsers (30-150s on GCP) — 120s timeout races against CDN cold-start and loses; use 180000 always. MUST match packages that ARE loaded: if PART-017=YES check FeedbackManager; if PART-017=NO check ScreenLayout (NEVER FeedbackManager — it is not loaded when PART-017=NO, causing guaranteed timeout and gameState staying empty) (Lesson 117, Lesson 143). WRONG: const timeout = 10000 or 5000 or ANY value under 180000. RIGHT: const timeout = 180000. CONFIRMED ROOT CAUSE: adjustment-strategy builds #376-378 had timeout=10000ms → ALL beforeEach calls threw "Packages failed to load" → 0% pass rate across every category in every build. 68 builds, 6 approved (8.8%). A too-low timeout is the single most catastrophic gen failure — it makes every test fail before any game logic is tested. (diagnosis 2026-03-23, TE: ebd5ad8) BANNED NAMES (T1 GEN-WAITFOR-BANNEDNAMES rejects — never CDN globals, white screen guaranteed): Components, Helpers, Utils, Game, App, Module, Lib. WRONG: while (typeof Components === 'undefined' || typeof Helpers === 'undefined') RIGHT: while (typeof ScreenLayout === 'undefined' || typeof ProgressBarComponent === 'undefined' || typeof FeedbackManager === 'undefined') (disappearing-numbers #509 root cause, 2026-03-23)
- ROUND LIFECYCLE RESET: for games where the player can interact IMMEDIATELY after loadRound(), first three lines MUST be: gameState.isProcessing = false; gameState.isActive = true; syncDOMState(); — stale isProcessing=true from prior round silently blocks ALL clicks. EXCEPTION: if the round starts with a REVEAL/PREVIEW animation (dots appear, cards flip, memory tiles show) BEFORE options are rendered, keep gameState.isProcessing = true at the start of loadRound() and only set it to false INSIDE the reveal setTimeout AFTER options are rendered. The test harness answer() waits for isProcessing=false before clicking — if set too early, buttons don't exist yet, click silently fails, timer fires, test desync (Lesson 109, count-and-tap #457).
- GEN-FLIP-RESET: Per-round counters must reset on round transition. Round-scoped counters (flips, moves, attempts, errors) must reset to 0 at the start of each new round. WRONG: display totalFlips which accumulates across all rounds (shows 14 at Round 3 start before any move). RIGHT: reset roundFlips = 0 at the start of each round; display roundFlips not totalFlips. WHY: Cumulative counters across rounds give misleading feedback — a student sees 14 flips at Round 3 start before making any move. Round-scoped counters are the pedagogically correct default. Required pattern: function nextRound() { gameState.currentRound++; gameState.roundFlips = 0; /* ← REQUIRED: reset on each round */ } (Source: memory-flip #505 HIGH-2 — totalFlips shown instead of roundFlips per round)
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
- SYNCDOMESTATE CALL SITES: call syncDOMState() after EVERY gameState.phase assignment — game_init, round complete, transitionScreen buttons.action callback, endGame (gameover + results paths), restartGame — missing any causes waitForPhase() to timeout. GEN-RESTART-PHASE: When restartGame() shows a TransitionScreen interstitial before gameplay resumes, use syncDOMState() with 'start_screen' (NOT 'playing') — phase only becomes 'playing' when actual gameplay starts after the user confirms. WRONG: syncDOMState('playing') at top of restartGame() with interstitial. RIGHT: gameState.phase = 'start_screen'; syncDOMState(); transitionScreen.show({...}). WHY: test harness resolves waitForPhase('playing') too early, clicks during interstitial are ignored, tests timeout. (light-up #508 MEDIUM-3, CR-072)
- POSTMESSAGE REQUIRED FIELDS: CDN games MUST use nested data structure: window.parent.postMessage({ type: 'game_complete', data: { metrics: { /* USE EXACTLY the field names defined in the spec's postMessage/contract section */ }, attempts: gameState.attempts, ...signalPayload, completedAt: Date.now() } }, '*') — NEVER flat top-level fields. CRITICAL: read your spec's postMessage contract and use the EXACT field names it specifies. Do NOT invent field names or use generic defaults. Examples: worked-example games use { stars, accuracy, rounds_completed, wrong_in_practice, duration_ms }; lives-based games use { score, stars, accuracy, livesRemaining }. Contract tests assert the exact fields from the spec — wrong field names cause ALL contract assertions to fail (Lesson 169 — build #545: prompts.js taught livesRemaining/time/duration_data but spec required rounds_completed/wrong_in_practice/duration_ms).
- DATA-TESTID REQUIRED: every <button>, <input>, and <select> element MUST have a data-testid attribute. Required minimums: data-testid="answer-input" (text/number inputs), data-testid="btn-check" or "btn-submit" (submit/check buttons), data-testid="btn-restart" (restart button), data-testid="score-display", data-testid="stars-display", data-testid="lives-display" (if applicable). Multiple-choice buttons: data-testid="option-{index}" (0-indexed). Missing data-testid causes ALL mechanics tests to fail with locator errors.
- GEN-TESTID-MATCH: data-testid value MUST exactly match the element's id attribute. WRONG: <div id="results-screen" data-testid="results"> RIGHT: <div id="results-screen" data-testid="results-screen">. Divergence breaks getByTestId() vs #id selector consistency. (word-pairs audit #529)
- GEN-TESTID-MULTIPLAYER: Multi-player games must use player-prefixed data-testids. When a game has N ≥ 2 simultaneous player areas (both present in DOM at once), each player's interactive elements must use player-prefix testids. WRONG: Both P1 and P2 buttons use data-testid="option-0" — querySelector returns P1 always, P2 is permanently untestable. RIGHT: P1 buttons: data-testid="p1-option-0", P2 buttons: data-testid="p2-option-0". WHY: Both player areas render simultaneously in DOM — querySelector always hits first match, making P2 interactions completely untestable via testid selectors. Apply to: answer buttons, input fields, any interactive element inside a player container. (Source: two-player-race #506 UI/UX MEDIUM-003 — 2 instances of each testid in DOM)
- GEN-GRID-TESTID (puzzle/grid games): For games with a puzzle grid (light-up, kakuro, nonogram, crossword, spatial), the grid container MUST use data-testid="game-grid", NOT data-testid="answer-input". Interactive cells: data-testid="cell-R-C" (R=row, C=col, 0-indexed). WRONG: <div class="game-grid" data-testid="answer-input"> RIGHT: <div class="game-grid" data-testid="game-grid"> WHY: "answer-input" implies a text input to Playwright; "game-grid" is semantically correct for spatial puzzles. (light-up #508 HIGH-3, CR-072)
- TRANSITIONSCREEN AWAIT (GEN-117): ALL transitionScreen.show() calls MUST use await — write: await transitionScreen.show({...}). Without await, the CDN TransitionScreenComponent resolves before animation completes; buttons stay visibility:hidden on all subsequent show() calls; mechanics tests time out at 15000ms. WRONG: transitionScreen.show({...}); RIGHT: await transitionScreen.show({...}); CONFIRMED: adjustment-strategy build #381 — 3/3 calls unawaited → ALL mechanics tests failed with TimeoutError. (diagnosis 2026-03-23, TE: ebd5ad8)
- GAMESTATE isActive INIT: window.gameState MUST include isActive: true in its initial object (e.g. window.gameState = { ..., isActive: true, gameEnded: false }). Every handler checks if(!gameState.isActive)return — if not initialized, ALL interactions are blocked from the start.
- GEN-112: ProgressBarComponent MUST use options-object API — NEVER a positional string:

  WRONG (causes silent crash → transitionScreen button never dismisses):
    progressBar = new ProgressBarComponent('mathai-progress-bar-slot', { totalRounds: 5 });
    progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives); // 3 args

  RIGHT:
    progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: gameState.totalRounds, totalLives: gameState.totalLives, slotId: 'mathai-progress-slot' });
    if (progressBar) progressBar.update(gameState.currentRound, gameState.lives); // 2 args, null-guarded

  CRITICAL WRONG PATTERNS (cause RangeError: Invalid count value — negative repeat count):
    WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds); // 2nd arg is NOT totalRounds
    WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives); // 3-arg form does not exist
  CORRECT (always):
    progressBar.update(gameState.currentRound, gameState.lives); // 2nd arg is ALWAYS lives remaining
    // For no-lives games: progressBar.update(gameState.currentRound, 0);
  (which-ratio #559/#560/#561 all failed: "RangeError: Invalid count value: -5" — totalRounds=5 passed as lives to totalLives=0 bar)

- GEN-UX-003: ProgressBarComponent slotId MUST be the EXACT string 'mathai-progress-slot'. 4 confirmed wrong variants break the ProgressBar silently:

  WRONG:
    new ProgressBarComponent('#mathai-progress-slot', {...})     ← hash prefix — slot not found
    new ProgressBarComponent('mathai-progress-bar', {...})      ← wrong name — slot not found
    new ProgressBarComponent('mathai-progress-bar-slot', {...}) ← positional string (no slotId key)
    new ProgressBarComponent({ slotId: 'mathai-progress-bar-slot', ... }) ← wrong slotId value

  RIGHT:
    progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', autoInject: true, totalRounds: gameState.totalRounds, totalLives: gameState.totalLives });

- GEN-UX-004: NEVER use alert(), confirm(), or prompt() in game code. These block the main thread and break iframe embedding.

  WRONG:
    if (isNaN(value)) { alert('Please enter a valid number'); return; }

  RIGHT:
    if (isNaN(value)) {
      feedbackEl.textContent = 'Please enter a valid number';
      feedbackEl.setAttribute('aria-live', 'polite');
      feedbackEl.classList.remove('hidden');
      return;
    }

- GEN-UX-005: SignalCollector MUST always be instantiated with required constructor arguments. Omitting them silently produces invalid analytics payloads missing templateId, sessionId, and studentId.

  WRONG:
    signalCollector = new SignalCollector();           ← no args — templateId/sessionId/studentId all undefined
    signalCollector = new window.SignalCollector();    ← no args — same problem

  RIGHT:
    signalCollector = new SignalCollector({
      sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
      studentId: window.gameVariableState?.studentId || null,
      templateId: gameState.gameId || null
    });
- GEN-SIGNAL-RESET: restartGame() must re-instantiate SignalCollector before showStartScreen() — endGame() seals the collector; signalCollector.reset() does NOT exist in CDN API (throws TypeError); only re-instantiation safely resets it. See rule 50 for the required RIGHT pattern.
- GEN-MCQ-PHASE / GEN-PHASE-MCQ-FULL (ALL GAMES — MANDATORY data-phase state machine — ALL 4 syncDOMState() call sites REQUIRED): EVERY Ralph pipeline game MUST declare data-phase transitions. This is NOT optional for any game type — drag-and-drop, canvas, worked-example, text-input, and MCQ games all require it. Each function that changes game phase MUST set gameState.phase AND call syncDOMState() immediately after — in this exact order. ALL 4 REQUIRED CALL SITES:
  (1) showStartScreen()  → gameState.phase = 'start';    syncDOMState();  // before transitionScreen.show() — WRONG: omit syncDOMState → waitForPhase('start') times out
  (2) startGame()/renderRound() → gameState.phase = 'playing'; syncDOMState(); // before rendering options — WRONG: renderOptions() before syncDOMState → data-phase still 'start'
  (3) endGame() lives=0  → gameState.phase = 'gameover'; syncDOMState();  // BEFORE TransitionScreen.show() — WRONG: show TransitionScreen first → waitForPhase('gameover') races
  (4) endGame() lives>0  → gameState.phase = 'results';  syncDOMState();  // BEFORE TransitionScreen.show() or showResults() — WRONG: missing → waitForPhase('results') times out
  WRONG: gameState.phase = 'playing'; renderOptions(); (syncDOMState() missing or deferred after any of the 4 call sites)
  RIGHT: gameState.phase = 'playing'; syncDOMState(); renderOptions();
  WHY: syncDOMState() writes gameState.phase to #app[data-phase]. waitForPhase() in tests polls data-phase — if syncDOMState() is not called immediately after the assignment, waitForPhase() times out and 100% of game-flow tests fail. Missing even ONE of the 4 call sites causes all tests dependent on that phase to fail. (Root cause: 22% game-flow failures across ALL game types including drag-and-drop math-cross-grid F4 — first confirmed non-MCQ instance)
- GEN-MCQ-TIMER (MCQ/TIMED GAMES — timer.start() placement): timer.start() MUST be called ONLY inside renderRound() — NEVER inside setupGame() or startGame(). Calling timer.start() in setupGame() and then timer.reset() in renderRound() creates a race condition: the timer fires its onEnd callback before the first round is rendered, triggering endGame() on an empty gameState. WRONG: function setupGame() { timer = new TimerComponent(...); timer.start(); } RIGHT: function setupGame() { timer = new TimerComponent(...); } function renderRound() { timer.reset(); timer.start(); /* start ONLY here */ } (Source: addition-mcq-blitz spec audit)
- GEN-STEP-001 (STEP-BASED ROUND RESET — MANDATORY for any game with sequential step panels): If the game has multiple sequential step panels (e.g. step1-panel, step2-panel, step3-panel), the round reset logic MUST follow this exact sequence: (1) hide ALL step panels explicitly — document.querySelectorAll('[data-step]').forEach(el => el.style.display = 'none'); (2) set gameState.step = 'step1' and gameState.phase = 'playing'; (3) call syncDOMState(); (4) show only step1 panel. WRONG: function startRound(n) { gameState.step = 'step1'; syncDOMState(); } — step3-panel remains visible from last round. RIGHT: hide all panels first, then sync, then show step1. The syncDOMState() call alone does NOT hide step panels — explicit DOM manipulation is ALWAYS required at round start. Evidence: real-world-problem builds #563, #564, #565 — level-progression test failed across 5 fix attempts because step3-panel was not explicitly hidden at round start.
- GEN-112: ProgressBarComponent MUST use options-object API — NEVER a positional string. progressBar.update() takes EXACTLY 2 args: (currentRound, livesRemaining). The 2nd arg is ALWAYS lives remaining — NEVER totalRounds. CRITICAL WRONG PATTERNS (cause RangeError: Invalid count value — negative repeat count): progressBar.update(gameState.currentRound, gameState.totalRounds) — 2nd arg is NOT totalRounds; progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives) — 3-arg form does not exist. CORRECT: progressBar.update(gameState.currentRound, gameState.lives); // For no-lives games: progressBar.update(gameState.currentRound, 0); (which-ratio #559/#560/#561 all failed: "RangeError: Invalid count value: -5" — totalRounds=5 passed as lives to totalLives=0 bar)
- GEN-RESTART-RESET (RESTART MUST RESET ALL MUTABLE GAMESTATE FIELDS): restartGame() MUST reset ALL mutable gameState fields before calling showStartScreen(). PRINCIPLE: For ANY field initialized in DOMContentLoaded / setupGame() / startGame(), reset it in restartGame() — INCLUDING ALL CUSTOM GAME-SPECIFIC FIELDS (e.g. selectedCards, currentWord, streak, selectedPairs, matchedCount, boardState). T1 check W13 catches standard fields (lives/currentRound/score/events/attempts/phase/gameEnded) but NOT custom fields — missing custom resets cause second-playthrough bugs invisible to static validation. WRONG (only resets standard fields, custom fields persist from session 1): function restartGame() { gameState.gameEnded = false; gameState.phase = 'start'; syncDOMState(); showStartScreen(); } RIGHT (resets ALL fields — standard + every custom field this game uses): function restartGame() { gameState.currentRound = 0; gameState.lives = gameState.totalLives; gameState.score = 0; gameState.events = []; gameState.attempts = []; gameState.gameEnded = false; gameState.phase = 'start'; /* reset custom fields from DOMContentLoaded: */ gameState.selectedPairs = []; gameState.currentWord = null; syncDOMState(); signalCollector = new SignalCollector({ sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(), studentId: window.gameVariableState?.studentId || null, templateId: gameState.gameId || null }); window.signalCollector = signalCollector; showStartScreen(); } WHY: 3 confirmed browser instances — quadratic-formula #546, find-triangle-side #549, associations #472. (CR-032; CR-014)
- GEN-PHASE-ALL (data-phase / syncDOMState REQUIRED FOR ALL GAME TYPES, NOT JUST MCQ): ALL games with 2 or more named phases MUST call syncDOMState() at each phase transition, regardless of game type. Applies to ALL types: MCQ, drag-and-drop, card-matching, card-flip, puzzle, canvas, shell/cup, multi-step, text-input, worked-example — no exceptions. WRONG (any game type — no syncDOMState): function showResults() { document.getElementById('results-screen').style.display = 'block'; } RIGHT (any game type): function showResults() { gameState.phase = 'results'; syncDOMState(); document.getElementById('results-screen').style.display = 'block'; } WHY: harness waitForPhase() polls #app[data-phase] — missing syncDOMState() causes 100% game-flow failures on ANY game type. (math-cross-grid spec F4 — first non-MCQ instance; applies universally)
- GEN-TIMER-ONLY (timer.start() MUST ONLY APPEAR IN renderRound(), NEVER IN setupGame()): For timer-based games, \`timer.start()\` MUST ONLY be called inside \`renderRound()\` (or \`loadQuestion()\`). NEVER call \`timer.start()\` in \`setupGame()\` or \`startGame()\`. WRONG: function setupGame() { renderRound(); timer.start(); } RIGHT: function renderRound() { /* load question */ timer.start(); } WHY: timer.start() in setupGame() creates a race condition — if timer fires onEnd before renderRound() sets currentQuestion, handleTimeout(null) crashes immediately. (addition-mcq-blitz spec audit, 1 confirmed instance)
- GEN-TRANSITION-API (GEN-TS-ONEARG): transitionScreen.show() MUST be called with ONE argument only — the config object. NEVER pass a string as first argument. WRONG: transitionScreen.show('start', { title: 'Ready?', buttons: [...] }); — TWO args: CDN receives config='start' (string), all fields undefined. WRONG: transitionScreen.show('victory', { ... }); WRONG: transitionScreen.show('gameover', { ... }); WRONG: transitionScreen.show('start', config); — variable form still two args, still broken. RIGHT: transitionScreen.show({ icons: ['🎉'], title: 'Well Done!', subtitle: '...', buttons: [{ text: 'Play Again', type: 'primary', action: restartGame }] }); WHY: CDN show(config) takes ONE arg — string as first arg gives config='start', all destructured fields undefined → blank screen, no buttons. If EVERY show() call uses this two-arg pattern (start + between-round + victory + game-over + restart), the ENTIRE game is unplayable from load. (which-ratio #561 BROWSER-P0-001 — victory only; keep-track #503 P0-A — ALL screens broken)
- GEN-TRANSITION-ICONS: icons array in transitionScreen.show() MUST contain plain emoji strings or be an empty array []. NEVER SVG markup, HTML strings, or local file paths. WRONG: icons: ['<svg ...>...</svg>']; WRONG: icons: ['<img src="star.png">']; WRONG: icons: ['assets/game_icon.svg'] (local path — 404 in CDN builds); WRONG: icons: ['/images/trophy.png'] (absolute path — 404); RIGHT: icons: ['🎉'] or icons: ['⭐', '🏆'] or icons: []; WHY: CDN inserts icons via textContent (not innerHTML) — SVG/HTML markup is HTML-escaped and rendered as raw visible code text covering the screen. Local file paths (assets/, /images/, ./) DO NOT EXIST in deployed builds — they 404. (which-ratio #561 BROWSER-P0-002; find-triangle-side #549 UI-FTS-005)
- GEN-PROGRESSBAR-LIVES: totalLives in ProgressBarComponent constructor MUST be a positive integer (≥1). NEVER pass 0, null, undefined, or negative. WRONG: new ProgressBarComponent({ totalLives: 0, totalRounds: 5, slotId: 'mathai-progress-slot' }); RIGHT: new ProgressBarComponent({ totalLives: gameState.totalLives, totalRounds: gameState.totalRounds, slotId: 'mathai-progress-slot' }); WHY: CDN computes repeat count as (totalLives - currentLives); if totalLives=0 result is negative — RangeError crashes progressBar.update() every round. For no-lives games pass totalLives=totalRounds and call progressBar.update(currentRound, 0). (which-ratio #561 BROWSER-NEW-001)
- GEN-SVG-CONTRAST: SVG stroke and fill colors MUST meet WCAG 1.4.11 Non-Text Contrast (≥3:1 for UI components against background). NEVER use: stroke="#64748b" (fails 3:1 in CDN grey/dark contexts), fill="#94a3b8" (2.56:1 — fails both standards), fill="#6b7280" (fails in CDN non-white contexts). ALWAYS use: stroke="#374151" (9.3:1 on white), stroke="#1f2937" (14:1 on white), or stroke="currentColor" (inherits accessible text color). WHY: these colors fail WCAG 1.4.11 Non-Text Contrast (3:1 minimum for UI components) against the CDN slot backgrounds — not all fail on pure white but many fail in the CDN's grey/dark contexts. (find-triangle-side #549 UI-FTS-007, which-ratio #561 — 2 confirmed instances)
- GEN-LOCAL-ASSETS: NEVER reference local file paths for assets (images, icons, SVGs). All asset references must be (1) CDN URLs (https://...), (2) plain emoji strings in icons arrays, or (3) inline SVG markup in HTML. WRONG: icons: ['assets/game_icon.svg'] — 404s in CDN deployment. WRONG: <img src="assets/triangle.png"> — local path not available. RIGHT: icons: ['📐'] — emoji renders without any file load. RIGHT: inline <svg>...</svg> markup. WHY: Games are served from CDN with no local filesystem access — any relative path starting with 'assets/', 'images/', '../', or './' will 404. (find-triangle-side #549 UI-FTS-005 — 1 confirmed instance)
- GEN-SLOT-A11Y: Interactive slot/grid divs MUST have role="button", tabindex="0", and a descriptive aria-label. WRONG: <div class="slot-cell" onclick="selectSlot(this)"> (no role, no aria-label, tabIndex=-1 — invisible to screen readers). RIGHT: <div class="slot-cell" role="button" tabindex="0" aria-label="hundreds position" onclick="selectSlot(this)">. WHY: clickable divs without role="button" are invisible to screen readers and keyboard-unreachable. Any div with onclick that represents an interactive game element (position slot, grid cell, card slot, answer slot, drag target) must have role="button", tabindex="0", and a descriptive aria-label. (position-maximizer #507 — all slot cells had role=null, aria-label=null, tabIndex=-1)
- GEN-CARD-A11Y: Memory/flip game cards must have ARIA role + label + tabindex. For games where cards or tiles are the primary interactive targets (memory-flip, match-the-cards, pairs): WRONG: <div class="card" onclick="flipCard(this)"> (no role, no aria-label, tabIndex=-1). RIGHT: <div class="card" role="button" tabindex="0" aria-label="card 3, face down" onclick="flipCard(this)">. On flip: update aria-label to describe revealed content: aria-label="card 3: lion (revealed)". On match: aria-label="card 3: lion (matched)". WHY: Card games are entirely pointer-driven without role="button" + keyboard support. Screen readers cannot announce card state (face-down, revealed, matched). (Source: memory-flip #505 — all 12 cards had role=null, tabIndex=-1, aria-label=null)
- LP-PROGRESSBAR-CLAMP: ALWAYS clamp lives before progressBar.update() — WRONG: progressBar.update(gameState.currentRound, gameState.lives); RIGHT: const displayLives = Math.max(0, gameState.lives); progressBar.update(gameState.currentRound, displayLives); WHY: repeat(-1) throws RangeError: "Invalid count value: -1" — crashes every round after lives hit 0. (~50% of LP failures)
- GEN-PROGRESSBAR-DESTROY: NEVER setTimeout-destroy ProgressBarComponent. WRONG: setTimeout(() => { progressBar.destroy(); progressBar = null; }, 10000); — restartGame() crashes with TypeError: Cannot read properties of null after 10s (P0: game unrestartable). RIGHT: leave progressBar alive; call progressBar.update(gameState.totalRounds, 0) to visually reset in endGame(). If destroy is unavoidable: guard restartGame() with if (!progressBar) { progressBar = new ProgressBarComponent({ slotId: 'mathai-progress-slot', ... }); } before every call. (right-triangle-area #543 browser audit P0 UI-RTA-B-001)
- CT-POSTMESSAGE-REQUIRED: window.parent.postMessage MUST be called unconditionally inside endGame() on BOTH victory and game-over paths — NEVER inside an if-block or try/catch that can silently skip it. ALSO: gameState.events and gameState.attempts MUST be initialized as [] in window.gameState init — undefined events throws TypeError that cancels postMessage entirely. WRONG: if (outcome === 'victory') { postMessage(...) } WRONG: try { buildPayload(); postMessage(...) } catch(e){} RIGHT: postMessage({...}, '*') called unconditionally at bottom of endGame(). (~55% of CT contract failures)
- GEN-DATA-LIVES-SYNC: For lives games (gameState.totalLives > 0), syncDOMState() MUST set app.dataset.lives = String(gameState.lives). The test harness getLives() reads #app[data-lives] — if never set, getLives() returns NaN and ALL lives-decrement assertions fail. WRONG: syncDOMState() that omits app.dataset.lives. RIGHT: include if (gameState.totalLives > 0) { app.dataset.lives = String(gameState.lives); } inside syncDOMState(). (Source: UI/UX audit addition-mcq-lives F7; GEN-DATA-LIVES-SYNC)
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
    : `CURRENT HTML:\n${currentHtml}`;
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
- "contract": gameOver postMessage event (type, score, stars, total fields). MANDATORY: must include BOTH a victory-path test (skipToEnd 'victory' → postMessage fires) AND a game_over-path test (skipToEnd 'game_over' → postMessage ALSO fires). The game_over test is required — messaging category 56% pass rate is caused by missing this test case.

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

BANNED TEST SELECTORS — using any of these causes 100% test batch failure:
⛔ '#mathai-transition-slot button' — NEVER use as a locator in toBeVisible(), not.toBeVisible(), toHaveText(), click(), or expect.poll() outside of the clickNextLevel() helper.
   WHY: The CDN empties #mathai-transition-slot immediately after startGame() returns. After that, no button exists in this slot between rounds on auto-advance games, during contract flows using skipToEnd(), or at any point in game-flow tests. Direct assertions on this selector cause ALL tests in the batch to fail simultaneously.
   ONLY clickNextLevel() may interact with '#mathai-transition-slot button' — it is already implemented for you.
   WRONG: await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible();
   WRONG: await page.locator('#mathai-transition-slot button').first().click(); // outside clickNextLevel
   RIGHT: await clickNextLevel(page); // the ONLY safe way to click the transition slot button

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
- GEN-DATA-LIVES-GUARD: Before asserting on data-lives or calling getLives(), ALWAYS check await page.evaluate(() => window.gameState?.totalLives > 0). getLives() reads data-lives from the DOM which returns null (parsed as 0) for non-lives games where totalLives === 0. Assertions on data-lives for non-lives games ALWAYS fail. For mechanics and contract categories: if the game has totalLives === 0, skip all lives assertions and instead assert accuracy or score. WRONG: const lives = await getLives(page); expect(lives).toBe(2); // fails for totalLives=0 games. RIGHT: const totalLives = await page.evaluate(() => window.gameState?.totalLives ?? 0); if (totalLives === 0) { return; /* skip lives assertions */ } const lives = await getLives(page); expect(lives).toBeGreaterThan(0);
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
    (two-player-race #506: .p1-option[data-index="1"] had class "p1-option disabled" not "correct" — class update fired in setTimeout after answer event)
M20. CSS TRANSITION PANEL VISIBILITY (CRITICAL) — When a panel/feedback div is shown or hidden via CSS transitions, .toBeHidden() and .toBeVisible() checks can fail because the transition is deferred (300–800ms). The 5s default Playwright timeout fires before the transition completes.
    WRONG (timeout at 5s before transition completes):
      await feedbackPanel.click();
      await expect(workedExamplePanel).toBeHidden();  // times out if panel uses CSS transition
    RIGHT option A — increase timeout:
      await feedbackPanel.click();
      await expect(workedExamplePanel).toBeHidden({ timeout: 15000 });  // allows for transition delay
    RIGHT option B — poll for hidden state:
      await feedbackPanel.click();
      await expect.poll(async () => await workedExamplePanel.isHidden(), { timeout: 15000 }).toBe(true);
    SCOPE: applies to any element whose show/hide is driven by CSS class additions (e.g. .hidden, .active, .visible, .show) — especially: #worked-example-panel, #answer-feedback, #example-answer, #feedback-panel, .step-panel, .hint-panel.
    NOT needed for: elements removed from DOM (display:none set directly), Playwright's built-in waitForSelector, or elements whose visibility is driven by synchronous JS (not CSS transitions).
M16. CHOICE-BTN / OPTION-BTN / ANSWER-BTN / ADJ-BTN / SECONDARY BUTTONS / RESULTS-SCREEN TOUCH TARGET (ALL button games) — If the DOM snapshot contains '.choice-btn', '.option-btn', '.answer-btn', '.adj-btn', '.reset-btn', OR any button inside #results-screen / #game-over-screen / .mathai-transition-screen, the mechanics test file MUST include an assertion that these buttons meet the 44px minimum touch target height (Apple HIG / GEN-UX-002). This rule is NOT scoped to primary .game-btn buttons — ALL interactive buttons including secondary/utility/choice buttons are covered. Dynamically generated buttons cannot be caught by static T1 checks. Confirmed: real-world-problem #564 results screen Play Again button measured 41px (below 44px min) — unreachable on small touch targets. Also confirmed: adjustment-strategy .adj-btn at 36px, associations .choice-btn padding-only, word-pairs submit at 21.5px.
    Pattern for .choice-btn (use when '.choice-btn' appears in DOM snapshot):
    const btn = page.locator('.choice-btn').first();
    await startGame(page);
    await waitForPhase(page, 'playing', 15000);
    await expect(btn).toBeVisible({ timeout: 10000 });
    const minH = await btn.evaluate(el => getComputedStyle(el).minHeight);
    expect(parseInt(minH)).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target
    Pattern for .option-btn (use when '.option-btn' appears in DOM snapshot):
    const optBtn = page.locator('.option-btn').first();
    await startGame(page);
    await waitForPhase(page, 'playing', 15000);
    await expect(optBtn).toBeVisible({ timeout: 10000 });
    const optMinH = await optBtn.evaluate(el => getComputedStyle(el).minHeight);
    expect(parseInt(optMinH)).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target
    Pattern for .answer-btn (use when '.answer-btn' appears in DOM snapshot):
    const ansBtn = page.locator('.answer-btn').first();
    await startGame(page);
    await waitForPhase(page, 'playing', 15000);
    await expect(ansBtn).toBeVisible({ timeout: 10000 });
    const ansHeight = await ansBtn.evaluate(el => parseInt(getComputedStyle(el).minHeight));
    expect(ansHeight).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target
    Pattern for results/game-over/transition screen buttons (ALWAYS assert when #results-screen, #game-over-screen, or .mathai-transition-screen present):
    // Navigate game to results phase first, then assert restart/play-again button touch target
    const resultsBtn = page.locator('#results-screen button, #game-over-screen button, .mathai-transition-screen button, .btn-restart, .btn-play-again, .btn-try-again, .restart-btn, .play-again-btn').first();
    await expect(resultsBtn).toBeVisible({ timeout: 10000 });
    const resultsBtnH = await resultsBtn.evaluate(el => parseInt(getComputedStyle(el).minHeight));
    expect(resultsBtnH).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target — results screen buttons confirmed failing: real-world-problem #564 Play Again measured 41px
    Pattern for .adj-btn (use when '.adj-btn' appears in DOM snapshot — adjustment-strategy confirmed 36px):
    const adjBtn = page.locator('.adj-btn').first();
    await startGame(page);
    await waitForPhase(page, 'playing', 15000);
    await expect(adjBtn).toBeVisible({ timeout: 10000 });
    const adjBtnH = await adjBtn.evaluate(el => parseInt(getComputedStyle(el).minHeight));
    expect(adjBtnH).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target — adj-btn confirmed 36px (adjustment-strategy)
    Pattern for .reset-btn / secondary utility buttons (use when '.reset-btn', '.submit-btn', '.skip-btn', or similar utility buttons appear in DOM snapshot):
    const utilBtn = page.locator('.reset-btn, .submit-btn, .skip-btn, .hint-btn').first();
    if (await utilBtn.count() > 0) {
      await expect(utilBtn).toBeVisible({ timeout: 10000 });
      const utilBtnH = await utilBtn.evaluate(el => parseInt(getComputedStyle(el).minHeight));
      expect(utilBtnH).toBeGreaterThanOrEqual(44); // GEN-UX-002 touch target — secondary utility buttons
    }
    If multiple selectors appear in the DOM snapshot, assert each one that is present.
    (UI/UX audit #513 F5d: choice-btn height unverified; mcq-addition-blitz #11th confirmed instance: .option-btn 4-button grid also needs 44px enforcement; CR-002: .answer-btn previously excluded — now covered; UI-RWP-010 HIGH: results screen Play Again 41px — now covered; GEN-UX-002 extended: adj-btn 36px + choice-btn padding-only + word-pairs submit 21.5px — 3 confirmed secondary button instances)
M17. NON-LIVES GAME getLives() GUARD — Before ANY test that calls getLives(), first check if this is a lives-based game:
    const totalLives = await page.evaluate(() => window.gameState?.totalLives ?? 0);
    if (totalLives === 0) {
      // Non-lives game — skip lives assertions entirely
      return;
    }
    This guard MUST appear at the top of any test that uses getLives() assertions. If the GAME FEATURE FLAGS block shows unlimitedLives: true or noLivesMentioned: true, DO NOT generate getLives() assertions at all — omit the entire test case instead of guarding it. getLives() returns 0 for non-lives games always; asserting on 0 produces false failures. (stats-identify-class, which-ratio — totalLives=0 games that still got lives assertions)
M18. GEN-DATA-LIVES-GUARD — NEVER assert on data-lives / getLives() for non-lives games without first checking totalLives. getLives() reads data-lives from the DOM which returns null (parsed as 0) for games where totalLives === 0. Asserting lives-decrement behavior on non-lives games always fails.
    REQUIRED GUARD before any data-lives assertion:
    const totalLives = await page.evaluate(() => window.gameState?.totalLives ?? 0);
    if (totalLives === 0) { test.skip(true, 'GEN-DATA-LIVES-GUARD: non-lives game — skipping lives assertion'); return; }
    // Only assert data-lives / getLives() here, after the guard confirms totalLives > 0
    If the GAME FEATURE FLAGS or DOM snapshot shows totalLives: 0 or no lives configuration, OMIT the entire test that asserts on lives — do not generate it at all (no guard needed, just skip generation).
M19. TRANSITION SLOT GUARD (MECHANICS) — NEVER assert \`#mathai-transition-slot button\` visibility (toBeVisible OR not.toBeVisible) anywhere in a mechanics test. The transition slot shows an intro "Let's go!" button at page load that is dismissed by startGame(). If a mechanics test checks \`.not.toBeVisible()\` on the transition slot before calling startGame(), it will always fail because the intro button IS visible. If it checks \`toBeVisible()\` after game start, it will flakily fail because the CDN auto-dismisses level-transition type screens without rendering a button.
    RULE A — Do NOT assert transition slot visibility as a precondition before game interaction:
    WRONG: await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible(); // fails — intro button visible
            await page.locator('#submit-btn').click();
    RIGHT: await startGame(page); // startGame() waits for isActive=true, which means intro screen is already dismissed
           await page.locator('#submit-btn').click();
    RULE B — Do NOT use transition slot visibility as a proxy for "game is ready to interact":
    WRONG: await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible({ timeout: 5000 }); // proxy for game-ready
    RIGHT: await startGame(page); // or await waitForPhase(page, 'playing', 15000) for games without startGame flow
    RULE C — Do NOT assert '#mathai-transition-slot button' toBeVisible() to detect round completion in mechanics tests. Round-end transitions may auto-advance without rendering a button (type='level-transition'). Use expect.poll on getRound() or waitForPhase() instead:
    WRONG: await answer(page, true); await expect(page.locator('#mathai-transition-slot button')).toBeVisible({ timeout: 5000 });
    RIGHT: await answer(page, true); await expect.poll(() => getRound(page), { timeout: 10000 }).toBeGreaterThan(initialRound);
    (which-ratio #547 build 553: 5/30 mechanics failure batches in last 30 builds caused by this pattern — transition slot button visible at test start because startGame() was not called before asserting .not.toBeVisible(); soh-cah-toa-worked-example #531, find-triangle-side #547, name-the-sides #553)` : ''}
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
GF-NEW-1: MANDATORY POLL BEFORE LIVES READ (CRITICAL)
WRONG:
  await startGame(page);
  const lives = await getLives(page);           // syncDOMState hasn't fired yet — data-lives may be 0
  for (let i = 0; i < lives; i++) {
    await answer(page, false);
  }
  await waitForPhase(page, 'gameover', 20000);  // loop ran 0 times — gameover never reached

RIGHT:
  await startGame(page);
  await expect.poll(() => getLives(page), { timeout: 5000 }).toBeGreaterThan(0); // wait for syncDOMState
  const lives = await getLives(page);           // NOW safe — data-lives is populated
  for (let i = 0; i < lives; i++) {
    await answer(page, false);
  }
  await waitForPhase(page, 'gameover', 20000);

WHY: syncDOMState() polls on a timer. getLives() reads data-lives from the DOM, which is 0 at game start
until syncDOMState fires. If you read lives before syncDOMState fires, the loop body never executes and
gameover is never triggered. ALWAYS use expect.poll(() => getLives(page), { timeout: 5000 }).toBeGreaterThan(0)
before using getLives() in a loop. (quadratic-formula b545 iter2+3: Expected 0 lives, Received 1)
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
GF9-ENFORCEMENT: The following test names are HIGH-RISK trigger phrases — the LLM routinely generates the banned selector for these tests:
"start screen to game start", "game starts when start is clicked", "transition to playing",
"screen advances to game", "start button starts game", "clicking start shows game screen",
"perfect game flow", "perfect_game_flow", "full playthrough", "complete game flow",
"game over flow", "game over transition", "transition to game screen", "start to gameplay",
"gameplay transition", "start screen to example phase", "start screen to level 1",
"screen transition from start".
For ANY test whose name contains these phrases, you MUST use:
  await startGame(page);
  await waitForPhase(page, 'playing', 15000);
NEVER use '#mathai-transition-slot button' in these tests regardless of what the DOM snapshot shows.
(Root cause: 19/70 game-flow failures 2026-03-23 from banned selector in these exact test patterns)
CRITICAL FIX-LOOP INSTRUCTION FOR GF9-ENFORCEMENT:
If the previous iteration failed with:
  locator('#mathai-transition-slot button') — Expected: visible / Error: element(s) not found
  OR
  locator('#mathai-transition-slot button') — Expected: not visible / Received: visible
The ONLY correct fix is to REPLACE all '#mathai-transition-slot button' references with:
  await startGame(page);                              // to transition from start screen
  await waitForPhase(page, '<playing-phase>', 15000); // to confirm game is active
Do NOT simply change the timeout. Do NOT add waitForSelector. The selector must be completely removed.
(name-the-sides b557: banned selector survived all 3 fix iterations unchanged — do not repeat this)
GF10: STEP-BASED GAME PANEL ASSERTIONS — For games with sequential step panels (step1-panel, step2-panel, example-panel, faded-panel, practice-panel, etc.):
NEVER use answer(page, true) to advance between steps — the generic answer() only matches .answer-btn/.option-btn/.choice-btn. Step panels use game-specific selectors.
WRONG: await answer(page, true); await expect(page.locator('#step1-panel')).toBeHidden({ timeout: 5000 }); // answer() does nothing for diagram/text-input steps
RIGHT:
  // Check DOM snapshot for the current step's interaction selector, then:
  await page.locator('[data-side="hypotenuse"]').click(); // or page.fill('#answer-input', '3.5'); + submit
  await expect(page.locator('#step1-panel')).toBeHidden({ timeout: 10000 }); // step panel hides after correct interaction
  await expect(page.locator('#step2-panel')).toBeVisible({ timeout: 5000 }); // next panel appears
RULE: Always derive step-interaction selectors from the DOM snapshot (data-side, data-testid, input[type=number], etc.). Never assume answer() works for step-based games.
(root cause of real-world-problem #564, find-triangle-side #549, quadratic-formula-worked-example #545/#546 level-progression failures)
GF-NEW-3: NO HIDDEN-PRECONDITION ASSERTIONS ON STEP PANELS
WRONG:
  await startGame(page);
  await expect(page.locator('#step2-panel')).toBeHidden({ timeout: 5000 }); // BANNED — assumes initial state
  await expect(page.locator('#step1-panel')).toBeVisible({ timeout: 5000 });

RIGHT:
  await startGame(page);
  await waitForPhase(page, 'playing', 15000);         // wait for game to fully initialize
  // Derive initial panel visibility from the ACTUAL RUNTIME DOM section of the DOM snapshot
  // Only assert panels as VISIBLE — never assert hidden as a precondition
  await expect(page.locator('#step1-panel')).toBeVisible({ timeout: 5000 }); // only assert what IS visible

WHY: Worked-example and step-based games (quadratic-formula, find-triangle-side, soh-cah-toa, real-world-problem)
may render multiple panels simultaneously on game start. The step2-panel, example-panel, or faded-panel
may be visible from the very first render. Asserting .toBeHidden() on any step panel immediately after
startGame() will fail if that panel is part of the initial state. RULE: Never assert a step panel is
hidden as a precondition. Only assert panels that the ACTUAL RUNTIME DOM snapshot explicitly shows as
hidden (display:none or visibility:hidden). (find-triangle-side b549 all 3 iters, quadratic b545/b546,
real-world-problem b564)

GF-EXACT: NEVER assert exact numeric values for score, lives, or round in game-flow tests.
WRONG: await expect.poll(() => getScore(page), { timeout: 3000 }).toBe(100);
WRONG: await expect.poll(() => getLives(page), { timeout: 3000 }).toBe(2);
WRONG: await expect.poll(() => getRound(page), { timeout: 3000 }).toBe(3);
WRONG: await expect(page.locator('#score-display')).toHaveText('Score: 100');
RIGHT: await expect.poll(() => getScore(page), { timeout: 3000 }).toBeGreaterThan(0);  // score increased
RIGHT: await expect.poll(() => getLives(page), { timeout: 3000 }).toBeLessThan(initialLives);  // lives decreased
RIGHT: await expect.poll(() => getRound(page), { timeout: 3000 }).toBeGreaterThan(initialRound);  // round advanced
RIGHT: await expect(page.locator('#score-display')).toBeVisible({ timeout: 5000 });  // display exists
WHY: Exact values assume fixed scoring formula (10pts/correct, 3 lives). If spec changes or game uses
weighted scoring, ALL game-flow tests with exact values fail together — and triage cannot distinguish
from a real scoring bug, wasting 3 fix iterations per batch. Assert direction, not value.
(8/30 game-flow batches failed due to this pattern — quadratic, real-world-problem, find-triangle-side)
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
LP-NEW-1. NEVER call window.debugGame() or window.nextRound() in page.evaluate() to fast-forward to a specific round without first checking fallbackContent.rounds.length. Calling debugGame(targetRound) where targetRound >= fallbackContent.rounds.length causes ProgressBarComponent.update() to receive a negative fill value (currentRound - totalRounds = -N) → RangeError: Invalid count value: -N → the entire test fails. ALWAYS guard the round index:
    WRONG: await page.evaluate(() => window.debugGame(5)); // round 5 may not exist → RangeError: Invalid count value: -N at ProgressBarComponent.update()
    WRONG: await page.evaluate(() => window.nextRound()); // calling nextRound() beyond totalRounds → same crash
    RIGHT:
      const totalRounds = fallbackContent.rounds?.length ?? 0;
      if (totalRounds < 3) { test.skip(true, 'LP-NEW-1: not enough rounds to test progression'); return; }
      await page.evaluate(() => window.debugGame(2)); // 0-indexed round 2 — only call if rounds exist
    WHY: ProgressBarComponent.update() calls String.repeat(count) where count = totalRounds - currentRound. If currentRound > totalRounds (because debugGame skipped beyond valid indices), count is negative → String.repeat throws RangeError → page.evaluate() call rejects → test fails. This was the #1 LP failure cause across 13 build-iterations (name-the-sides #557–562, which-ratio #559–561).
LP-NEW-2. NEVER use locator.click() with a start-button CSS selector in level-progression tests to navigate to a mid-game state. Generic selectors ('button:has-text("Start")', '#start-button', '.start-btn') may match the RESTART button on the results screen, causing locator.click() to time out at 15000ms or navigate to wrong state. ALWAYS use startGame(page) to enter the playing phase before testing round progression:
    WRONG: await page.locator('button:has-text("Start"), #start-button, .start-btn').first().click(); // may timeout or click restart
           await page.locator('.next-round-btn').click(); // undefined selector — never listed in DOM snapshot
    RIGHT: await startGame(page); // reliable: clicks through ALL transition screens to playing phase
           await expect.poll(() => getRound(page), { timeout: 10000 }).toBeGreaterThanOrEqual(1); // confirm in playing state
    WHY: Level-progression tests need to be in the playing phase before asserting round changes. locator.click() with ambiguous selectors fails in 8/30+ LP batches — interactive-chat #387, adjustment-strategy #381, matching-doubles #384, speedy-taps #310, two-digit-doubles-aided #306.
LP-NEW-3. NEVER assert not.toBeVisible() on '#mathai-transition-slot button' in level-progression tests to confirm "no transition shown between rounds". Some games DO render a visible "Let's go!" button between rounds (type='round-complete' WITH a buttons config) — asserting the button is NOT visible fails for these games. NEVER use the transition slot button's visibility as a round-boundary signal in either direction. ONLY detect round advancement via waitForPhase() or getRound() polling:
    WRONG: await answer(page, true); await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible({ timeout: 5000 }); // fails if game shows "Let's go!" between rounds
    WRONG: await answer(page, true); await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible({ timeout: 5000 }); // fails if game auto-advances without button
    RIGHT: await answer(page, true); await expect.poll(() => getRound(page), { timeout: 10000 }).toBeGreaterThan(startRound); // detects round change regardless of transition type
    WHY: Games vary on transition type — auto-advance (LP4, no button) vs manual-advance (shows "Let's go!" button). Asserting button visibility in either direction fails for the opposite game type. getRound() polling is transition-type-agnostic. (find-triangle-side #547 correct-answer-advances-round: Expected not visible Received visible; name-the-sides #553 two-triangles-require-six-selections: same pattern)
` : ''}${category === 'contract' ? `
CONTRACT SPECIFIC RULES:
C1. CRITICAL: Contract tests MUST reach the results screen via: await skipToEnd(page, 'victory') — NEVER by clicking through rounds manually. Clicking through rounds may timeout if the game uses auto-advancing transitions (no button on #mathai-transition-slot between rounds). Pattern:
    WRONG: await answer(page, true); await clickNextLevel(page); await answer(page, true); // times out on auto-advance games
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000);
    Then: const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
C2. ALWAYS read postMessage via window.__ralph.getLastPostMessage() — never via window.parent.postMessage which is inaccessible to test code. Pattern:
    await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000);
    const msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
    expect(msg).not.toBeNull(); expect(msg.type).toBe('game_complete');
C3. For testing different star values, use skipToEnd(page, 'game_over') for 0-star scenarios and setLives() before skipToEnd to control lives-based stars. Do NOT use setLives() for accuracy-based or timer-based star games.
CT3. NEVER use '#mathai-transition-slot button' to reach game completion in contract tests — the transition slot may auto-dismiss without rendering a button (type='level-transition'). This causes 'element(s) not found' timeouts that prevent the postMessage from ever firing. ALWAYS use skipToEnd() + waitForPhase('results', 20000):
    WRONG: await expect(page.locator('#mathai-transition-slot button').first()).toBeVisible(); await page.locator('#mathai-transition-slot button').first().click();
    RIGHT: await skipToEnd(page, 'victory'); await waitForPhase(page, 'results', 20000);
    The 20s timeout is required — results transition involves endGame() → gameState update → syncDOMState 500ms poll → DOM attribute set.
    (associations #405, light-up #411, adjustment-strategy #381, keep-track #477 — all contract failures from transition-slot waiting)
CT-NEW-1 — postMessage CLOSURE CAPTURE (replaces CT4 + CT8):
  WRONG: const msg = await expect.poll(async () => page.evaluate(() => window.__ralph.getLastPostMessage()), { timeout: 5000 });
  // expect.poll() returns an Expect object — msg is undefined → TypeError: Cannot read properties of undefined (reading 'type')

  WRONG: const msg = await expect.poll(async () => page.evaluate(() => window.__ralph.getLastPostMessage()), { timeout: 5000 }).catch(() => null);
  // same problem — catch() is on the Expect object, not the callback

  RIGHT — use closure capture:
  let msg;
  await expect.poll(async () => {
    msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
    return msg?.type;
  }, { timeout: 5000, intervals: [200] }).toBe('game_complete');
  expect(msg.data.metrics.stars).toBeGreaterThanOrEqual(0);
  expect(msg.data.metrics.score).toBeGreaterThanOrEqual(0);

  WHY: expect.poll() wraps assertions — its return value is an Expect object, not the callback value.
  Assigning it to \`msg\` gives undefined. \`undefined.type\` throws TypeError → triage deletes contract tests
  → 0 tests on iteration 2+. Closure capture sets \`msg\` inside the polling callback. (~40% of CT failures)
  (build #546 — contract tests deleted because expect.poll() return value was undefined → TypeError on msg.type)
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
CT8. (SUPERSEDED BY CT-NEW-1) — See CT-NEW-1 above for the unified closure-capture pattern.
CT9. (CONTRACT TRANSITION SLOT): NEVER assert \`#mathai-transition-slot button\` visibility in EITHER direction anywhere in a contract test. BOTH directions are wrong and fragile:
  WRONG: await expect(page.locator('#mathai-transition-slot button')).not.toBeVisible();
  // button may be hidden — but this is timing-dependent, not a contract invariant

  ALSO WRONG: await expect(page.locator('#mathai-transition-slot button')).toBeVisible();
  // button IS there (CDN renders it on game-over path) — assertion passes but test is fragile

  CANONICAL CONTRACT COMPLETION — use this exact sequence:
  await skipToEnd(page, 'victory');
  await waitForPhase(page, 'results', 20000);  // check terminal phase — see CT-NEW-2
  let msg;
  await expect.poll(async () => {
    msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
    return msg?.type;
  }, { timeout: 5000, intervals: [200] }).toBe('game_complete');
  // then assert msg.data.metrics fields per spec
CT-NEW-2 — waitForPhase TARGET must match spec terminal phase:
  WRONG: await waitForPhase(page, 'results', 20000);
  // Fails if game uses data-phase="gameover" as terminal phase — waitForPhase times out, postMessage never read

  RIGHT — check DOM snapshot for terminal phase:
  // If DOM snapshot shows data-phase="results" at end → use 'results'
  // If DOM snapshot shows data-phase="gameover" at end → use 'gameover'
  await waitForPhase(page, 'results', 20000);  // or 'gameover' — match the spec

  ALSO RIGHT — phase-agnostic pattern:
  await page.waitForFunction(
    () => ['results', 'gameover'].includes(document.querySelector('#app')?.dataset?.phase),
    { timeout: 20000 }
  );

  WHY: ~13% of CT failures are waitForPhase('results') timing out — builds 529, 531, 462, 483, 463, 465.
  Always verify the terminal phase in the DOM snapshot section of the test preamble before writing.
CT-NEW-3. NEVER use #results-screen, .results-container, or any game-specific results element selector as a proxy for game completion in contract tests. These are implementation details — they may not exist in the generated HTML. The ONLY reliable completion signal is data-phase="results" via waitForPhase(). Pattern:
    WRONG: await expect(page.locator('#results-screen')).toBeVisible({ timeout: 5000 }); // selector may not exist in generated HTML
    WRONG: await expect(page.locator('.results-container')).toBeVisible(); // internal detail — not guaranteed
    RIGHT: await waitForPhase(page, 'results', 20000); // CDN sets data-phase="results" on #app when game completes
    (associations #513 — '#results-screen' was hidden because selector did not match; waitForPhase(results) is always reliable)
CT-NEW-4. NEVER use toBe(N) to assert an exact star count in contract tests. Stars are calculated from accuracy, speed, or lives-remaining — skipToEnd('victory') does not guarantee a specific star count. Use range assertions:
    WRONG: expect(msg.data.metrics.stars).toBe(3); // fails when game calculates stars differently
    WRONG: expect(msg.data.metrics.stars).toBe(0); // fails for accuracy-based games
    RIGHT: expect(msg.data.metrics.stars).toBeGreaterThanOrEqual(0); // any valid star value (0, 1, 2, or 3)
    RIGHT: expect(msg.data.metrics.stars).toBeLessThanOrEqual(3); // stars is always 0-3 range
    EXCEPTION: only use toBe(N) if the spec EXPLICITLY guarantees exactly N stars for a specific path AND the test constructs that exact path (e.g. 0-star by using skipToEnd('game_over') with a lives-based game).
    (memory-flip #453 Expected:3 Received:0, kakuro #391 Expected:3 Received:0, match-the-cards #514 Expected:>0 Received:0)
MSG-001 — GAME_OVER PATH POSTMESSAGE (MANDATORY): Every contract test file MUST include a dedicated test that calls endGame('game_over') and verifies that game_complete postMessage fires on that path. The victory path test alone is NOT sufficient — the game_over path MUST be tested separately.
  WHY: messaging category pass rate is 56%. Root cause: generated games guard postMessage inside \`if (reason === 'victory')\` — game_over path sends no postMessage. Tests only test the victory path. Neither the HTML nor the tests catch this bug. Both must be fixed: (1) the gen rule GEN-PM-DUAL-PATH ensures the game sends it; (2) this rule ensures the test VERIFIES it.
  REQUIRED — add this test to the contract describe block:
  test("game_over path fires game_complete postMessage", async ({ page }) => {
    await startGame(page);
    await skipToEnd(page, 'game_over');
    await page.waitForFunction(
      () => ['results', 'gameover'].includes(document.querySelector('#app')?.dataset?.phase),
      { timeout: 20000 }
    );
    let msg;
    await expect.poll(async () => {
      msg = await page.evaluate(() => window.__ralph.getLastPostMessage());
      return msg?.type;
    }, { timeout: 5000, intervals: [200] }).toBe('game_complete');
    // postMessage MUST fire on game_over path — not just victory
    expect(msg.type).toBe('game_complete');
  });
  WRONG: only testing skipToEnd(page, 'victory') and never testing the game_over path — the victory-only guard bug goes undetected.
  WRONG: using page.on('message') to capture postMessage — always use window.__ralph.getLastPostMessage() which is already buffered by the test harness.
  WRONG: setting up any event listener after calling endGame/skipToEnd — the harness already buffers the message, no listener setup is needed.
  (Analytics: messaging 56% pass rate, top failure pattern. GEN-PM-DUAL-PATH companion rule)` : ''}${category === 'edge-cases' ? `
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
- Test asserts exact numeric value via toBe(N) and fails with "Expected: N, Received: M" where both are integers AND the test name contains score/lives/round/points → test assumed a specific game value that differs at runtime → skip_test. Do NOT attempt to fix the HTML scoring logic.

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

  // ── LP-3: GEN-STEP-001 step-panel fix-loop reinforcement ────────────────────
  // If any failing test name or the batch label mentions "step" or "panel",
  // inject an explicit GEN-STEP-001 reminder so the LLM knows to hide the panel
  // at round start — the #1 root cause of level-progression failures in step-based games.
  const stepPanelHint =
    /step|panel/i.test(failuresStr) || /step|panel/i.test(batchLabel)
      ? `\nSTEP-PANEL FIX REQUIRED: If a step-panel element is visible when it should be hidden, add \`stepPanel.style.display = 'none';\` at the START of renderRound() BEFORE any content is loaded. GEN-STEP-001: step-panels MUST be explicitly hidden at the start of every round.\n`
      : '';

  return `The following HTML game has test failures in the '${batchLabel}' category.

${fixStrategy}
${fixHintContext}${stepPanelHint}${specScoringContext}${fixLearningsContext}${lessonHintsContext || ''}${brokenPageErrorContext || ''}${diffSection}
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
function buildTargetedFixPrompt(feedbackPrompt, failingContext, passingContext, currentHtml, specContent, currentlyPassing, htmlPath, t1ErrorContext) {
  const htmlSection = htmlPath
    ? `CURRENT HTML:\n@${htmlPath}`
    : `CURRENT HTML:\n${stripCssFromHtml(currentHtml)}`;
  const t1Section = t1ErrorContext
    ? `\nT1 STATIC VALIDATION ERRORS FROM PREVIOUS FIX ATTEMPT (MUST FIX — these caused the previous fix to be rejected):\n${t1ErrorContext}\n`
    : '';
  return `You are fixing an HTML game based on user feedback.

USER FEEDBACK:
${feedbackPrompt}
${failingContext}
${passingContext}
${t1Section}
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
ProgressBarComponent has exactly 3 API points: constructor(slotId, config), .update(currentRound, livesRemaining), and .destroy(). There is NO .init(), .start(), .reset(), .setLives(), .pause(), .resume(), or any other method. Calling any of these throws TypeError → blank page.
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
progressBar.update(0, gameState.lives);  // set initial round display
\`\`\`
Find ALL calls to progressBar.init(), progressBar.start(), progressBar.reset(), progressBar.setLives(), progressBar.pause(), progressBar.resume() or any other undefined method and remove or replace them. The ONLY valid calls after construction are progressBar.update(currentRound, livesRemaining) and progressBar.destroy().

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
