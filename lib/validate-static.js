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

requirePattern(/function\s+endGame\s*\(/, 'endGame() function declaration');

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
  const fnMatch = html.match(new RegExp(`((?:async\\s+)?function\\s+${fnName}\\s*\\([^)]*\\)\\s*\\{)([\\s\\S]*?)(?=\\nfunction |\\n(?:const|let|var)\\s+\\w|\\n\\/\\/\\s*─|$)`));
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
// If the HTML defines waitForPackages(), it MUST have a ≤10s timeout (10000ms)
// that throws on expiry. Review model checks this against verification-checklist
// item: "waitForPackages() has a timeout (≤10s) with error handling"
const hasWaitForPackages = /function\s+waitForPackages\s*\(/.test(html);
if (hasWaitForPackages) {
  const hasTimeout10s = /10000/.test(html);
  const hasThrowOnTimeout = /throw\s+new\s+Error/.test(html);
  if (!hasTimeout10s) {
    errors.push(
      'MISSING: waitForPackages() must have timeout=10000 (≤10s) — review model rejects timeouts >10s or missing timeout'
    );
  }
  if (!hasThrowOnTimeout) {
    errors.push(
      'MISSING: waitForPackages() must throw new Error() on timeout — review model requires error handling (not console.error or silent)'
    );
  }
}

// ─── 5d. CDN window exposure check ──────────────────────────────────────────
// CDN games define endGame/restartGame inside DOMContentLoaded — they are NOT on
// window unless explicitly assigned. The test harness calls window.endGame etc.
// If DOMContentLoaded is used AND endGame is defined, window.endGame must be assigned.
// (Lesson 33 from lessons-learned.md)
if (hasDOMContentLoaded) {
  const hasEndGame = /function\s+endGame\s*\(/.test(html);
  if (hasEndGame) {
    const hasWindowEndGame = /window\s*\.\s*endGame\s*=/.test(html);
    if (!hasWindowEndGame) {
      errors.push(
        'MISSING: window.endGame = endGame — CDN games define endGame inside DOMContentLoaded (not on window). Must add window.endGame = endGame so test harness can call it.'
      );
    }
    // Check restartGame too if it exists
    const hasRestartGame = /function\s+restartGame\s*\(/.test(html);
    if (hasRestartGame && !/window\s*\.\s*restartGame\s*=/.test(html)) {
      errors.push(
        'MISSING: window.restartGame = restartGame — CDN games must expose restartGame on window for test harness access.'
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

// ─── 5f. initSentry() order check ────────────────────────────────────────────
// initSentry() must NOT be called synchronously in DOMContentLoaded before
// waitForPackages() resolves. If it is, it runs before the Sentry SDK is loaded
// → throws → prevents ScreenLayout.inject() from running → CDN slot never mounts.
// Pattern: DOMContentLoaded handler calls initSentry() outside of waitForPackages callback.
const hasInitSentry = /function\s+initSentry\s*\(/.test(html);
if (hasInitSentry && hasWaitForPackages && hasDOMContentLoaded) {
  // Check if initSentry() is called as a top-level statement in DOMContentLoaded
  // (i.e. not inside the .then() or async callback of waitForPackages)
  // Heuristic: initSentry() appears before waitForPackages( in the script
  const initSentryPos = html.indexOf('initSentry()');
  const waitForPackagesPos = html.indexOf('waitForPackages(');
  if (initSentryPos !== -1 && waitForPackagesPos !== -1 && initSentryPos < waitForPackagesPos) {
    errors.push(
      'FORBIDDEN: initSentry() called before waitForPackages() — Sentry SDK is not yet loaded. Move initSentry() call to inside the waitForPackages() callback/await, after packages are confirmed loaded.'
    );
  }
}

// ─── 5g. Debug functions on window check ─────────────────────────────────────
// PART-012 debug functions (debugGame, testAudio, testPause, testResume, testSentry,
// verifySentry) must NOT be assigned to window. Review model rejects this pattern.
// Keep them as local functions inside DOMContentLoaded.
const debugWindowPattern = /window\s*\.\s*(?:debugGame|testAudio|testPause|testResume|testSentry|verifySentry|debugAudio)\s*=/;
if (debugWindowPattern.test(html)) {
  errors.push(
    'FORBIDDEN: Debug functions assigned to window (window.debugGame/testAudio/testPause/testResume/testSentry/verifySentry) — PART-012 debug functions must be local (inside DOMContentLoaded), not on window. Review model rejects window-exposed debug functions.'
  );
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
  }
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
