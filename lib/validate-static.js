#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// validate-static.js — Static HTML validation layer (T1)
//
// Deterministic checks against generated HTML before running Playwright.
// Catches ~40% of failures in <1 second.
//
// Usage: node validate-static.js <path-to-index.html>
// Exit 0 = pass, Exit 1 = failures found (printed to stdout)
// ─────────────────────────────────────────────────────────────────────────────
'use strict';

const fs = require('fs');
const path = require('path');

const htmlPath = process.argv[2];
if (!htmlPath) {
  console.error('Usage: node validate-static.js <path-to-index.html>');
  process.exit(2);
}

if (!fs.existsSync(htmlPath)) {
  console.error(`File not found: ${htmlPath}`);
  process.exit(2);
}

const html = fs.readFileSync(htmlPath, 'utf-8');
const errors = [];
const warnings = [];

// ─── Helper: check if pattern exists in HTML ────────────────────────────────
function requirePattern(pattern, description) {
  if (typeof pattern === 'string') {
    if (!html.includes(pattern)) {
      errors.push(`MISSING: ${description}`);
    }
  } else {
    if (!pattern.test(html)) {
      errors.push(`MISSING: ${description}`);
    }
  }
}

function forbidPattern(pattern, description) {
  if (typeof pattern === 'string') {
    if (html.includes(pattern)) {
      errors.push(`FORBIDDEN: ${description}`);
    }
  } else {
    if (pattern.test(html)) {
      errors.push(`FORBIDDEN: ${description}`);
    }
  }
}

// ─── 1. Basic HTML structure ────────────────────────────────────────────────
requirePattern(/<!doctype\s+html>/i, 'DOCTYPE declaration');
requirePattern('<html', 'HTML root element');
requirePattern('<head', 'HEAD element');
requirePattern('<body', 'BODY element');

// ─── 2. Required DOM containers ─────────────────────────────────────────────
// #gameContent may be created dynamically by ScreenLayout.inject() — accept either static id= or ScreenLayout usage
const hasGameContentStatic = /id\s*=\s*["']gameContent["']/.test(html);
const hasScreenLayout = /ScreenLayout\.inject/.test(html);
if (!hasGameContentStatic && !hasScreenLayout) {
  errors.push('MISSING: #gameContent container (id attribute) or ScreenLayout.inject() call');
}
// #gameArea is an optional container — not required for CDN-layout games
// requirePattern(/id\s*=\s*["']gameArea["']/, '#gameArea container (id attribute)');

// ─── 3. Required global functions ───────────────────────────────────────────
// CDN games (ScreenLayout + DOMContentLoaded) don't need an initGame() function —
// they initialize inline in the DOMContentLoaded handler. Only require initGame
// for non-CDN games that use the legacy pattern.
// PostMessage games (PART-008) use setupGame() called from handlePostMessage on game_init.
const hasDOMContentLoaded = /addEventListener\s*\(\s*['"]DOMContentLoaded['"]/.test(html);
const hasInitGame = /(?:function\s+initGame\s*\(|(?:async\s+)?(?:const|let|var)\s+initGame\s*=)/.test(html);
const hasSetupGame = /function\s+setupGame\s*\(/.test(html);
const hasPostMessageInit = /handlePostMessage/.test(html) && hasSetupGame;
if (!hasInitGame && !(hasScreenLayout && hasDOMContentLoaded) && !hasPostMessageInit) {
  errors.push('MISSING: initGame() function declaration');
}

// Interaction handler — accept any function named handle*, check*, select*, tap*, press*, onXxx,
// or any addEventListener('click'/'keydown'/'touchstart') pattern.
// CDN games use diverse naming conventions (handleSimonTap, handleCellClick, handleCorrectTap, etc.)
const hasInteractionHandler =
  /function\s+(?:check|handle|select|tap|press|on[A-Z])\w*\s*\(/.test(html) ||
  /addEventListener\s*\(\s*['"](?:click|keydown|keyup|touchstart|pointerdown)['"]/.test(html);
if (!hasInteractionHandler) {
  errors.push('MISSING: No interaction handler function found (checkAnswer/handleClick/handleXxx/addEventListener)');
}

requirePattern(
  /(?:function\s+endGame\s*\(|(?:const|let|var)\s+endGame\s*=)/,
  'endGame() function declaration'
);

// ─── 4. Single-file constraint ──────────────────────────────────────────────
requirePattern('<style', 'CSS <style> block (single-file constraint)');
requirePattern('<script', 'JavaScript <script> block (single-file constraint)');

// Check for external resource references
// MathAI CDN games always load from the MathAI CDN — these are allowed and required.
// Only forbid non-CDN external scripts (local relative paths or unknown hosts).
const externalLinkPattern = /<link[^>]+href\s*=\s*["'][^"']*\.css["']/i;
const externalScriptPattern = /<script[^>]+src\s*=\s*["']([^"']*)["']/gi;
if (externalLinkPattern.test(html)) {
  errors.push('FORBIDDEN: External CSS link (must be single-file, use <style>)');
}
// Allow CDN scripts (mathai CDN, unpkg, jsDelivr, etc.) — block local relative scripts
let scriptMatch;
const localScriptPattern = /^(?!https?:\/\/).*\.js$/i;
while ((scriptMatch = externalScriptPattern.exec(html)) !== null) {
  if (localScriptPattern.test(scriptMatch[1])) {
    errors.push(`FORBIDDEN: Local relative script "${scriptMatch[1]}" (must be inlined or use CDN)`);
  }
}

// ─── 5. Forbidden patterns ──────────────────────────────────────────────────
forbidPattern('document.write', 'document.write() usage');

// signalPayload must be spread (not manually destructured) when signalCollector is used
const hasSignalCollector = /signalCollector/i.test(html);
if (hasSignalCollector) {
  const hasSpread = /\.\.\.\s*signalPayload/.test(html);
  const hasManualAssign = /signals\s*:\s*signalPayload\.signals/.test(html);
  if (!hasSpread) {
    errors.push('MISSING: ...signalPayload spread in postMessage — signalCollector detected but endGame postMessage must use ...signalPayload (not manual signals:/metadata: props)');
  } else if (hasManualAssign) {
    errors.push('FORBIDDEN: Manual signalPayload.signals assignment — use ...signalPayload spread instead (omitting events otherwise)');
  }
}

// Key game functions must be declared async if they contain await calls
// Check endGame and handleGameOver specifically (recurring review rejections)
const asyncFunctionNames = ['endGame', 'handleGameOver', 'handleCellClick', 'handleChainComplete'];
for (const fnName of asyncFunctionNames) {
  const fnMatch = html.match(new RegExp(`((?:async\\s+)?function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{)([\\s\\S]*?)(?=\\n\\s*function |\\n\\s*(?:const|let|var)\\s+\\w|\\n\\s*\\/\\/\\s*─|$)`));
  if (fnMatch) {
    const fnDecl = fnMatch[1];
    const fnBody = fnMatch[2];
    const bodyHasAwait = /\bawait\b/.test(fnBody);
    const declIsAsync = /^async\s+function/.test(fnDecl.trim());
    if (bodyHasAwait && !declIsAsync) {
      errors.push(`MISSING: ${fnName}() uses await but is not declared async — must be async function ${fnName}()`);
    }
  }
}
// Inline event handlers (onclick= in HTML attributes, not in JS strings)
const inlineHandlerPattern = /<[^>]+\s+on(?:click|load|error|submit|change|input|keydown|keyup|mousedown|mouseup)\s*=/i;
if (inlineHandlerPattern.test(html)) {
  warnings.push('WARNING: Inline event handler found in HTML (prefer addEventListener)');
}

// ─── 5b. game_init phase transition ─────────────────────────────────────────
// If the HTML defines handlePostMessage and a game_init case, gameState.phase = 'playing'
// MUST appear in the HTML. The test harness fires game_init then immediately calls
// waitForPhase('playing') — missing this causes ALL game-flow and mechanics tests to timeout.
const hasHandlePostMessage = /handlePostMessage/.test(html);
const hasGameInitCase = /['"]game_init['"]/.test(html);
if (hasHandlePostMessage && hasGameInitCase) {
  const hasPlayingPhaseSet = /gameState\s*\.\s*phase\s*=\s*['"]playing['"]/.test(html);
  if (!hasPlayingPhaseSet) {
    errors.push(
      "MISSING: gameState.phase = 'playing' — handlePostMessage + game_init detected but gameState.phase = 'playing' not found. The test harness fires game_init then immediately calls waitForPhase('playing'); missing this causes ALL game-flow and mechanics tests to timeout."
    );
  }
}

// ─── 5b2. FeedbackManager audio API check ───────────────────────────────────
// sound.register() is FORBIDDEN — verification-checklist line 34.
// All audio must use sound.preload([{id, url}]) instead.
const hasFeedbackManager = /FeedbackManager/.test(html);
if (hasFeedbackManager) {
  if (/\bsound\.register\s*\(/.test(html)) {
    errors.push(
      'FORBIDDEN: sound.register() — use FeedbackManager.sound.preload([{id, url}]) instead. sound.register() is not a valid API.'
    );
  }

  // GEN-113: FeedbackManager.init() is forbidden — calling it blocks audio context and causes review rejection.
  // ONLY call FeedbackManager.init() when PART-017=YES; even then, the pipeline injects it conditionally.
  // Unconditional FeedbackManager.init() calls in generated HTML account for 27% of review rejections.
  if (/FeedbackManager\s*\.\s*init\s*\(/.test(html)) {
    errors.push(
      'ERROR [PART-011-INIT]: FeedbackManager.init() must NOT be called unconditionally. ' +
        'Use FeedbackManager directly (playCorrectSound, playWrongSound, playDynamicFeedback). ' +
        'Calling init() shows a blocking audio-context popup that causes REVIEW REJECTION. ' +
        'Remove the FeedbackManager.init() call entirely unless PART-017=YES is set in the spec.'
    );
  }

  // GEN-113B: FeedbackManager.sound.playDynamicFeedback is not a function.
  // The correct namespace is FeedbackManager.playDynamicFeedback (top-level), not .sound sub-object.
  // Calling .sound.playDynamicFeedback() throws synchronous TypeError inside handleAnswer() before
  // scheduleNextRound() runs → isProcessing stuck true → round lifecycle deadlock.
  if (/FeedbackManager\s*\.\s*sound\s*\.\s*playDynamicFeedback\s*\(/.test(html)) {
    errors.push(
      'ERROR [PART-011-SOUND]: FeedbackManager.sound.playDynamicFeedback() does NOT exist. ' +
        'Call FeedbackManager.playDynamicFeedback({...}) at the top level instead. ' +
        'The .sound sub-object has no playDynamicFeedback method — calling it throws TypeError ' +
        'synchronously inside handleAnswer(), leaving isProcessing=true and deadlocking the game.'
    );
  }
}

// ─── 5b3. window.gameState exposure check ───────────────────────────────────
// syncDOMState (injected by test harness) reads window.gameState.
// If the game declares gameState inside DOMContentLoaded as const/let, it won't
// be on window — syncDOMState returns early and data-phase is never set → ALL tests fail.
// REQUIRED: window.gameState = { ... } (not const/let gameState inside a closure).
// Allow: var gameState = { ... } at top level (var hoists to window in browsers).
if (hasDOMContentLoaded) {
  const hasWindowGameState = /window\s*\.\s*gameState\s*=/.test(html);
  const hasAnyGameState =
    /gameState\s*=\s*\{/.test(html) ||
    /let\s+gameState/.test(html) ||
    /var\s+gameState/.test(html) ||
    /const\s+gameState/.test(html);
  // Check for const/let gameState inside DOMContentLoaded callback (bad pattern)
  // Heuristic: if gameState is initialized (present in HTML) but not as window.gameState,
  // and the game uses DOMContentLoaded, warn about potential scope issue.
  if (!hasWindowGameState && hasAnyGameState) {
    const hasVarGameState = /\bvar\s+gameState\s*=/.test(html);
    if (!hasVarGameState) {
      // const/let gameState — may not be on window
      errors.push(
        'MISSING: window.gameState = { ... } — test harness syncDOMState() reads window.gameState; const/let gameState inside DOMContentLoaded is not on window → data-phase never set → ALL tests timeout. Use window.gameState = { ... } at global scope.'
      );
    }
  }
}

// ─── 5c. waitForPackages timeout check ──────────────────────────────────────
// waitForPackages() MUST use a 120000ms (120s) timeout. CDN cold-start in fresh
// Playwright test browsers takes 30–120s. Old HTML with const timeout = 10000
// will fail ALL tests — the packages never finish loading before the timeout fires.
// Lesson 117: upgraded from 10s → 120s requirement.
const hasWaitForPackages = /function\s+waitForPackages\s*\(/.test(html);
if (hasWaitForPackages) {
  const hasThrowOnTimeout = /throw\s+new\s+Error/.test(html);
  if (!hasThrowOnTimeout) {
    errors.push(
      'MISSING: waitForPackages() must throw new Error() on timeout — review model requires error handling (not console.error or silent)'
    );
  }
  // Check for short timeout values (anything under 120000ms is too short)
  // Only flag if CDN script tags are present (avoid false positives on non-CDN games)
  const hasCdnScripts = /<script[^>]+src\s*=\s*["'][^"']*storage\.googleapis\.com[^"']*["']/i.test(html);
  if (hasCdnScripts) {
    // Extract timeout value from waitForPackages — look for const/let/var timeout = <number>
    const timeoutMatch = html.match(/(?:const|let|var)\s+timeout\s*=\s*(\d+)/);
    if (timeoutMatch) {
      const timeoutVal = parseInt(timeoutMatch[1], 10);
      if (timeoutVal < 120000) {
        errors.push(
          `ERROR: waitForPackages() timeout is ${timeoutVal}ms — must be 120000ms (120s) for CDN cold-start. ` +
            'CDN takes 30–120s in fresh Playwright test browsers; a short timeout causes "Packages failed to load" → ALL tests fail beforeEach. ' +
            'Fix: change to const timeout = 120000; (Lesson 117).'
        );
      }
    }
  }
}

// ─── 5c2. CDN script tag presence check ─────────────────────────────────────
// Games that call waitForPackages() MUST have at least one CDN <script src> tag
// that loads the packages. If the LLM generates an inline-only script with no
// external package loads, waitForPackages() will timeout → blank page.
// Diagnostic confirmed in disappearing-numbers #464: zero <script src> tags →
// "Init error: Packages failed to load within 10s" → all tests fail beforeEach.
// Also catches E8 script-only fix stripping CDN <script src> tags (Lesson 145,
// build #527): E8 merges LLM-repaired script back but LLM omits CDN load tags →
// waitForPackages() spins 180s then throws → all tests fail with blank page.
// Check both: function definition (hasWaitForPackages) AND call site.
const callsWaitForPackages = /waitForPackages\s*\(/.test(html);
if (hasWaitForPackages || callsWaitForPackages) {
  const hasCdnScriptTag = /<script[^>]+src\s*=\s*["'][^"']*storage\.googleapis\.com[^"']*["']/i.test(html);
  if (!hasCdnScriptTag) {
    errors.push(
      'MISSING: CDN <script src> tag — waitForPackages() is present but no CDN package script tag found. ' +
        'The game must load CDN packages via <script src="https://storage.googleapis.com/test-dynamic-assets/packages/..."> ' +
        'before the inline game script. Without CDN script tags, waitForPackages() spins 180s then throws ' +
        '"Packages failed to load within 180s" → blank page. ' +
        'If this follows an E8 fix, the LLM may have stripped CDN <script src> tags from the merged output (Lesson 145).'
    );
  }
}

// ─── 5d. CDN window exposure check ──────────────────────────────────────────
// CDN games define endGame/restartGame inside DOMContentLoaded — they are NOT on
// window unless explicitly assigned. The test harness calls window.endGame etc.
// If DOMContentLoaded is used AND endGame is defined, window.endGame must be assigned.
// (Lesson 33 from lessons-learned.md)
if (hasDOMContentLoaded) {
  const hasEndGame = /(?:function\s+endGame\s*\(|(?:const|let|var)\s+endGame\s*=)/.test(html);
  if (hasEndGame) {
    const hasWindowEndGame = /window\s*\.\s*endGame\s*=/.test(html);
    if (!hasWindowEndGame) {
      errors.push(
        'MISSING: window.endGame = endGame — CDN games define endGame inside DOMContentLoaded (not on window). Must add window.endGame = endGame so test harness can call it.'
      );
    }
    // Check restartGame too if it exists
    const hasRestartGame = /(?:function\s+restartGame\s*\(|(?:const|let|var)\s+restartGame\s*=)/.test(html);
    if (hasRestartGame && !/window\s*\.\s*restartGame\s*=/.test(html)) {
      errors.push(
        'MISSING: window.restartGame = restartGame — CDN games must expose restartGame on window for test harness access.'
      );
    }
  }
}

// ─── 5d2. window.loadRound exposure check (PART-021-LOADROUND) ──────────────
// CDN games with multiple rounds must expose window.loadRound (or an equivalent)
// so the test harness __ralph.jumpToRound() can advance rounds during mechanics tests.
// Without it, jumpToRound() silently no-ops → data-phase stays 'results' from prior
// endGame() → ALL waitForPhase('playing') calls timeout → 100% mechanics failure.
// (name-the-sides build #550)
if (hasDOMContentLoaded) {
  const hasMultipleRounds =
    /totalRounds|currentRound/.test(html);
  if (hasMultipleRounds) {
    const hasLoadRound =
      /window\s*\.\s*(?:loadRound|jumpToRound|loadQuestion|goToRound)\s*=/.test(html);
    if (!hasLoadRound) {
      warnings.push(
        'WARN [PART-021-LOADROUND]: window.loadRound is not exposed. The test harness __ralph.jumpToRound() will be a no-op, causing mechanics/level-progression tests to fail. Add: window.loadRound = function(n) { gameState.currentRound = n - 1; nextRound(); }'
      );
    }
  }
}

// ─── 5e. ScreenLayout.inject() presence check ───────────────────────────────
// If HTML uses ScreenLayout (PART-025), ScreenLayout.inject() MUST be called.
// Missing call → #mathai-transition-slot button never renders → ALL tests timeout.
// (Lesson: visual-memory, explain-the-pattern killed 3× for this pattern)
const hasScreenLayoutRef = /ScreenLayout/.test(html);
if (hasScreenLayoutRef && !/ScreenLayout\s*\.\s*inject\s*\(/.test(html)) {
  errors.push(
    'MISSING: ScreenLayout.inject() — HTML references ScreenLayout (PART-025) but never calls ScreenLayout.inject(). The #mathai-transition-slot button will never render and ALL tests will timeout.'
  );
}

// ─── 5e2. ScreenLayout.inject() slots: wrapper check ────────────────────────
// ScreenLayout.inject() MUST use { slots: { ... } } as the second argument.
// Calling inject('app', { progressBar: true }) without the slots: wrapper means
// the options are passed as a flat object — ScreenLayout silently ignores them
// → #gameContent, #mathai-transition-slot, #mathai-progress-slot are never created
// → document.getElementById('gameContent').appendChild() throws → blank page.
// Root cause of disappearing-numbers #400 (and similar games). Lesson 97.
if (hasScreenLayoutRef && /ScreenLayout\s*\.\s*inject\s*\(/.test(html)) {
  // Extract the inject() call arguments to check for slots: wrapper
  // Match from inject( to the matching closing ) — use a fixed window (1000 chars)
  const injectIdx = html.indexOf('ScreenLayout');
  const injectWindow = html.slice(injectIdx, injectIdx + 800);
  const hasInjectCall = /ScreenLayout\s*\.\s*inject\s*\(/.test(injectWindow);
  const hasSlotsWrapper = /slots\s*:/.test(injectWindow.slice(0, 500));
  if (hasInjectCall && !hasSlotsWrapper) {
    warnings.push(
      'WARNING: ScreenLayout.inject() call may be missing slots: { ... } wrapper. ' +
        'Correct form: ScreenLayout.inject(\'app\', { slots: { progressBar: true, transitionScreen: true } }). ' +
        'Without slots: wrapper, #gameContent/#mathai-transition-slot are never created → blank page. ' +
        'Root cause of disappearing-numbers #400 failure (Lesson 97).'
    );
  }
}

// ─── 5e1. waitForPackages() short timeout — CDN cold-start safety ────────────
// Redundant named entry for 5c timeout check: explicitly named 5e1 for
// discoverability. Logic lives in 5c above. No additional checks here.
// (Lesson 117: 10000ms → 120000ms, CDN cold-start takes 30–120s in test browsers)

// ─── 5f. initSentry() order check ────────────────────────────────────────────
// initSentry() must NOT be called synchronously in DOMContentLoaded before
// waitForPackages() resolves. If it is, it runs before the Sentry SDK is loaded
// → throws → prevents ScreenLayout.inject() from running → CDN slot never mounts.
// Pattern: DOMContentLoaded handler calls initSentry() outside of waitForPackages callback.
const hasInitSentry = /function\s+initSentry\s*\(/.test(html);

// ─── 5f0. initSentry() called but not defined ────────────────────────────────
// initSentry() is NOT a CDN function — it MUST be defined by the game code.
// If the game calls initSentry() but never defines `function initSentry()`,
// the browser throws ReferenceError: initSentry is not defined at runtime →
// the try/catch catches it → ScreenLayout.inject() never runs → blank page.
// Root cause: LLM treats initSentry() as a CDN-provided function when the gen
// prompt says "initSentry() checks typeof SentryConfig internally". It is not.
// (right-triangle-area build #538)
{
  const htmlNoCommentsF0 = html.replace(/<!--[\s\S]*?-->/g, '');
  const initSentryCall = /initSentry\s*\(\s*\)(?!\s*\{)/.test(htmlNoCommentsF0);
  if (initSentryCall && !hasInitSentry) {
    errors.push(
      'ERROR: initSentry() is called but never defined. initSentry() is NOT a CDN function — ' +
        'it MUST be defined in the game script. When spec includes PART-030 (Sentry), define it as:\n' +
        '  function initSentry() {\n' +
        '    try { if (typeof SentryConfig !== "undefined") { SentryConfig.init(); } }\n' +
        '    catch(e) { console.error(JSON.stringify({error: e.message})); }\n' +
        '  }\n' +
        'ReferenceError: initSentry is not defined → catch block → ScreenLayout.inject() never runs → blank page.'
    );
  }
}

if (hasInitSentry && hasWaitForPackages && hasDOMContentLoaded) {
  // Check if initSentry() is called as a top-level statement in DOMContentLoaded
  // (i.e. not inside the .then() or async callback of waitForPackages)
  // Heuristic: initSentry() call appears before waitForPackages( in the script.
  // Must exclude the function declaration itself: `function initSentry() {`
  // — identified by the `{` that follows the parens.
  // Strip HTML comments before checking — initSentry() text in a comment must not
  // trigger this check even if it appears before waitForPackages() in the source.
  const htmlNoComments = html.replace(/<!--[\s\S]*?-->/g, '');
  const initSentryCallMatch = /initSentry\s*\(\s*\)(?!\s*\{)/.exec(htmlNoComments);
  const initSentryPos = initSentryCallMatch ? initSentryCallMatch.index : -1;
  const waitForPackagesPos = htmlNoComments.indexOf('waitForPackages(');
  if (initSentryPos !== -1 && waitForPackagesPos !== -1 && initSentryPos < waitForPackagesPos) {
    errors.push(
      'FORBIDDEN: initSentry() called before waitForPackages() — Sentry SDK is not yet loaded. Move initSentry() call to inside the waitForPackages() callback/await, after packages are confirmed loaded.'
    );
  }
}

// ─── 5f2. Sentry.Integrations.CaptureConsole constructor check ───────────────
// new Sentry.Integrations.CaptureConsole() does NOT exist in the Sentry CDN
// bundle — using it throws "TypeError: Sentry.Integrations.CaptureConsole is
// not a constructor" at runtime, which aborts initSentry() and can prevent
// ScreenLayout.inject() from running → CDN slot never mounts → ALL tests fail.
// Neither Sentry.Integrations.CaptureConsole nor Sentry.captureConsoleIntegration
// are in the CDN bundle. OMIT integrations entirely — pass [] or no argument (Lesson 105).
if (/new\s+Sentry\s*\.\s*Integrations\s*\.\s*CaptureConsole\s*\(/.test(html)) {
  warnings.push(
    'WARNING: new Sentry.Integrations.CaptureConsole() — does not exist in CDN bundle, throws TypeError, aborts initSentry(). ' +
      'OMIT integrations entirely: call initSentry() with no argument or pass integrations:[]. ' +
      'NEVER use Sentry.captureConsoleIntegration() either — also not in CDN bundle (Lesson 105).'
  );
}
// Also catch direct Sentry.captureConsoleIntegration() calls — equally wrong
if (/Sentry\s*\.\s*captureConsoleIntegration\s*\(/.test(html)) {
  warnings.push(
    'WARNING: Sentry.captureConsoleIntegration() — not available in the Sentry CDN bundle; calling it throws ' +
      '"Sentry.captureConsoleIntegration is not a function" and aborts initSentry(). ' +
      'OMIT integrations entirely: call initSentry() with no argument or pass integrations:[] (Lesson 105).'
  );
}

// ─── 5f5. TimerComponent(null, ...) — null containerId throws at runtime ───────
// TimerComponent constructor: constructor(containerId, config)
// Line 1: `this.container = document.getElementById(containerId)`
// Line 2: `if (!this.container) { throw new Error('Container with id "${containerId}" not found'); }`
// Passing null, undefined, or any string that doesn't match an existing element throws
// immediately → caught by DOMContentLoaded try/catch → body.innerHTML replaced with error →
// #gameContent destroyed → Step 1d: "Blank page: missing #gameContent element".
// Fix: define <div id="timer-container"></div> in the game template and pass 'timer-container'.
if (/new\s+TimerComponent\s*\(\s*null\s*[,)]/.test(html) ||
    /new\s+TimerComponent\s*\(\s*undefined\s*[,)]/.test(html)) {
  errors.push(
    'ERROR: new TimerComponent(null, ...) — TimerComponent requires a valid container element ID string. ' +
      '"null" → document.getElementById(null) returns null → constructor throws ' +
      '"Container with id \\"null\\" not found" → body.innerHTML replaced → #gameContent destroyed → blank page. ' +
      'Fix: (1) Add <div id="timer-container"></div> to the game template (inside <template id="game-template">). ' +
      '(2) Use: new TimerComponent(\'timer-container\', { timerType: \'decrease\', startTime: N, endTime: 0, autoStart: false, onEnd: handleTimeout }). ' +
      'The timer-container div is a required DOM element that TimerComponent renders into. (right-triangle-area build #540 root cause)'
  );
}

// ─── 5f6. Canvas API with CSS variables — addColorStop/fillStyle/strokeStyle cannot use var() ──
// Canvas2D is a low-level graphics API that does NOT resolve CSS custom properties.
// Any call to addColorStop(offset, 'var(--color-x)'), fillStyle = 'var(--color-x)', etc.
// throws "The value provided ('var(--color-sky)') could not be parsed as a color."
// → caught by DOMContentLoaded catch → body.innerHTML replaced → #gameContent destroyed → blank page.
// Fix: use literal color values (hex '#87CEEB', rgba, or CSS named colors) in all Canvas API calls.
if (/addColorStop\s*\(\s*[\d.]+\s*,\s*['"]var\(/.test(html) ||
    /fillStyle\s*=\s*['"]var\(/.test(html) ||
    /strokeStyle\s*=\s*['"]var\(/.test(html)) {
  errors.push(
    'ERROR: Canvas API call with CSS variable — Canvas2D does not resolve CSS custom properties. ' +
      'addColorStop(offset, \'var(--color-x)\'), ctx.fillStyle = \'var(--color-x)\', etc. throw ' +
      '"The value provided (\'var(--color-sky)\') could not be parsed as a color" → blank page. ' +
      'Fix: use literal color values in Canvas API: \'#87CEEB\', \'rgba(135,206,235,1)\', \'skyblue\'. ' +
      'Never pass CSS variables to Canvas API calls. (right-triangle-area build #540 root cause)'
  );
}

// ─── 5f7. progressBar.timer — ProgressBarComponent does NOT expose a .timer property ──────────
// ProgressBarComponent tracks lives (hearts) and round progress only.
// It does NOT expose a .timer property. The pattern:
//   progressBar = new ProgressBarComponent(...);
//   timer = progressBar.timer;  ← undefined
//   timer.start();              ← TypeError: Cannot read properties of undefined (reading 'start')
// crashes at runtime with "Cannot read properties of undefined" → caught by DOMContentLoaded catch
// → body.innerHTML replaced → #gameContent destroyed → Step 1d blank page.
// Fix: create TimerComponent separately:
//   const timer = new TimerComponent('timer-container', { timerType: 'decrease', ... });
//   timer.start();
if (/progressBar\s*\.\s*timer\b/.test(html)) {
  errors.push(
    'ERROR: progressBar.timer — ProgressBarComponent does NOT expose a .timer property. ' +
      '"progressBar.timer" is undefined → timer.start() throws "Cannot read properties of undefined (reading \'start\')" → blank page. ' +
      'Fix: create TimerComponent separately: const timer = new TimerComponent(\'timer-container\', { timerType: \'decrease\', startTime: N, endTime: 0, onEnd: handleTimeout }); timer.start(); ' +
      'ProgressBarComponent is for lives/round display ONLY — NOT for timer management. ' +
      '(right-triangle-area build #541 root cause)'
  );
}

// ─── 5f9. progressBar.init() — ProgressBarComponent has no .init() method ───
// ProgressBarComponent API: constructor (creates+renders), .update(round, total), .destroy().
// NO .init(), .start(), .reset(), .setLives(), or any other methods.
// Calling progressBar.init() → TypeError: progressBar.init is not a function → blank page.
if (/progressBar\s*\.\s*init\s*\(/.test(html)) {
  errors.push(
    'ERROR: progressBar.init() — ProgressBarComponent has NO .init() method. ' +
      'ProgressBarComponent API is: constructor(slotId, config) + .update(currentRound, totalRounds) + .destroy(). ' +
      'There is NO .init(), .start(), .reset(), or .setLives() method. ' +
      'Calling progressBar.init() throws "progressBar.init is not a function" → blank page. ' +
      'Fix: remove the progressBar.init() call — the constructor already initializes the component. ' +
      'Use progressBar.update(0, totalRounds) to set the initial display state after construction. ' +
      '(right-triangle-area build #543 root cause)'
  );
}

// ─── 5f10. progressBar hallucinated methods — .start(), .reset(), .setLives(), .pause(), .resume() ─
// ProgressBarComponent API is EXACTLY: constructor(slotId, config) + .update(roundsCompleted, lives) + .destroy().
// These methods do NOT exist and will throw "progressBar.X is not a function" → blank page:
//   progressBar.start()    — no such method; autoStart is a constructor option, not a method
//   progressBar.reset()    — no such method; re-create the instance to reset
//   progressBar.setLives() — no such method; pass lives to progressBar.update(round, lives)
//   progressBar.pause()    — no such method; ProgressBarComponent has no pause state
//   progressBar.resume()   — no such method; ProgressBarComponent has no resume state
// All of these throw TypeError at runtime → caught by DOMContentLoaded catch → blank page.
const HALLUCINATED_PROGRESSBAR_METHODS = [
  { method: 'start', hint: 'autoStart is a constructor config option, not a method' },
  { method: 'reset', hint: 're-create the ProgressBarComponent instance to reset, or call progressBar.update(0, totalLives)' },
  { method: 'setLives', hint: 'pass lives as second arg to progressBar.update(roundsCompleted, lives)' },
  { method: 'pause', hint: 'ProgressBarComponent has no pause state — no method needed' },
  { method: 'resume', hint: 'ProgressBarComponent has no resume state — no method needed' },
];
for (const { method, hint } of HALLUCINATED_PROGRESSBAR_METHODS) {
  if (new RegExp(`progressBar\\s*\\.\\s*${method}\\s*\\(`).test(html)) {
    errors.push(
      `ERROR: progressBar.${method}() — ProgressBarComponent has NO .${method}() method. ` +
        'ProgressBarComponent API is: constructor(slotId, config) + .update(roundsCompleted, lives) + .destroy(). ' +
        `There is NO .init(), .start(), .reset(), .setLives(), .pause(), or .resume() method. ` +
        `Calling progressBar.${method}() throws "progressBar.${method} is not a function" → blank page. ` +
        `Fix: ${hint}. (T1 §5f10)`
    );
  }
}

// ─── 5f11. GEN-112: ProgressBarComponent positional string arg (wrong API) ───
// ProgressBarComponent correct API: new ProgressBarComponent({ autoInject: true, totalRounds: N, totalLives: N, slotId: 'mathai-progress-slot' })
// WRONG: new ProgressBarComponent('mathai-progress-bar-slot', { totalRounds: 5 })
// The positional string form causes a silent crash — the slot is never found and the
// button dismiss callback is never wired → transitionScreen button never dismisses → game stuck.
// Also check for the wrong 3-arg update() call — correct signature is (currentRound, lives).
if (/new\s+ProgressBarComponent\s*\(\s*['"`]/.test(html)) {
  errors.push(
    'ERROR: ProgressBarComponent uses positional string arg — this causes a silent crash → transitionScreen button never dismisses → game stuck. ' +
      "WRONG: new ProgressBarComponent('mathai-progress-bar-slot', { totalRounds: 5 }). " +
      "RIGHT: new ProgressBarComponent({ autoInject: true, totalRounds: gameState.totalRounds, totalLives: gameState.totalLives, slotId: 'mathai-progress-slot' }). " +
      'Use the options-object API — the string-first form is not supported. (GEN-112, find-triangle-side build #547 root cause)'
  );
}
if (/progressBar\s*\.\s*update\s*\(\s*\S[^)]*,\s*\S[^)]*,\s*\S[^)]*\)/.test(html)) {
  errors.push(
    'ERROR: progressBar.update() called with 3 args — correct signature is progressBar.update(currentRound, lives) (2 args only). ' +
      'WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives). ' +
      'RIGHT: if (progressBar) progressBar.update(gameState.currentRound, gameState.lives). ' +
      'Also add a null guard: if (progressBar) before calling update(). (GEN-112, find-triangle-side build #547 root cause)'
  );
}

// ─── 5f8. TimerComponent slot not created by ScreenLayout ───────────────────
// If a CDN game instantiates new TimerComponent('mathai-timer-slot', ...) but
// ScreenLayout.inject() does not include timer: true in the slots config, the
// 'mathai-timer-slot' div will never be created → TimerComponent constructor throws
// 'Container with id "mathai-timer-slot" not found' → blank page.
// Fix: Add timer: true to ScreenLayout.inject slots:
//   ScreenLayout.inject('app', { slots: { progressBar: true, timer: true } })
// OR: Remove the standalone TimerComponent and use ProgressBarComponent showTimer: true only.
if (
  /new\s+TimerComponent\s*\(\s*['"`]mathai-timer-slot['"`]/.test(html) &&
  !/slots\s*:\s*\{[^}]*timer\s*:\s*true/.test(html)
) {
  errors.push(
    'ERROR: new TimerComponent(\'mathai-timer-slot\', ...) but ScreenLayout.inject() does not include timer: true in slots. ' +
      'The \'mathai-timer-slot\' div is only created when ScreenLayout.inject(..., { slots: { timer: true } }) is called. ' +
      'Without it, TimerComponent throws "Container with id \\"mathai-timer-slot\\" not found" → blank page. ' +
      'Fix: change ScreenLayout.inject(\'app\', { slots: { progressBar: true } }) to ' +
      'ScreenLayout.inject(\'app\', { slots: { progressBar: true, timer: true } }). ' +
      '(right-triangle-area build #542 root cause)'
  );
}

// ─── 5f3. Late-loading CDN components — must be checked in waitForPackages() ─
// The CDN bundle loads components sequentially: ScreenLayout (step 2) → ProgressBarComponent
// (step 3) → TransitionScreenComponent (step 4) → TimerComponent (step 7, last).
// Any game that calls new X() on these components must include a typeof guard in the
// waitForPackages() while-loop, or the game crashes with ReferenceError at init.
//
// IMPORTANT: CDN components may be accessed as bare globals (typeof TimerComponent) OR
// via window.components (typeof window.components?.TimerComponent). Both forms are valid.
// The regex must accept either form — failing to do so causes a false-positive that triggers
// the static-fix LLM, which then introduces broken bare-global checks for window.components
// games, causing waitForPackages() to spin forever → blank page. (Lesson: right-triangle-area
// builds #530 failure root cause.)
if (
  /\bTimerComponent\b/.test(html) &&
  !/typeof\s+TimerComponent/.test(html) &&
  !/typeof\s+window\.components\??\.TimerComponent/.test(html) &&
  !/window\.components\??\.TimerComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR: TimerComponent is used but typeof TimerComponent is not in waitForPackages() check — TimerComponent loads at CDN step 7, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before TimerComponent is defined → ReferenceError → blank page. ' +
    'Add ONE of these to the waitForPackages while-loop condition:\n' +
    '  Option A (bare global): `|| typeof TimerComponent === "undefined"`\n' +
    '  Option B (window.components): `|| typeof window.components?.TimerComponent === "undefined"`'
  );
}
if (
  /\bTransitionScreenComponent\b/.test(html) &&
  !/typeof\s+TransitionScreenComponent/.test(html) &&
  !/typeof\s+window\.components\??\.TransitionScreenComponent/.test(html) &&
  !/window\.components\??\.TransitionScreenComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR: TransitionScreenComponent is used but typeof TransitionScreenComponent is not in waitForPackages() check — it loads at CDN step 4, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before TransitionScreenComponent is defined → ReferenceError → blank page. ' +
    'Add ONE of these to the waitForPackages while-loop condition:\n' +
    '  Option A (bare global): `|| typeof TransitionScreenComponent === "undefined"`\n' +
    '  Option B (window.components): `|| typeof window.components?.TransitionScreenComponent === "undefined"`'
  );
}
if (
  /\bProgressBarComponent\b/.test(html) &&
  !/typeof\s+ProgressBarComponent/.test(html) &&
  !/typeof\s+window\.components\??\.ProgressBarComponent/.test(html) &&
  !/window\.components\??\.ProgressBarComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR: ProgressBarComponent is used but typeof ProgressBarComponent is not in waitForPackages() check — it loads at CDN step 3, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before ProgressBarComponent is defined → ReferenceError → blank page. ' +
    'Add ONE of these to the waitForPackages while-loop condition:\n' +
    '  Option A (bare global): `|| typeof ProgressBarComponent === "undefined"`\n' +
    '  Option B (window.components): `|| typeof window.components?.ProgressBarComponent === "undefined"`'
  );
}

// ─── 5f4. TimerComponent constructor signature check ─────────────────────────
// TimerComponent constructor: new TimerComponent('container-id', { options })
// First argument MUST be the container element ID string — NOT a DOM element
// and NOT an options object. Passing an object causes:
//   'Container with id [object Object] not found' → init crash → blank page.
// Root cause of disappearing-numbers #442 + keep-track #452 failures (Lessons 98, 99).
// Upgraded to ERROR (was WARNING) — keep-track failed 3 consecutive builds with this
// pattern because WARNING was not addressed by the static-fix LLM call (Lesson 99).
if (/\bTimerComponent\b/.test(html)) {
  // Detect wrong patterns: new TimerComponent({ ... }) or new TimerComponent(document.
  if (/new\s+TimerComponent\s*\(\s*\{/.test(html) || /new\s+TimerComponent\s*\(\s*document\./.test(html)) {
    errors.push(
      'ERROR: TimerComponent called with wrong first argument — this causes a blank page crash. ' +
        "Correct: new TimerComponent('container-id', { options }). " +
        'WRONG: new TimerComponent({ container: element, ... }) or new TimerComponent(document.getElementById(...)). ' +
        "First arg must be the element ID string, not a DOM element or options object. " +
        "Also: TimerComponent MUST be initialized AFTER ScreenLayout.inject() + template clone, " +
        "since #timer-container lives inside the game template and is not in the live DOM until the template is cloned (Lesson 99)."
    );
  }
}

// ─── 5g. Debug functions on window — ALLOWED (specs require them on window)
// PART-012 debug functions (debugGame, testAudio, testPause, testResume, testSentry,
// verifySentry) SHOULD be assigned to window per spec. All approved games have them on
// window and the review model does NOT reject them. No check here — this is correct behavior.

// ─── 5h. Hallucinated SignalCollector API method check ───────────────────────
// signalCollector.trackEvent() does NOT exist in the CDN SignalCollector API.
// LLMs hallucinate this method, causing:
//   "Init error: signalCollector.trackEvent is not a function" at runtime.
// Correct methods: recordViewEvent(), recordCustomEvent(), startProblem(),
//   endProblem(), seal(), pause(), resume().
// Root cause of right-triangle-area builds #527, #530, #532 failures.
if (/signalCollector\.trackEvent\s*\(/.test(html)) {
  errors.push(
    'ERROR: signalCollector.trackEvent() does not exist in CDN API. ' +
      'Use signalCollector.recordViewEvent(eventType, data) or signalCollector.recordCustomEvent(eventType, data) instead. ' +
      'Full SignalCollector API: recordViewEvent(eventType, data), recordCustomEvent(eventType, data), ' +
      'startProblem(id, data), endProblem(id, outcome), seal(), pause(), resume(). ' +
      'Calling .trackEvent() throws "signalCollector.trackEvent is not a function" at runtime → init crash → blank page.',
  );
}

// ─── 5h2. SentryHelper in waitForPackages — not a real CDN global ─────────────
// SentryHelper does NOT exist as a window global in any CDN bundle.
// The sentry bundle exports window.SentryConfig (not SentryHelper).
// Adding typeof SentryHelper to waitForPackages() causes it to hang forever
// (SentryHelper is always undefined) → blank page → Step 1d failure.
// Root cause of builds #536, #537 failures.
if (/typeof\s+SentryHelper\s*===\s*['"]undefined['"]/.test(html) ||
    /typeof\s+SentryHelper\s*!==/.test(html)) {
  errors.push(
    'ERROR: typeof SentryHelper check found in waitForPackages() — SentryHelper is NOT a CDN global. ' +
    'The sentry bundle exports window.SentryConfig (not SentryHelper). ' +
    'Adding SentryHelper to waitForPackages() causes it to hang FOREVER → blank page. ' +
    'Remove SentryHelper from waitForPackages(). ' +
    'To check for the sentry package, use: typeof SentryConfig === "undefined" (or omit entirely — sentry loads synchronously).',
  );
}

// ─── 5fa. waitForPackages() wrong CDN check pattern — truthy instead of typeof ─
// The correct CDN package check is:
//   while (typeof FeedbackManager === 'undefined') { ... }
// LLMs sometimes write:
//   while (!window.FeedbackManager) { ... }   ← WRONG
//   while (!FeedbackManager) { ... }           ← WRONG
// The truthy check (!window.X) fails when the CDN package loads but evaluates to
// a falsy value during initialization. The review model explicitly rejects this:
// "waitForPackages() while loop does not check typeof FeedbackManager === 'undefined'"
// Root cause of build #544 (soh-cah-toa-worked-example) review rejection.
// Only flag when waitForPackages() is present (CDN game) and the while condition
// uses ! negation on a CDN package name (FeedbackManager, ScreenLayout, etc.)
// without any typeof guard in the same while condition.
if (hasWaitForPackages) {
  const CDN_PACKAGES = [
    'FeedbackManager',
    'ScreenLayout',
    'ProgressBarComponent',
    'TransitionScreenComponent',
    'TimerComponent',
  ];
  for (const pkg of CDN_PACKAGES) {
    // Match: while (!window.Pkg) or while (!Pkg) — with optional whitespace
    const wrongPattern = new RegExp(`while\\s*\\(\\s*!\\s*(?:window\\.)?${pkg}\\b`);
    if (wrongPattern.test(html)) {
      errors.push(
        `ERROR: waitForPackages() uses wrong CDN check pattern — while (!${pkg}) or while (!window.${pkg}). ` +
        'The truthy check (!X) is unreliable; the review model requires: ' +
        `while (typeof ${pkg} === 'undefined') { ... } — use typeof, not truthy/falsy. ` +
        `Fix: replace 'while (!${pkg})' or 'while (!window.${pkg})' with ` +
        `'while (typeof ${pkg} === "undefined")'. ` +
        '(T1 §5fa — build #544 soh-cah-toa-worked-example review rejection root cause)'
      );
    }
  }
}

// ─── 6. postMessage communication ───────────────────────────────────────────
requirePattern('postMessage', 'postMessage for parent frame communication');

// ─── 7. Game state initialization ───────────────────────────────────────────
const hasGameState =
  /gameState\s*=\s*\{/.test(html) ||
  /let\s+gameState/.test(html) ||
  /var\s+gameState/.test(html) ||
  /const\s+gameState/.test(html);
if (!hasGameState) {
  errors.push('MISSING: No gameState object initialization found');
}

// ─── 8. Star scoring ─────────────────────────────────────────────────────────
// Accept any star-scoring pattern:
// (a) Time-based: 0.8/0.5 or 80%/50% thresholds (adjustment-strategy style)
// (b) Score/count-based: calcStars(), stars = N, starRating, numStars, etc. (CDN game style)
const has80 = /0\.8\b/.test(html) || /80\s*%/.test(html) || />=\s*80/.test(html);
const has50 = /0\.5\b/.test(html) || /50\s*%/.test(html) || />=\s*50/.test(html);
const hasStarCalc =
  /calcStar|getStar|starRating|numStar|starCount/.test(html) ||
  /(?:var|let|const)\s+stars\b/.test(html) ||
  /stars\s*[=<>!]+\s*[0-9]/.test(html) ||
  /[=:?]\s*3\b.*star|star.*[=:?]\s*3\b/i.test(html);
if ((!has80 || !has50) && !hasStarCalc) {
  errors.push('MISSING: Star scoring not found — need 0.8/0.5 thresholds or calcStars()/stars=N/var stars pattern');
}

// ─── 9. Responsive layout ───────────────────────────────────────────────────
const has480 = /480\s*px/.test(html);
const hasMaxWidth = /max-width\s*:\s*\d+px/i.test(html);
if (!has480 && !hasMaxWidth) {
  errors.push('MISSING: No 480px or max-width constraint found (required for mobile-first responsive layout)');
}

// ─── 10. File size sanity ───────────────────────────────────────────────────
if (html.length < 1000) {
  errors.push(`FILE TOO SMALL: ${html.length} characters — likely incomplete generation`);
}
if (html.length > 500000) {
  warnings.push(`WARNING: File very large (${html.length} characters) — may have issues`);
}
// Check for truncated HTML (missing closing tags)
if (!/<\/html\s*>/i.test(html)) {
  errors.push('MISSING: </html> closing tag — HTML appears truncated (possible LLM token limit hit)');
}

// ─── 11. game_over star display ─────────────────────────────────────────────
// If the game sets gameState.phase = 'game_over' or 'gameover', it MUST have
// visible star/rating display logic for that code path.
// Missing star display in game-over path is a top review rejection pattern.
const hasGameOverPhase =
  /gameState\s*\.\s*phase\s*=\s*['"]game_over['"]/.test(html) ||
  /gameState\s*\.\s*phase\s*=\s*['"]gameover['"]/.test(html) ||
  /phase\s*===\s*['"]game_over['"]/.test(html) ||
  /phase\s*===\s*['"]gameover['"]/.test(html);
if (hasGameOverPhase) {
  // Check that star/rating display appears in or near the game_over section
  const hasStarDisplay =
    /☆|★/.test(html) ||
    /star.*display|display.*star/i.test(html) ||
    /starsDisplay|stars-display|starRating/i.test(html) ||
    /innerHTML.*star|star.*innerHTML/i.test(html) ||
    /textContent.*star|star.*textContent/i.test(html) ||
    /getElementById\s*\(\s*['"]stars/i.test(html) ||
    /querySelector\s*\(\s*['"][^'"]*stars/i.test(html) ||
    /data-testid\s*=\s*['"]stars/i.test(html);
  if (!hasStarDisplay) {
    warnings.push(
      'WARNING: game_over phase set but no star/rating display element found — game-over screen must show star ratings (e.g. ☆☆☆ for 0 stars). Review model rejects blank game-over screens.',
    );
  }
}

// ─── W4. gameState.phase assignments should have syncDOMState() nearby ───────
// syncDOMState() (injected by test harness) reads window.gameState.phase to set
// data-phase on #app. If a phase assignment happens without a nearby syncDOMState()
// call, data-phase is never updated → ALL waitForPhase() calls timeout.
// Rule 21 in gen prompts requires this but LLMs frequently miss it.
// Scan every phase assignment and check that syncDOMState() appears within
// 200 characters before or after the assignment.
const phaseAssignRe = /gameState\.phase\s*=\s*['"`\w]/g;
const syncCallRe = /syncDOMState\(\)/;
const phaseAssignments = [];
{
  let m;
  while ((m = phaseAssignRe.exec(html)) !== null) {
    const start = Math.max(0, m.index - 200);
    const end = Math.min(html.length, m.index + 200);
    phaseAssignments.push(html.slice(start, end));
  }
}
if (phaseAssignments.length > 0) {
  const withoutSync = phaseAssignments.filter((ctx) => !syncCallRe.test(ctx));
  if (withoutSync.length > 0) {
    warnings.push(
      `Check W4: ${withoutSync.length}/${phaseAssignments.length} gameState.phase assignments lack nearby syncDOMState() call — waitForPhase() tests will timeout`,
    );
  }
}

// ─── W3. data-testid on interactive elements ────────────────────────────────
// Mechanics tests target [data-testid="answer-btn"], [data-testid="submit"], etc.
// If the majority of interactive elements lack data-testid, tests will fail to find
// elements and ALL mechanics assertions produce locator errors.
// ERROR when >80% of interactive elements are missing testids (systematic omission).
// WARNING when 50–80% are missing (partial omission, may still cause failures).
const interactiveEls = html.match(/<(button|input|select)[^>]*>/gi) || [];
const withoutTestId = interactiveEls.filter((el) => !el.includes('data-testid'));
if (withoutTestId.length > 0 && interactiveEls.length > 0) {
  const pct = Math.round((withoutTestId.length / interactiveEls.length) * 100);
  if (pct > 80) {
    errors.push(
      `MISSING data-testid: ${withoutTestId.length}/${interactiveEls.length} interactive elements (button/input/select) lack data-testid attributes — mechanics tests cannot find elements and ALL assertions will fail. Every <button>, <input>, <select> must have data-testid (e.g. data-testid="answer-btn", data-testid="submit-btn", data-testid="option-0").`,
    );
  } else if (pct > 50) {
    warnings.push(
      `Check W3: ${withoutTestId.length}/${interactiveEls.length} interactive elements (button/input/select) lack data-testid attributes — mechanics tests will likely fail`,
    );
  }
}

// ─── 5h. TransitionScreen await check ────────────────────────────────────────
// ALL transitionScreen.show() calls MUST be awaited. Without await the show()
// resolves before animation completes → onComplete fires late → race condition:
// next-round setup runs before transition slot is visible → ALL game-flow tests fail.
// (Rule 25 in gen prompts; review rejects "TransitionScreen not awaited" pattern)
const hasTransitionScreenShow = /transitionScreen\s*\.\s*show\s*\(/.test(html);
if (hasTransitionScreenShow) {
  // Check for unawaited calls: transitionScreen.show( not preceded by 'await '
  // Use a heuristic: count total show() calls vs awaited show() calls
  const allShowCalls = (html.match(/transitionScreen\s*\.\s*show\s*\(/g) || []).length;
  const awaitedShowCalls = (html.match(/await\s+transitionScreen\s*\.\s*show\s*\(/g) || []).length;
  if (awaitedShowCalls < allShowCalls) {
    const unawaited = allShowCalls - awaitedShowCalls;
    errors.push(
      `ERROR: ${unawaited}/${allShowCalls} transitionScreen.show() call(s) are not awaited — ALL calls including the initial start-screen call MUST use await transitionScreen.show({...}). ` +
        'Unawaited calls corrupt the CDN component internal state machine: subsequent await transitionScreen.show() calls in nextRound/endGame silently hang ' +
        'with the button visibility:hidden (Lesson 101, keep-track #465). Fix: add await before every transitionScreen.show() call.'
    );
  }
}

// ─── 12. isActive / isProcessing guard ──────────────────────────────────────
// Answer/click handlers MUST check an isActive or isProcessing guard to prevent
// double-triggering. Missing guard is a top review rejection pattern.
const hasClickHandlers =
  /addEventListener\s*\(\s*['"](?:click|touchstart|pointerdown)['"]/.test(html) ||
  /\.onclick\s*=/.test(html);
if (hasClickHandlers) {
  const hasGuard = /isActive|isProcessing|isAnswering|isHandling/.test(html);
  if (!hasGuard) {
    warnings.push(
      'WARNING: Click/interaction handlers found but no isActive/isProcessing guard detected — every answer handler must check a boolean guard to prevent double-triggering (e.g. if (!isActive) return; isActive = false; ... isActive = true;). Review model rejects missing guards.',
    );
  } else {
    // Guard variable exists — also check it is initialized in the gameState object
    // (not just used in handlers). If handlers check gameState.isActive but it is
    // never set in the gameState init, every handler returns immediately on first call.
    const hasGameStateIsActive = /gameState\s*[=\{][^}]*isActive\s*:\s*(?:true|false)/.test(html);
    const handlersCheckGameStateIsActive = /gameState\s*\.\s*isActive/.test(html);
    if (handlersCheckGameStateIsActive && !hasGameStateIsActive) {
      warnings.push(
        'WARNING: gameState.isActive used in handlers but isActive not found in gameState init object — add isActive: true to window.gameState = { ..., isActive: true, ... }. If isActive is undefined, every if(!gameState.isActive) check returns immediately, blocking ALL interactions.',
      );
    }
  }
}

// ─── 7b. Mobile viewport scrollability check ────────────────────────────────
// body/html overflow:hidden blocks mobile scroll — all options must be reachable
if (/body\s*\{[^}]*overflow\s*:\s*hidden/s.test(html)) {
  warnings.push(
    'MOBILE-SCROLL: body has overflow:hidden — game content may be unreachable on mobile (480×800). Use overflow-y:auto on the content container instead',
  );
}
if (/user-scalable\s*=\s*no/.test(html)) {
  warnings.push(
    'MOBILE-VIEWPORT: user-scalable=no prevents mobile zoom and accessibility — use user-scalable=yes or omit it',
  );
}

// ─── 5i. startGame() synchronous check ──────────────────────────────────────
// startGame() MUST be synchronous — no setTimeout() wrapper inside it.
// CDN TransitionScreen auto-dismisses #mathai-transition-slot ONLY when the
// action callback returns synchronously. Wrapping the body in setTimeout defers
// execution: the callback returns immediately, the CDN keeps the slot rendered,
// and every test that calls startGame() fails on slot assertion.
// Root cause of soh-cah-toa-worked-example build #531 (ALL game-flow + mechanics
// tests failed because startGame() wrapped logic in setTimeout(() => {...}, 0)).
const hasStartGame =
  /function\s+startGame\s*\(/.test(html) || /startGame\s*=\s*(?:async\s+)?\(/.test(html);
if (hasStartGame) {
  // Find startGame function body using brace-depth tracking
  const startGameMatch = html.match(
    /(?:function\s+startGame\s*\([^)]*\)|startGame\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*\{/,
  );
  if (startGameMatch) {
    const bodyStart = startGameMatch.index + startGameMatch[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < html.length && depth > 0) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') depth--;
      i++;
    }
    const fnBody = html.slice(bodyStart, i - 1);
    if (/setTimeout\s*\(/.test(fnBody)) {
      errors.push(
        "ERROR: startGame() must be synchronous — no setTimeout() wrapper. " +
          "CDN TransitionScreen auto-dismisses #mathai-transition-slot ONLY when the action callback returns synchronously; " +
          "setTimeout defers execution and keeps the slot visible, breaking all game-flow tests. " +
          "Move all init logic directly into startGame() without a setTimeout wrapper. " +
          "(Root cause: soh-cah-toa-worked-example build #531, RULE-SYNC-1)"
      );
    }
  }
}

// ─── 5j. window.mira.components namespace hallucination ──────────────────────
// window.mira does NOT exist in the CDN. CDN components are bare window globals.
// LLM hallucinates window.mira.components namespace causing all component
// consts to be undefined, making waitForPackages() spin forever → #gameContent
// never created → blank page.
if (/window\.mira\.components/.test(html)) {
  errors.push(
    'ERROR: window.mira.components does not exist in CDN. ' +
    'CDN components are bare window globals: window.ScreenLayout, ' +
    'window.ProgressBarComponent, window.TransitionScreenComponent, ' +
    'window.TimerComponent, window.VisibilityTracker. ' +
    'Never destructure from window.mira — it does not exist. ' +
    'Correct: const sl = window.ScreenLayout; or use directly in waitForPackages().',
  );
}

// ─── 5k. Hallucinated CDN namespace patterns ─────────────────────────────────
// CDN components are BARE WINDOW GLOBALS — not namespaced under any sub-object.
// LLMs hallucinate various namespace patterns that do not exist in the CDN:
//   window.cdn.*          — not a CDN namespace
//   window.mathai.*       — not a CDN namespace
//   window.Ralph.*        — not a CDN namespace
//   window.homeworkapp.*  — not a CDN namespace
// Note: window.components is intentionally excluded — it IS a valid CDN access pattern
// (e.g. window.components?.TimerComponent) and is explicitly supported in 5f3.
// Note: window.mira.components is handled separately in 5j above.
//
// Valid bare globals: window.ScreenLayout, window.ProgressBarComponent,
// window.TransitionScreenComponent, window.TimerComponent,
// window.VisibilityTracker, window.FeedbackManager,
// window.SignalCollector (NOT signalCollector — assigned as a const from window.SignalCollector),
// window.SentryHelper
const CDN_COMPONENT_NAMES = /ScreenLayout|ProgressBarComponent|TransitionScreen|TimerComponent|VisibilityTracker|FeedbackManager|SignalCollector|SentryHelper/;
const HALLUCINATED_NAMESPACES = /window\.(cdn|mathai|Ralph|homeworkapp)\./i;
if (HALLUCINATED_NAMESPACES.test(html) && CDN_COMPONENT_NAMES.test(html)) {
  const match = html.match(HALLUCINATED_NAMESPACES);
  errors.push(
    `ERROR: Hallucinated CDN namespace detected: "${match[0]}" — this object does NOT exist. ` +
      'CDN components are bare window globals, not namespaced under any sub-object. ' +
      'Valid CDN globals: window.ScreenLayout, window.ProgressBarComponent, ' +
      'window.TransitionScreenComponent, window.TimerComponent, window.VisibilityTracker, ' +
      'window.FeedbackManager, window.SignalCollector, window.SentryHelper. ' +
      'Never write window.cdn.X, window.mathai.X, window.Ralph.X, or window.homeworkapp.X — ' +
      'these throw TypeError at runtime. Use bare globals directly.',
  );
}

// ─── 5l. require() / import in game script — CDN is not CommonJS/ESM ─────────
// Generated HTML must be a single self-contained file. CDN components are loaded
// via <script> tags, NOT via require() or ES import statements.
// LLMs sometimes hallucinate Node.js-style require() or ESM imports for CDN packages,
// which cause "require is not defined" or "Cannot use import statement" at runtime.
//
// Strategy: look for require() calls that reference CDN package names inside <script> blocks,
// and top-level `import X from` statements (which only work in type="module" scripts).
// We allow `require` in comments and in test-harness scripts (id="ralph-test-harness").
// We also allow window.require (some game engines define it) — we only flag bare require().
const CDN_PACKAGE_NAMES = /feedback-manager|@mathai\/|mathai-components|ralph-cdn|homeworkapp-cdn/;
// Check for require() calls that reference CDN package names
if (/\brequire\s*\(\s*['"]/.test(html) && CDN_PACKAGE_NAMES.test(html)) {
  errors.push(
    'ERROR: require() used to load CDN packages — this is not CommonJS/Node.js. ' +
      'CDN components are loaded via <script> tags, not require(). ' +
      '"require is not defined" at runtime. ' +
      'Remove require() calls and use the bare globals that CDN <script> tags expose: ' +
      'ScreenLayout, ProgressBarComponent, TransitionScreenComponent, TimerComponent, ' +
      'VisibilityTracker, FeedbackManager, SignalCollector.',
  );
}
// Check for ES module import statements referencing CDN packages
if (/^import\s+\S+\s+from\s+['"]/.test(html) && CDN_PACKAGE_NAMES.test(html)) {
  errors.push(
    'ERROR: ES module import statement used to load CDN packages — generated HTML must be a ' +
      'plain <script> (not type="module"). CDN components are loaded via <script> src= tags ' +
      'and exposed as bare window globals. import statements throw "Cannot use import statement" ' +
      'unless the script has type="module", which is incompatible with the CDN pattern.',
  );
}

// ─── Output results ─────────────────────────────────────────────────────────
if (warnings.length > 0) {
  warnings.forEach((w) => console.log(w));
}

if (errors.length > 0) {
  console.log(`\nSTATIC VALIDATION FAILED — ${errors.length} error(s):`);
  errors.forEach((e) => console.log(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log(`Static validation passed (${warnings.length} warning(s))`);
  process.exit(0);
}
