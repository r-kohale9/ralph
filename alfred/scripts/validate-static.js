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
const vm = require('vm');

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

// ─── Per-game spec context ──────────────────────────────────────────────────
// Read once at validator startup from `games/<id>/spec.md` (sibling of HTML).
// Surfaces per-game design flags so validator rules can condition on them:
//
//   - floatingButton       (boolean)   — PART-050 opt-out. `false` disables
//                                         all FB-enforcement rules for this
//                                         game (author hand-rolls buttons per
//                                         PART-022). Mirrors PART-039's
//                                         `previewScreen: false` pattern.
//   - totalRounds          (integer)   — Shape 1 vs Shape 2/3 decisions.
//   - totalLives           (integer)   — Try Again applicability.
//   - retryPreservesInput  (boolean)   — Try Again UX sub-option.
//
// **Trust model.** These flags are authoritative per-game design parameters,
// written by the spec author during step 1 (Draft Spec) and approved by the
// user at step 2 (Validate Spec). Build / test / review sub-agents (steps 4+)
// MUST NOT modify `spec.md` — that's a scope violation and a trust breach.
// If a sub-agent writes `floatingButton: false` into spec.md during step 4 to
// silence a validator rule, the forgery will appear in `git diff` after the
// build. User reviews the diff before committing — that's the human-in-the-
// loop defense, matching the PART-039 model for `previewScreen: false`.
// See game-building/SKILL.md's "CRITICAL — spec.md and plan.md are READ-ONLY
// during step 4" rule.
const specContext = (function readSpecContext() {
  const out = {
    floatingButton: null,          // false => spec opted out of FB
    answerComponent: null,         // false => spec opted out of AnswerComponent (PART-051)
    totalRounds: null,             // integer
    totalLives: null,              // integer
    retryPreservesInput: null      // boolean
  };

  try {
    const specPath = path.join(path.dirname(htmlPath), 'spec.md');
    if (!fs.existsSync(specPath)) return out;
    const spec = fs.readFileSync(specPath, 'utf-8');

    // floatingButton: false — accepts varied markdown forms:
    //   `floatingButton: false`
    //   `- floatingButton: false`
    //   `**floatingButton:** false`
    //   `**Floating button:** false` (colon inside bold markers)
    //   `**Floating button**: false` (colon outside bold markers)
    //   `- Floating button: false`
    // Word boundary on `false` avoids matching "falsepositive" etc. The
    // two-word variant uses a permissive non-alphanumeric separator ({0,10})
    // to tolerate any combination of `:`, `**`, whitespace between label
    // and value.
    if (/\bfloatingButton\s*:\s*\*{0,2}\s*false\b/i.test(spec) ||
        /floating\s+button[^a-zA-Z0-9]{0,10}false\b/i.test(spec)) {
      out.floatingButton = false;
    }

    // answerComponent: false — same shape as floatingButton. PART-051 opt-out.
    if (/\banswerComponent\s*:\s*\*{0,2}\s*false\b/i.test(spec) ||
        /answer\s+component[^a-zA-Z0-9]{0,10}false\b/i.test(spec)) {
      out.answerComponent = false;
    }

    // totalRounds: `**Rounds:** 1`, `Rounds: 1`, `totalRounds: 1`.
    const roundsMatch = spec.match(/(?:\*\*)?(?:total)?[Rr]ounds(?:\*\*)?\s*:?\s*\*?\*?\s*(\d+)/);
    if (roundsMatch) out.totalRounds = parseInt(roundsMatch[1], 10);

    // totalLives: same shape.
    const livesMatch = spec.match(/(?:\*\*)?(?:total)?[Ll]ives(?:\*\*)?\s*:?\s*\*?\*?\s*(\d+)/);
    if (livesMatch) out.totalLives = parseInt(livesMatch[1], 10);

    // retryPreservesInput: boolean.
    const preserveMatch = spec.match(/(?:\*\*)?retryPreservesInput(?:\*\*)?\s*:?\s*\*?\*?\s*(true|false)\b/i);
    if (preserveMatch) out.retryPreservesInput = (preserveMatch[1].toLowerCase() === 'true');
  } catch (e) {
    // Spec unreadable — leave fields as null, rules default to strict.
  }

  return out;
})();

// Back-compat alias — existing FB-rules blocks reference `specOptOuts`.
const specOptOuts = specContext;

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

function hasPreviewScrollOwnerCss(source) {
  const hasSlotLock =
    /mathai-preview-slot[^{]*\{[^}]*height\s*:\s*100(?:dvh|vh|svh|lvh)/s.test(source) &&
    /mathai-preview-slot[^{]*\{[^}]*overflow\s*:\s*hidden/s.test(source);
  const hasBodyScrollOwner =
    /mathai-preview-body[^{]*\{[^}]*height\s*:\s*100(?:dvh|vh|svh|lvh)/s.test(source) &&
    /mathai-preview-body[^{]*\{[^}]*overflow-y\s*:\s*auto/s.test(source) &&
    /mathai-preview-body[^{]*\{[^}]*-webkit-overflow-scrolling\s*:\s*touch/s.test(source);
  return hasSlotLock && hasBodyScrollOwner;
}

function hasRootOverflowHiddenCss(source) {
  return /(?:html\s*,\s*body|body\s*,\s*html|html|body)\s*\{[^}]*overflow(?:-y)?\s*:\s*hidden/s.test(source);
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
forbidPattern(/\balert\s*\(/, 'alert() call in game code — use inline aria-live feedback div instead (GEN-UX-004)');

// Forbidden manual layout divs — CDN packages create these automatically
// Games that use previewScreen: true MUST NOT create mathai-* layout divs manually
const usesPreviewScreen = /previewScreen\s*:\s*true/.test(html);
if (usesPreviewScreen) {
  const forbiddenLayoutDivs = [
    { pattern: /class\s*=\s*["'][^"']*mathai-game-area/, name: '.mathai-game-area' },
    { pattern: /class\s*=\s*["'][^"']*mathai-instruction-zone/, name: '.mathai-instruction-zone' },
    { pattern: /id\s*=\s*["']previewOverlay["']/, name: '#previewOverlay' },
    { pattern: /class\s*=\s*["'][^"']*mathai-preview-overlay/, name: '.mathai-preview-overlay' },
    { pattern: /id\s*=\s*["']transitionOverlay["']/, name: '#transitionOverlay' },
    { pattern: /class\s*=\s*["'][^"']*mathai-transition-overlay/, name: '.mathai-transition-overlay' },
  ];
  for (const { pattern, name } of forbiddenLayoutDivs) {
    if (pattern.test(html)) {
      errors.push(`FORBIDDEN: Manual ${name} div created in HTML — CDN packages create layout automatically when previewScreen:true. Remove all manual mathai-* layout divs.`);
    }
  }
}

// signalCollector: restartable games should use reset() (not seal()). seal() removes listeners irreversibly.
const hasSignalCollector = /signalCollector/i.test(html);
if (hasSignalCollector) {
  const hasRestartGame = /function\s+restartGame\b|restartGame\s*=\s*function|restartGame\s*:\s*function/.test(html);
  const hasSeal = /signalCollector\s*[\.\?]\s*seal\s*\(/.test(html);
  const hasReset = /signalCollector\s*[\.\?]\s*reset\s*\(/.test(html);
  if (hasRestartGame && hasSeal && !hasReset) {
    errors.push('FORBIDDEN: signalCollector.seal() in a game with restartGame — seal() irreversibly removes DOM listeners and breaks the Try Again flow. Use signalCollector.reset() in restartGame and remove the seal() call from endGame. Use getMetadata() + getInputEvents().length for signal_event_count/signal_metadata in game_complete.');
  }
  if (hasRestartGame && !hasReset) {
    errors.push('MISSING: signalCollector.reset() call in restartGame — restart must call signalCollector.reset() to flush previous events and continue with the same listeners/batch numbering.');
  }
  const hasSpreadInPostMessage = /postMessage\s*\([^)]*\.\.\.\s*signalPayload/.test(html);
  if (hasSpreadInPostMessage) {
    errors.push('FORBIDDEN: ...signalPayload spread in postMessage — signal data is streamed to GCS via batch flushing, not included in game_complete postMessage');
  }

  // window.signalCollector must be assigned for platform access
  const hasNewSignalCollector = /new\s+SignalCollector\s*\(/.test(html);
  if (hasNewSignalCollector && !/window\.signalCollector\s*=/.test(html)) {
    errors.push('WARNING: SignalCollector instantiated but not assigned to window.signalCollector — platform needs window.signalCollector to access the instance. Add: window.signalCollector = signalCollector;');
  }
}

// ─── 5c. GEN-DND-KIT — PART-043 drag-and-drop enforcement ───────────────────
// Native HTML5 drag (draggable="true" + dataTransfer + dragstart/dragover/drop events)
// does NOT fire on mobile Safari/Chrome touch. All drag-and-drop games MUST use
// @dnd-kit/dom per PART-043. Detect native drag signals and fail the build with
// a direct pointer to PART-043.
// Native drag listeners are attached to DOM elements (document, element refs).
// dnd-kit legitimately uses `manager.monitor.addEventListener('dragstart', ...)` —
// exclude that form via lookbehind. Same for `.addEventListener` on a node whose
// preceding token is `.monitor`.
const nativeDragSignals = [
  { pattern: /\bdraggable\s*=\s*["']true["']/i, name: 'draggable="true" attribute' },
  {
    pattern: /(?<!\.monitor\s*\.\s*|\bmonitor\s*\.\s*)addEventListener\s*\(\s*["'](?:dragstart|dragend|dragover|dragleave|drop)["']/i,
    name: "addEventListener('dragstart|dragend|dragover|dragleave|drop', ...) on DOM element (not dnd-kit monitor)",
  },
  { pattern: /\bondrag(?:start|end|over|leave|enter)\s*=/i, name: 'ondragstart/ondragend/ondragover/ondragleave/ondragenter inline handler' },
  { pattern: /\bondrop\s*=/i, name: 'ondrop inline handler' },
  {
    // Only flag dataTransfer when used as a property (event.dataTransfer.setData, e.dataTransfer.getData).
    // dnd-kit does not use the native DataTransfer object at all.
    pattern: /\b(?:e|ev|event)\s*\.\s*dataTransfer\b|\bdataTransfer\s*\.\s*(?:setData|getData|setDragImage|clearData|types|files|items)/i,
    name: 'dataTransfer API (setData/getData/setDragImage)',
  },
];
const foundNativeDrag = nativeDragSignals.filter((s) => s.pattern.test(html));
const hasDndKitImport = /esm\.sh\/@dnd-kit\/dom|from\s+["']@dnd-kit\/dom/i.test(html);
const looksLikeDragGame =
  foundNativeDrag.length > 0 ||
  hasDndKitImport ||
  /\bdnd-tag\b|\bdrop-zone\b|\bdrag-item\b|\bdrop-slot\b/.test(html) ||
  /\bDragDropManager\b|\bnew\s+Draggable\s*\(|\bnew\s+Droppable\s*\(/.test(html);

if (foundNativeDrag.length > 0) {
  for (const { name } of foundNativeDrag) {
    errors.push(
      `FORBIDDEN: Native HTML5 drag API detected — ${name}. ` +
        `Native HTML5 drag does NOT fire on mobile Safari/Chrome touch devices. ` +
        `Use @dnd-kit/dom per PART-043 instead: ` +
        `import { DragDropManager, Draggable, Droppable } from 'https://esm.sh/@dnd-kit/dom@beta'. ` +
        `Read PART-043 (read_warehouse_part) and satisfy all 20 verification-matrix items (V1–V20). ` +
        `See lib/prompts.js rule GEN-DND-KIT.`,
    );
  }
}

if (looksLikeDragGame && !hasDndKitImport && foundNativeDrag.length === 0) {
  // Game has drag-shaped class names / drop zones but no dnd-kit import and no native drag either —
  // likely means the LLM rolled a custom pointer-event drag. Warn; contract validator + Playwright
  // will catch behavioural gaps.
  warnings.push(
    'WARNING: Drag-shaped HTML detected (drop-zone / drag-item / dnd-tag classes) but no @dnd-kit/dom import found. ' +
      'Per PART-043, every drag-and-drop game MUST load @dnd-kit/dom from https://esm.sh/@dnd-kit/dom@beta. ' +
      'Hand-rolled pointer-event drag implementations are not supported.',
  );
}

if (hasDndKitImport) {
  // Additional PART-043 CSS checks: touch-action: none must not appear on forbidden containers.
  const bodyOrHtmlTouchActionNone =
    /(?:^|[^\.\w-])(?:body|html|#app)\s*,?[^{]*\{[^}]*touch-action\s*:\s*none/i.test(html) ||
    /(?:body|html)\s*\{[^}]*touch-action\s*:\s*none/i.test(html);
  if (bodyOrHtmlTouchActionNone) {
    errors.push(
      'FORBIDDEN: touch-action: none on body / html / #app — this blocks ALL page scrolling on mobile. ' +
        'Per PART-043, touch-action: none MUST ONLY go on the individual draggable items (e.g. .dnd-tag). ' +
        'Never on body, html, #app, bank containers, or drop zones.',
    );
  }
  // Every drag game should destroy instances on round transition
  if (!/destroyDndRound|dndManager\s*\.\s*destroy|draggables\.forEach\s*\([^)]*\.destroy/i.test(html)) {
    warnings.push(
      'WARNING: @dnd-kit/dom used but no destroy logic detected (destroyDndRound / dndManager.destroy / draggables.forEach(d => d.destroy)). ' +
        'Per PART-043 §R3, all DnD instances must be destroyed at the start of every round AND in endGame() — ' +
        'stale instances silently break drag from round 2 onward.',
    );
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

// ─── 5b4. handlePostMessage signalCollector config check ─────────────────────
// PART-010: When SignalCollector is used, handlePostMessage must configure it
// from signalConfig. Without this, events accumulate but never flush to GCS.
if (hasSignalCollector && hasHandlePostMessage) {
  const scRequiredProps = ['flushUrl', 'playId', 'gameId', 'sessionId', 'contentSetId', 'studentId'];
  const scMissing = scRequiredProps.filter(
    (prop) => !new RegExp(`signalCollector\\.${prop}\\s*=`).test(html)
  );
  if (scMissing.length > 0) {
    errors.push(
      `ERROR [GEN-PM-SIGNALCONFIG]: handlePostMessage + SignalCollector detected but missing signalCollector property assignments. ` +
        `Missing: ${scMissing.join(', ')}. ` +
        'handlePostMessage MUST configure all 6 SignalCollector properties from signalConfig: ' +
        'flushUrl, playId, gameId, sessionId, contentSetId, studentId. ' +
        'Then call signalCollector.startFlushing(). See PART-010 "Batch Flushing" section.'
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

  // GEN-113: FeedbackManager.init() is REQUIRED for all games that use FeedbackManager.
  // It initializes SubtitleComponent and StickerComponent. Without it, subtitles and stickers
  // are silently skipped ("Subtitle component not loaded, skipping").
  // All working games in the warehouse call FeedbackManager.init().
  // Previously this was forbidden, but that caused broken subtitle/sticker display.

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

// ─── 5b2b. TransitionScreen hide() check (PART-025-HIDE) ────────────────────
// GEN-117: If transitionScreen.show() is called, transitionScreen.hide() MUST also
// be present. ScreenLayout sets #gameContent to display:none initially. The CDN
// TransitionScreenComponent does NOT auto-hide when its button fires — startGame()
// must call transitionScreen.hide() to reveal #gameContent. Without it, ALL
// isVisible() checks fail and 0 tests pass.
const hasTransitionShow = /transitionScreen\s*\.\s*show\s*\(/.test(html);
const hasTransitionHide = /transitionScreen\s*\.\s*hide\s*\(/.test(html);
if (hasTransitionShow && !hasTransitionHide) {
  errors.push(
    'ERROR [PART-025-HIDE]: TransitionScreenComponent: transitionScreen.show() found but no transitionScreen.hide() — ' +
      'startGame() must call transitionScreen.hide() to reveal #gameContent (GEN-117). ' +
      'The CDN TransitionScreenComponent does NOT auto-hide when its button fires. ' +
      'WRONG: function startGame() { gameState.phase = \'playing\'; nextRound(); } ' +
      "RIGHT: async function startGame() { await transitionScreen.hide(); gameState.phase = 'playing'; nextRound(); }"
  );
}

// ─── 5b2c. gameContent visibility check (PART-026-GAMECONTENT) ──────────────
// GEN-118: transitionScreen.hide() dismisses the overlay but does NOT auto-show
// #gameContent. startGame() must explicitly set display='block' on #gameContent.
// Build #556 (name-the-sides) failed because GEN-117 only required hide() but
// #gameContent remained hidden — all isVisible() checks returned false.
// Use WARNING (not error) — regex may have false positives with different DOM
// caching patterns (e.g. domRefs.gameContainer).
const hasGameContentVisible =
  /getElementById\s*\(\s*['"]gameContent['"]\s*\).*style.*display|getElementById\s*\(\s*['"]gameContent['"]\s*\).*classList.*remove|gameContent.*style\.display\s*=.*block|domRefs\.gameContainer.*style\.display/s.test(
    html
  );
if (hasTransitionShow && !hasGameContentVisible) {
  warnings.push(
    'WARNING [PART-026-GAMECONTENT]: transitionScreen.hide() does NOT auto-show #gameContent — ' +
      "startGame() must explicitly set style.display='block' on #gameContent after calling transitionScreen.hide(). " +
      'Build #556 (name-the-sides) failed because #gameContent remained hidden after hide(). ' +
      "RIGHT: async function startGame() { await transitionScreen.hide(); document.getElementById('gameContent').style.display = 'block'; gameState.phase = 'playing'; nextRound(); } (GEN-118)"
  );
}

// ─── 5b2d. Inline script JS syntax check (PART-027-JS-SYNTAX) ───────────────
// GEN-119: gemini-2.5-pro can generate fallbackContent with closing } squashed
// inline at the end of the rounds array line:
//   const fallbackContent = { rounds: [{...}]};
// This produces a SyntaxError that prevents DOMContentLoaded from firing →
// ScreenLayout never runs → #gameContent never created → smoke check fails.
// Build #558 (which-ratio) root cause.
const inlineScriptRegex = /<script(?:\s[^>]*)?>([^]*?)<\/script>/gi;
while ((scriptMatch = inlineScriptRegex.exec(html)) !== null) {
  const openTag = scriptMatch[0].split('>')[0];
  // Skip external script tags (those with src= attribute)
  if (/src\s*=/i.test(openTag)) continue;
  // Skip <script type="module"> — ES module syntax (import/export) is valid there
  // but fails new vm.Script() which only parses classic scripts. Required for
  // @dnd-kit/dom ESM CDN loader (PART-043).
  if (/type\s*=\s*["']module["']/i.test(openTag)) continue;
  const scriptContent = scriptMatch[1];
  if (!scriptContent || !scriptContent.trim()) continue;
  try {
    new vm.Script(scriptContent);
  } catch (e) {
    if (e instanceof SyntaxError) {
      errors.push(
        `ERROR [PART-027-JS-SYNTAX]: JavaScript syntax error in inline script: ${e.message} — ` +
          'likely cause: closing } or ] squashed inline (e.g. fallbackContent rounds array). ' +
          'Ensure all object/array literals have their closing braces on their own lines (GEN-119).'
      );
    }
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

// ─── 5c3. waitForPackages banned package name check ─────────────────────────
// waitForPackages() MUST check actual CDN window globals (ScreenLayout,
// ProgressBarComponent, FeedbackManager, TransitionScreenComponent).
// LLMs sometimes hallucinate names like "Components", "Helpers", "Utils",
// "Module", "Lib" that are never window globals — the while loop never exits
// → "Packages failed to load" → white screen → all tests fail.
// Confirmed root cause: disappearing-numbers #509 UI/UX audit (2026-03-23).
if (hasWaitForPackages || callsWaitForPackages) {
  const bannedPackageNames = ['Components', 'Helpers', 'Utils', 'Module', 'Lib'];
  for (const name of bannedPackageNames) {
    const bannedRegex = new RegExp(`typeof\\s+${name}\\s*(?:===|!==)\\s*['"]undefined['"]`);
    if (bannedRegex.test(html)) {
      errors.push(
        `ERROR [GEN-WAITFOR-BANNEDNAMES]: waitForPackages() checks banned package name "${name}" — this is never a CDN window global. Use typeof ScreenLayout, typeof ProgressBarComponent, typeof FeedbackManager, or typeof TransitionScreenComponent instead.`
      );
    }
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

// ─── 5d3. GEN-ROUND-INDEX: 0-based currentRound enforcement ─────────────────
// rounds[currentRound - 1] is always wrong: on first click (currentRound=0) it
// resolves to index -1, throwing TypeError → game crashes immediately.
// loadRound calling nextRound() double-increments: loadRound(1) sets currentRound=0
// then nextRound() increments to 1 → loads round 2 instead of round 1.
// (stats-identify-class build #569 root cause)
{
  // Check for rounds[currentRound - 1] pattern
  const hasRoundIndexMinus1 = /rounds\s*\[\s*(?:gameState\.)?currentRound\s*-\s*1\s*\]/.test(html);
  if (hasRoundIndexMinus1) {
    errors.push(
      'ERROR [GEN-ROUND-INDEX]: rounds[currentRound - 1] detected. currentRound is 0-based — use rounds[currentRound] directly. This crashes on the first round (index -1) with TypeError.'
    );
  }

  // Check for loadRound calling nextRound() (double-increment bug)
  // Use [^}] (not [\s\S]) so the window cannot cross a closing brace into a
  // subsequent function or addEventListener block — prevents false positives
  // when window.loadRound = function(n){...}; is followed by nextRound() elsewhere.
  const hasLoadRoundCallingNextRound =
    /function\s+loadRound[^}]{0,200}nextRound\s*\(/.test(html) ||
    /loadRound\s*=[^}]{0,200}nextRound\s*\(/.test(html);
  if (hasLoadRoundCallingNextRound) {
    errors.push(
      'ERROR [GEN-ROUND-INDEX]: loadRound() calls nextRound() — this double-increments currentRound. loadRound should set currentRound = n-1, then call renderRound() directly.'
    );
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

// ─── 5e0. PreviewScreenComponent checks (v2 — persistent wrapper) ───────────
{
  const hasPreviewComponent = /PreviewScreenComponent|new\s+PreviewScreenComponent/.test(html);
  if (hasPreviewComponent) {
    // Must have previewScreen: true in ScreenLayout.inject() slots
    if (/ScreenLayout\s*\.\s*inject\s*\(/.test(html) && !/previewScreen\s*:\s*true/.test(html)) {
      errors.push(
        'MISSING: ScreenLayout.inject() does not include previewScreen: true in slots. ' +
          'When using PreviewScreenComponent, add previewScreen: true to slots: ' +
          "ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true } })"
      );
    }

    // Preview-wrapper compatibility block — required until the components bundle
    // with the preview-body scroll-owner fix is deployed everywhere.
    if (!hasPreviewScrollOwnerCss(html)) {
      errors.push(
        '5e0-SCROLL-OWNER: PreviewScreenComponent is used but the HTML does not include the preview-wrapper scroll compatibility CSS. ' +
          'Add `#mathai-preview-slot{height:100dvh;overflow:hidden}` and ' +
          '`#mathai-preview-slot .mathai-preview-body{height:100dvh;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch}`. ' +
          'In preview-wrapper mode, `.mathai-preview-body` must own vertical scrolling; do NOT rely on root-page scroll.'
      );
    }

    // ScreenLayout v2 preview-wrapper mode DOES create #mathai-progress-slot
    // when slots.progressBar is truthy (see warehouse/packages/components/screen-layout/index.js
    // _injectSlots preview-wrapper branch). Enforce the opposite: if ProgressBarComponent is
    // instantiated but the inject slots map doesn't opt in, the slot won't exist.
    if (/new\s+ProgressBarComponent\s*\(/.test(html)) {
      // Preview-wrapper mode (slots API) is the primary/mandatory mode per PART-025.
      // sections API is deprecated and rejected outright below (line ~590).
      var injectMatch = html.match(/ScreenLayout\s*\.\s*inject\s*\([^)]*\)/s);
      var injectCall = injectMatch ? injectMatch[0] : '';
      var hasSlotsProgress = /slots\s*:\s*\{[^}]*progressBar\s*:\s*(true|'mathai-progress-slot')/s.test(injectCall);
      if (!hasSlotsProgress) {
        errors.push(
          'SLOTS-PROGRESS-MISSING: ProgressBarComponent is instantiated but ScreenLayout.inject() ' +
            "slots map does not include progressBar: true. Without it, #mathai-progress-slot is never " +
            "created. Fix: ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })."
        );
      }
    }

    // Block the two legacy/drifted slotId values that used to surface in generated games.
    if (/slotId\s*:\s*['"]previewProgressBar['"]/.test(html)) {
      errors.push(
        'PROGRESS-SLOT-WRONG: ProgressBarComponent slotId is "previewProgressBar" — that is the audio ' +
          'countdown strip inside the preview header, not the progress slot. Use slotId: "mathai-progress-slot".'
      );
    }
    if (/slotId\s*:\s*['"]progress-bar-container['"]/.test(html)) {
      errors.push(
        'PROGRESS-SLOT-WRONG: ProgressBarComponent slotId is "progress-bar-container" — a legacy local ' +
          'container ID. Use slotId: "mathai-progress-slot" (ScreenLayout creates it when slots.progressBar: true).'
      );
    }

    // PART-025: sections API is deprecated (backward compat only). New games MUST use slots API + previewScreen:true.
    if (/ScreenLayout\s*\.\s*inject\s*\([^)]*sections\s*:/.test(html)) {
      errors.push(
        'SECTIONS-DEPRECATED: ScreenLayout.inject() uses the deprecated "sections" API. ' +
          'New games MUST use the slots API with previewScreen:true (see PART-025). ' +
          "Fix: ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })"
      );
    }

    // v2: No mathai-header-slot or mathai-question-slot (those are fictional section IDs)
    if (/mathai-header-slot|mathai-question-slot/.test(html)) {
      errors.push(
        'INCOMPATIBLE: mathai-header-slot or mathai-question-slot referenced but do not exist. ' +
          'ScreenLayout v2 with previewScreen:true creates only #mathai-preview-slot, #gameContent, and #mathai-transition-slot. ' +
          'Timer / per-round content renders inline inside #gameContent; the preview owns the how-to-play instruction.'
      );
    }

    // PART-039 + plan-formats.md: preview owns the how-to-play copy. Gameplay (#gameContent) MUST NOT
    // render a static instruction / prompt banner that restates or paraphrases it. Flag common shapes:
    //   - class/id containing instruction | help-text | prompt-text | task-text | directions | how-to-play
    //   - banner sentences starting with imperative verbs the preview already said (Find / Tap / Select / Choose / Click / Drag)
    (function checkDupInstruction() {
      // Collect candidate strings that end up in #gameContent:
      //   (a) literal contents of <div id="gameContent">…</div> (greedy window, hard-capped).
      //   (b) every RHS of `.innerHTML = ...;` / `.innerHTML += ...;` where LHS is a gameContent ref.
      var regionParts = [];
      var gcMatch = html.match(/id=["']gameContent["'][^>]*>([\s\S]{0,20000})/);
      if (gcMatch) regionParts.push(gcMatch[1]);
      var innerHtmlRe = /(?:gameContent|\bgc\b|domRefs\s*\.\s*gameContent|domRefs\s*\.\s*\w+)\s*\.\s*innerHTML\s*(?:\+?=)\s*([\s\S]*?);/g;
      var m;
      while ((m = innerHtmlRe.exec(html)) !== null) regionParts.push(m[1]);
      var region = regionParts.join('\n');
      if (!region) return;

      // Class/id blocklist — names commonly used for instruction banners.
      var BANNER_NAMES =
        '(instruction|help-text|prompt-text|task-text|directions|how-to-play|' +
        'game-hint|hint-text|tap-hint|info-banner|game-label|round-intro|round-label|' +
        'lead-text|cta-text|preamble|how-to|intro-text|tutorial-text|game-directions|' +
        'subtitle|hint|callout|banner|tip|game-tip|round-hint|task-hint|helper-text)';
      var badIdOrClass =
        new RegExp('class=["\'][^"\']*' + BANNER_NAMES + '[^"\']*["\']', 'i').test(region) ||
        new RegExp('id=["\']' + BANNER_NAMES + '[^"\']*["\']', 'i').test(region);

      // Imperative verbs that duplicate the preview instruction.
      var VERBS =
        '(Find|Tap|Select|Choose|Click|Drag|Match|Pick|Place|Move|Type|Enter|Solve|' +
        'Identify|Calculate|Count|Arrange|Order|Group|Sort|Circle|Mark|Highlight|' +
        'Answer|Complete|Fill|Draw|Touch|Press|Swipe|Slide|Spot)';
      // Allow optional nested opening tags (<strong>, <em>, <span>…) between the outer tag
      // open and the verb, plus leading non-word chars (emoji, bullets, digits, punctuation).
      var bannerRe = new RegExp(
        '<(?:p|h[1-6]|div|span|strong|em|b|i|label)[^>]*>' +
          '(?:\\s*<[^>]+>\\s*)*' +
          '[^a-zA-Z<]{0,20}' +  // permit leading emoji, bullets, digits ("1.", "1)"), whitespace, punctuation
          VERBS +
          '\\s+(the|two|a|an|which|all|both|your|each|every|any|one|more|same|different)\\b' +
          '[^<]{0,200}<',
        'i'
      );
      var bannerVerb = bannerRe.test(region);

      // Runtime text injection: `.textContent = 'Find ...'` / `.innerText = 'Tap ...'`
      var runtimeInjection = new RegExp(
        "\\.(?:textContent|innerText)\\s*=\\s*['\"`][^'\"`]{0,6}" + VERBS + "\\s+(the|two|a|an|which|all|both|your)\\b",
        'i'
      ).test(html);

      if (badIdOrClass || bannerVerb || runtimeInjection) {
        errors.push(
          'DUP-INSTRUCTION: game code renders a how-to-play / prompt banner that duplicates the preview instruction. ' +
            'The preview (previewInstruction + previewAudioText) is the single source of instructions. ' +
            'Remove any element inside #gameContent with class/id containing ' + BANNER_NAMES + ', ' +
            'any imperative banner starting with ' + VERBS + ' (allowing nested <strong>/<em> and leading emoji/punctuation), ' +
            'and any `.textContent`/`.innerText` assignment of such a banner at runtime. ' +
            'A per-round prompt is allowed ONLY when it carries round-specific information ' +
            'not in the preview (e.g. the actual question like "What is 3 × 4?").'
        );
      }
    })();

    // Must call previewScreen.show()
    if (!/previewScreen\s*\.\s*show\s*\(/.test(html)) {
      warnings.push(
        'WARNING: PreviewScreenComponent instantiated but previewScreen.show() call not found. ' +
          'Preview screen must be shown before game starts.'
      );
    }

    // Must pass audioUrl parameter to show()
    if (/previewScreen\s*\.\s*show\s*\(/.test(html) && !/audioUrl/.test(html)) {
      warnings.push(
        'WARNING: previewScreen.show() missing audioUrl parameter. ' +
          'Pass audioUrl: content.previewAudio || fallbackContent.previewAudio || null'
      );
    }

    // instruction should read from content, not be hardcoded
    if (/previewScreen\s*\.\s*show\s*\(\s*\{[^}]*instruction\s*:\s*['"]/.test(html)) {
      warnings.push(
        'WARNING: previewScreen.show() has hardcoded instruction string. ' +
          'Use: instruction: content.previewInstruction || fallbackContent.previewInstruction'
      );
    }

    // Must have startGameAfterPreview function
    if (!/startGameAfterPreview/.test(html)) {
      warnings.push(
        'WARNING: startGameAfterPreview() function not found. ' +
          'gameState.startTime should be set AFTER preview ends, not during init.'
      );
    }

    // v2: previewScreen.hide() is REMOVED — wrapper is persistent
    if (/previewScreen\s*\.\s*hide\s*\(/.test(html)) {
      errors.push(
        'REMOVED API: previewScreen.hide() does not exist in PreviewScreenComponent v2. ' +
          'The preview screen is a persistent wrapper. Remove all hide() calls. ' +
          'Use previewScreen.destroy() only in the end-of-game Next-click handler (NOT in endGame()).'
      );
    }

    // v2: previewContent option removed
    if (/previewScreen\s*\.\s*show\s*\([\s\S]{0,400}previewContent\s*:/.test(html)) {
      errors.push(
        'REMOVED OPTION: previewScreen.show() no longer accepts previewContent. ' +
          'Use showGameOnPreview: true to render the game in its initial state under the preview overlay.'
      );
    }

    // v2: If TimerComponent is used, timerInstance + timerConfig should be passed to show()
    const hasTimer = /new\s+TimerComponent|window\.TimerComponent/.test(html);
    if (hasTimer && /previewScreen\s*\.\s*show\s*\(/.test(html)) {
      if (!/timerInstance\s*:/.test(html)) {
        warnings.push(
          'WARNING: TimerComponent detected but previewScreen.show() does not pass timerInstance. ' +
            'Pass timerInstance: <timer ref> so the persistent header can mirror timer state in game state.'
        );
      }
      if (!/timerConfig\s*:/.test(html)) {
        warnings.push(
          'WARNING: TimerComponent detected but previewScreen.show() does not pass timerConfig. ' +
            "Pass timerConfig: { type: 'decrease'|'increase', startTime, endTime }."
        );
      }
    }

    // v2: restartGame should NOT re-show preview (shown once per session)
    if (/restartGame[\s\S]{0,500}showPreviewScreen|restartGame[\s\S]{0,500}previewScreen\s*\.\s*show/.test(html)) {
      warnings.push(
        'WARNING: restartGame() appears to call showPreviewScreen() or previewScreen.show(). ' +
          'Preview should only be shown once per session. On restart, call the game-reset function directly ' +
          '(e.g. startGameAfterPreview or the first-round setup) without re-showing the preview.'
      );
    }

  }
}

// ─── 5e0-DOM-BOUNDARY. Game code must not reach into PreviewScreen / ActionBar private DOM ──
// PreviewScreenComponent (PART-039) and ActionBarComponent (PART-040) own the lifecycle of
// these IDs / classes. Game HTML calling getElementById/querySelector on them (or toggling
// .mathai-preview-* classes via classList) is a boundary violation.
//
// Gated on either PreviewScreenComponent OR ActionBarComponent being present in the HTML
// so self-contained games that happen to use an id like "previewInstruction" for their own
// local DOM are not false-flagged. `#mathai-preview-slot` is explicitly allowed — it is the
// slot container used as a legitimate fallback host in injectGameHTML patterns, not a
// private node.
//
// See PART-039 (preview-screen component boundary invariant), PART-040 (action-bar
// component boundary), and PART-026 Anti-Pattern 35.
{
  const hasPreviewComponent = /PreviewScreenComponent|new\s+PreviewScreenComponent/.test(html);
  const hasActionBarComponent = /ActionBarComponent|new\s+ActionBarComponent/.test(html);
  if (hasPreviewComponent || hasActionBarComponent) {
    const BANNED_IDS = [
      'previewInstruction',
      'previewProgressBar',
      'previewTimerText',
      'previewQuestionLabel',
      'previewScore',
      'previewStar',
      'previewSkipBtn',
      'previewBackBtn',
      'previewAvatarSpeaking',
      'previewAvatarSilent',
      'previewGameContainer',
      'popup-backdrop'
    ];

    const hits = [];

    BANNED_IDS.forEach(function (id) {
      // getElementById('<id>')
      const gebiRe = new RegExp("getElementById\\s*\\(\\s*['\"]" + id + "['\"]\\s*\\)");
      if (gebiRe.test(html)) hits.push("getElementById('" + id + "')");

      // querySelector('#<id>')  / querySelectorAll('#<id>')
      const qsRe = new RegExp("querySelector(?:All)?\\s*\\(\\s*['\"]#" + id + "['\"]\\s*\\)");
      if (qsRe.test(html)) hits.push("querySelector('#" + id + "')");
    });

    // .mathai-preview-<suffix> class selectors via querySelector(All).
    // Matches `.mathai-preview-X` anywhere inside the selector string, so compound
    // selectors like `#mathai-preview-slot .mathai-preview-header` or
    // `div.mathai-preview-body > p` also fire. The class token `.mathai-preview-`
    // (dot prefix) is the ban target — `#mathai-preview-slot` (ID form) remains
    // allowed because it uses `#`, not `.`.
    const clsQsRe = /querySelector(?:All)?\s*\(\s*['"][^'"]*\.mathai-preview-[a-zA-Z0-9_-]+[^'"]*['"]/g;
    let clsMatch;
    while ((clsMatch = clsQsRe.exec(html)) !== null) {
      hits.push(clsMatch[0]);
    }

    // classList.add/remove/toggle/contains('mathai-preview-*')
    const classListRe = /classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(\s*['"]mathai-preview-[a-zA-Z0-9_-]+['"]/g;
    let clMatch;
    while ((clMatch = classListRe.exec(html)) !== null) {
      hits.push(clMatch[0]);
    }

    // CSS bypass: game <style> block targets preview-private IDs.
    // Pattern seen in the wild (match-up-ratios 2026-04):
    //   __slot.classList.add('mur-preview-hidden')       // JS side is allowed
    //   #mathai-preview-slot.mur-preview-hidden #previewInstruction { display:none }  // CSS side is the violation
    // Scan every <style>...</style> block for `#<banned-id>` as a CSS selector token.
    // Note: `.mathai-preview-body` / `.mathai-preview-slot` in CSS are intentionally
    // NOT banned here — `5e0-SCROLL-OWNER` REQUIRES that exact compat selector.
    const styleBlocks = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
    for (const block of styleBlocks) {
      for (const id of BANNED_IDS) {
        // `#<id>` at a CSS-selector boundary. Word-boundary after prevents
        // matching `#previewInstructionFoo` or ids that share a prefix.
        const cssIdRe = new RegExp("#" + id + "\\b");
        if (cssIdRe.test(block)) {
          hits.push("CSS selector `#" + id + "`");
        }
      }
    }

    if (hits.length > 0) {
      const unique = Array.from(new Set(hits));
      const owningComponent = hasPreviewComponent ? 'PreviewScreenComponent' : 'ActionBarComponent';
      errors.push(
        'ERROR (5e0-DOM-BOUNDARY): game HTML reaches into ' + owningComponent + ' private DOM. ' +
          'Offending pattern(s): ' + unique.slice(0, 5).join(', ') +
          (unique.length > 5 ? ' (+' + (unique.length - 5) + ' more)' : '') + '. ' +
          'PreviewScreen (PART-039) + ActionBar (PART-040) own #previewInstruction, #previewProgressBar, ' +
          '#previewTimerText, #previewQuestionLabel, #previewScore, #previewStar, #previewSkipBtn, ' +
          '#previewBackBtn, #previewAvatarSpeaking, #previewAvatarSilent, #previewGameContainer, ' +
          '#popup-backdrop, and all .mathai-preview-* classes. Game code must operate only within ' +
          '#gameContent and its children; the CDN manages preview visibility via switchToGame()/destroy(). ' +
          'Fix: delete the reach-in; if you need to hide the preview, call previewScreen.destroy() ' +
          'in endGame() cleanup per PART-039. See PART-039, PART-040, and PART-026 Anti-Pattern 35.'
      );
    }
  }
}

// ─── 5e0-DRIFTED-OPTIONS. previewScreen.show() passes options that do not exist ──
// The preview-screen public API has exactly these options:
//   instruction, audioUrl, showGameOnPreview, onComplete, onPreviewInteraction
// Any other key on a `previewScreen.show({...})` call is a drifted name. In
// particular `timerInstance` and `timerConfig` were NEVER valid — the preview
// header does not render or observe any game timer. Games that need a timer
// render their own TimerComponent inside #gameContent.
//
// Implementation: scan for the top-level object literal argument to every
// `previewScreen.show(` call and check if any banned key appears in it.
{
  const hasPreviewComponent = /PreviewScreenComponent|new\s+PreviewScreenComponent/.test(html);
  if (hasPreviewComponent) {
    const BANNED_OPTIONS = ["timerInstance", "timerConfig"];
    const showCallRe = /previewScreen\s*\.\s*show\s*\(\s*\{([\s\S]*?)\}\s*\)/g;
    const hits = [];
    let m;
    while ((m = showCallRe.exec(html)) !== null) {
      const body = m[1];
      for (const key of BANNED_OPTIONS) {
        // Match the key as an object property name, not inside a string or comment.
        // Heuristic: `\bkey\s*:` at column start or after `{` / `,`.
        const keyRe = new RegExp("(^|[\\{,\\s])" + key + "\\s*:");
        if (keyRe.test(body)) hits.push(key);
      }
    }
    if (hits.length > 0) {
      const unique = Array.from(new Set(hits));
      errors.push(
        "ERROR (5e0-DRIFTED-OPTIONS): previewScreen.show(...) passes unsupported option(s): " +
          unique.join(", ") +
          ". These options do not exist on PreviewScreenComponent. Delete the key(s). " +
          "See PART-039 for the authoritative show() option list."
      );
    }
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
      'ProgressBarComponent API is: constructor(slotId, config) + .update(currentRound, livesRemaining) + .destroy(). ' +
      'There is NO .init(), .start(), .reset(), or .setLives() method. ' +
      'Calling progressBar.init() throws "progressBar.init is not a function" → blank page. ' +
      'Fix: remove the progressBar.init() call — the constructor already initializes the component. ' +
      'Use progressBar.update(0, gameState.lives) to set the initial display state after construction. ' +
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
// GEN-UX-003 extension: catch missing slotId key (new ProgressBarComponent({...}) without slotId: key)
const pbObjectForms = html.match(/new\s+ProgressBarComponent\s*\(\s*\{[^}]*\}/g) || [];
const pbMissingSlotId = pbObjectForms.filter(m => !m.includes('slotId'));
if (pbMissingSlotId.length > 0) {
  errors.push('FORBIDDEN: ProgressBarComponent options object missing slotId key — must include slotId: \'mathai-progress-slot\'. WRONG: new ProgressBarComponent({ totalRounds: N }). RIGHT: new ProgressBarComponent({ slotId: \'mathai-progress-slot\', totalRounds: N, totalLives: N }). (GEN-UX-003)');
}
// NOTE: the naive regex /\S[^)]*,\s*\S[^)]*,\s*\S[^)]*/ false-positives on
// progressBar.update(currentRound, Math.max(0, lives)) because the comma inside
// Math.max(0,...) is counted as a 3rd arg separator. Use a paren-depth-aware
// arg counter instead. (stats-mean-direct #575 false-positive, Lesson L-GF-005)
{
  const updateMatches = html.match(/progressBar\s*\.\s*update\s*\([^;]*?\)/g) || [];
  const threeArgCalls = updateMatches.filter(callStr => {
    const argsStr = callStr.slice(callStr.indexOf('(') + 1, callStr.lastIndexOf(')'));
    let depth = 0, topLevelCommas = 0;
    for (const ch of argsStr) {
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (ch === ',' && depth === 0) topLevelCommas++;
    }
    return topLevelCommas >= 2;
  });
  if (threeArgCalls.length > 0) {
    errors.push(
      'ERROR: progressBar.update() called with 3 args — correct signature is progressBar.update(currentRound, lives) (2 args only). ' +
        'WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds, gameState.lives). ' +
        'RIGHT: if (progressBar) progressBar.update(gameState.currentRound, gameState.lives). ' +
        'Also add a null guard: if (progressBar) before calling update(). (GEN-112, find-triangle-side build #547 root cause)'
    );
  }
}
// ─── LP-1: progressBar.update() 2nd arg must not be totalRounds ─────────────
// For no-lives games the LLM generates progressBar.update(gameState.currentRound, gameState.totalRounds)
// instead of progressBar.update(gameState.currentRound, 0).
// ProgressBarComponent computes lives display as (totalLives - livesRemaining) = (0 - 5) = -5
// → String.repeat(-5) → RangeError: Invalid count value: -5 on EVERY loadRound() call.
// This kills ALL level-progression tests before they can run.
// GEN-112 already mandates livesRemaining as 2nd arg — this T1 check enforces it.
if (/progressBar\s*\.\s*update\s*\([^)]*totalRounds[^)]*\)/.test(html)) {
  errors.push(
    'ERROR [GEN-112]: progressBar.update() 2nd arg must be livesRemaining (0 for no-lives games), not totalRounds — ' +
      'totalRounds as 2nd arg causes RangeError: Invalid count value: -N on every loadRound() call, killing all level-progression tests. ' +
      'WRONG: progressBar.update(gameState.currentRound, gameState.totalRounds). ' +
      'RIGHT: progressBar.update(gameState.currentRound, 0) for no-lives games; ' +
      'progressBar.update(gameState.currentRound, gameState.lives) for lives games. (LP-1 root cause)'
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
// waitForPackages() readiness expression, or the game crashes with ReferenceError at init.
//
// CANONICAL SHAPE (see alfred/skills/game-building/reference/mandatory-components.md):
//   var ok =
//     typeof FeedbackManager !== 'undefined' &&
//     typeof TimerComponent !== 'undefined' &&
//     ... ;  // every required class as a hard `&&` term, NO `||` operators
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
    'ERROR (5f3a): TimerComponent is used but typeof TimerComponent is not in waitForPackages() — TimerComponent loads at CDN step 7, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before TimerComponent is defined → ReferenceError → blank page. ' +
    'Add a hard `&&` term to the readiness expression in waitForPackages():\n' +
    '  Option A (bare global): `&& typeof TimerComponent !== "undefined"`\n' +
    '  Option B (window.components): `&& typeof window.components?.TimerComponent !== "undefined"`\n' +
    'NEVER use `||` in the readiness expression — see GEN-WAITFORPACKAGES-NO-OR.'
  );
}
if (
  /\bTransitionScreenComponent\b/.test(html) &&
  !/typeof\s+TransitionScreenComponent/.test(html) &&
  !/typeof\s+window\.components\??\.TransitionScreenComponent/.test(html) &&
  !/window\.components\??\.TransitionScreenComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3b): TransitionScreenComponent is used but typeof TransitionScreenComponent is not in waitForPackages() — it loads at CDN step 4, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before TransitionScreenComponent is defined → ReferenceError → blank page. ' +
    'Add a hard `&&` term to the readiness expression in waitForPackages():\n' +
    '  Option A (bare global): `&& typeof TransitionScreenComponent !== "undefined"`\n' +
    '  Option B (window.components): `&& typeof window.components?.TransitionScreenComponent !== "undefined"`\n' +
    'NEVER use `||` in the readiness expression — see GEN-WAITFORPACKAGES-NO-OR.'
  );
}
if (
  /\bProgressBarComponent\b/.test(html) &&
  !/typeof\s+ProgressBarComponent/.test(html) &&
  !/typeof\s+window\.components\??\.ProgressBarComponent/.test(html) &&
  !/window\.components\??\.ProgressBarComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3c): ProgressBarComponent is used but typeof ProgressBarComponent is not in waitForPackages() — it loads at CDN step 3, AFTER ScreenLayout (step 2). Without a typeof guard, init runs before ProgressBarComponent is defined → ReferenceError → blank page. ' +
    'Add a hard `&&` term to the readiness expression in waitForPackages():\n' +
    '  Option A (bare global): `&& typeof ProgressBarComponent !== "undefined"`\n' +
    '  Option B (window.components): `&& typeof window.components?.ProgressBarComponent !== "undefined"`\n' +
    'NEVER use `||` in the readiness expression — see GEN-WAITFORPACKAGES-NO-OR.'
  );
}
if (
  /new\s+SignalCollector\s*\(/.test(html) &&
  !/typeof\s+SignalCollector/.test(html) &&
  !/typeof\s+window\.components\??\.SignalCollector/.test(html) &&
  !/window\.components\??\.SignalCollector\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3d): SignalCollector is used but typeof SignalCollector is not in waitForPackages() — ' +
    'SignalCollector loads via the Helpers CDN bundle. Without a typeof guard, new SignalCollector() runs before the CDN package loads → ReferenceError → blank page. ' +
    'Add a hard `&&` term to the readiness expression in waitForPackages():\n' +
    '  Option A (bare global): `&& typeof SignalCollector !== "undefined"`\n' +
    '  Option B (window.components): `&& typeof window.components?.SignalCollector !== "undefined"`\n' +
    'NEVER use `||` in the readiness expression — see GEN-WAITFORPACKAGES-NO-OR.'
  );
}

// ─── 5f3e. PreviewScreenComponent / FloatingButtonComponent / AnswerComponentComponent ───
// Same as 5f3a-d, but for the components that were previously uncovered. These are the
// late-loading components that PART-039, PART-050, PART-051 declare mandatory but
// PART-003's stale baseline list does not name. The age-matters fail-open bug shipped
// because PreviewScreenComponent was not enforced by 5f3.
if (
  /\bPreviewScreenComponent\b/.test(html) &&
  !/typeof\s+PreviewScreenComponent/.test(html) &&
  !/typeof\s+window\.components\??\.PreviewScreenComponent/.test(html) &&
  !/window\.components\??\.PreviewScreenComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3e): PreviewScreenComponent is used but typeof PreviewScreenComponent is not in waitForPackages() — without a hard typeof guard, ' +
    'init runs before PreviewScreenComponent is registered on window → silent ReferenceError → previewScreen stays null → preview never mounts. ' +
    'Add a hard `&&` term: `&& typeof PreviewScreenComponent !== "undefined"`. NEVER `||`. ' +
    'See alfred/skills/game-building/reference/mandatory-components.md.'
  );
}
if (
  /\bFloatingButtonComponent\b/.test(html) &&
  !/typeof\s+FloatingButtonComponent/.test(html) &&
  !/typeof\s+window\.components\??\.FloatingButtonComponent/.test(html) &&
  !/window\.components\??\.FloatingButtonComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3f): FloatingButtonComponent is used but typeof FloatingButtonComponent is not in waitForPackages() — same fail-open shape as 5f3e. ' +
    'Add a hard `&&` term: `&& typeof FloatingButtonComponent !== "undefined"`. NEVER `||`. ' +
    'See alfred/skills/game-building/reference/mandatory-components.md.'
  );
}
if (
  /\bAnswerComponentComponent\b/.test(html) &&
  !/typeof\s+AnswerComponentComponent/.test(html) &&
  !/typeof\s+window\.components\??\.AnswerComponentComponent/.test(html) &&
  !/window\.components\??\.AnswerComponentComponent\s*===\s*['"]undefined['"]/.test(html)
) {
  errors.push(
    'ERROR (5f3g): AnswerComponentComponent is used but typeof AnswerComponentComponent is not in waitForPackages() — same fail-open shape as 5f3e. ' +
    'Add a hard `&&` term: `&& typeof AnswerComponentComponent !== "undefined"`. NEVER `||`. ' +
    'See alfred/skills/game-building/reference/mandatory-components.md.'
  );
}

// ─── 5f3h. GEN-WAITFORPACKAGES-NO-OR — strict: no `||` in the readiness expression. ───
// The readiness expression is the boolean inside the waitForPackages function body that
// determines when the gate resolves. The age-matters fail-open shape was:
//   var ok =
//     typeof FeedbackManager !== 'undefined' &&
//     (typeof PreviewScreenComponent !== 'undefined' || typeof ScreenLayout !== 'undefined');
// `ScreenLayout` and `PreviewScreenComponent` are registered on window at different points
// in the same bundle's IIFE, so the `||` short-circuit lets the gate resolve while the
// component is still undefined. This rule rejects any `||` operator inside the body of
// `function waitForPackages()`. The canonical shape uses only `&&`.
//
// Detection strategy: locate the `waitForPackages` function body, then scan only that body
// for `||`. Avoids false positives on `||` elsewhere in the file.
(function checkWaitForPackagesNoOr() {
  // Match: `function waitForPackages` ... opening `{` ... balanced body until matching `}`.
  // We use a non-balanced regex but capture a generous slice — false positives only
  // appear if something else legitimately uses `||` inside, which this rule wants to flag.
  const fnStart = html.search(/function\s+waitForPackages\s*\(/);
  if (fnStart < 0) return; // No function — other rules handle that.
  const slice = html.slice(fnStart);
  // Find the function body by tracking braces from the first `{` after the signature.
  const openIdx = slice.indexOf('{');
  if (openIdx < 0) return;
  let depth = 0;
  let endIdx = -1;
  for (let i = openIdx; i < slice.length; i++) {
    const ch = slice[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx < 0) return;
  const body = slice.slice(openIdx, endIdx + 1);
  // Strip line comments (//...) and block comments (/* ... */) so a comment containing
  // `||` doesn't trigger a false positive.
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  if (/\|\|/.test(stripped)) {
    errors.push(
      'ERROR (GEN-WAITFORPACKAGES-NO-OR): waitForPackages() body contains `||` — the readiness expression must use only `&&`. ' +
      '`||` creates fail-open gates: e.g. `(typeof PreviewScreenComponent !== "undefined" || typeof ScreenLayout !== "undefined")` resolves as soon as ScreenLayout loads, before PreviewScreenComponent is defined → silent ReferenceError on `new PreviewScreenComponent(...)` → previewScreen stays null. ' +
      'Replace every `||` in the readiness expression with `&&`. ' +
      'See alfred/skills/game-building/reference/mandatory-components.md.'
    );
  }
})();

// ─── 5f3i. GEN-WAITFORPACKAGES-MISSING — every `new XComponent` ⇒ typeof X
// term INSIDE waitForPackages body. ──────────────────────────────────────────
// For each component class the file actually constructs (`new XComponent(...)`),
// the waitForPackages function body must contain a hard typeof guard for that
// class. The check is scoped to the waitForPackages body (not the whole file),
// because a `typeof X` guard at instantiation time (e.g.
// `if (typeof X !== 'undefined') new X(...)`) is NOT the same as gating init —
// it silently skips the component when the class hasn't loaded yet, producing
// the same null-reference bug as the age-matters fail-open. The cross-logic
// game ships with this exact silent-skip pattern; this rule catches it.
//
// 5f3a-g cover the common components with file-wide regex (legacy). 5f3i
// adds the body-scoped check that catches the silent-skip variant.
(function checkWaitForPackagesMissing() {
  // Locate waitForPackages body.
  const fnStart = html.search(/function\s+waitForPackages\s*\(/);
  if (fnStart < 0) return; // No function — other rules handle that.
  const slice = html.slice(fnStart);
  const openIdx = slice.indexOf('{');
  if (openIdx < 0) return;
  let depth = 0;
  let endIdx = -1;
  for (let i = openIdx; i < slice.length; i++) {
    const ch = slice[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { endIdx = i; break; }
    }
  }
  if (endIdx < 0) return;
  const body = slice.slice(openIdx, endIdx + 1);

  // Collect every constructed component name in the whole file.
  const ctorRegex = /new\s+([A-Z][A-Za-z0-9]*Component[A-Za-z0-9]*)\s*\(/g;
  const constructed = new Set();
  let m;
  while ((m = ctorRegex.exec(html)) !== null) {
    constructed.add(m[1]);
  }
  for (const name of constructed) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('typeof\\s+' + escaped + '\\b');
    const reWindow = new RegExp('typeof\\s+window\\.components\\??\\.' + escaped + '\\b');
    if (!re.test(body) && !reWindow.test(body)) {
      errors.push(
        `ERROR (GEN-WAITFORPACKAGES-MISSING): \`new ${name}(...)\` is constructed but \`typeof ${name}\` is missing from the waitForPackages body — the readiness expression must include a hard \`&&\` term for every component the file constructs. ` +
        `A \`typeof ${name}\` guard at instantiation time (silent-skip pattern) is NOT a substitute — it produces the same null-reference bug on cold loads. ` +
        `Add \`&& typeof ${name} !== "undefined"\` to the readiness expression in waitForPackages(). ` +
        'See alfred/skills/game-building/reference/mandatory-components.md.'
      );
    }
  }
})();

// ─── 5f3j. GEN-SLOT-INSTANTIATION-MATCH — every ScreenLayout slot ⇒ matching new XComponent. ───
// Slot↔class map (from mandatory-components.md):
//   previewScreen     → PreviewScreenComponent
//   transitionScreen  → TransitionScreenComponent
//   progressBar       → ProgressBarComponent
//   floatingButton    → FloatingButtonComponent
//   answerComponent   → AnswerComponentComponent
//
// If the file declares `slots: { X: true }` in ScreenLayout.inject(...), it must also
// call `new XComponent(...)`. A slot declared but never instantiated is a wasted DOM node
// and a sign the gate is incomplete. Reuses the existing GEN-ANSWER-COMPONENT-INSTANTIATE
// pattern (lib/validate-static.js:4451-4465) and generalizes.
(function checkSlotInstantiationMatch() {
  const slotMap = {
    previewScreen: 'PreviewScreenComponent',
    transitionScreen: 'TransitionScreenComponent',
    progressBar: 'ProgressBarComponent',
    floatingButton: 'FloatingButtonComponent',
    answerComponent: 'AnswerComponentComponent'
  };
  // Locate ScreenLayout.inject(...) call body so we only inspect slot declarations there.
  const injectMatch = html.match(/ScreenLayout\.inject\s*\([^)]*\{[\s\S]*?\}\s*\)/);
  if (!injectMatch) return;
  const injectBody = injectMatch[0];
  // Look for slots: { ... } object inside.
  const slotsMatch = injectBody.match(/slots\s*:\s*\{([^}]*)\}/);
  if (!slotsMatch) return;
  const slotsBody = slotsMatch[1];
  for (const [slotKey, className] of Object.entries(slotMap)) {
    const slotEnabledRe = new RegExp('\\b' + slotKey + '\\s*:\\s*true\\b');
    if (!slotEnabledRe.test(slotsBody)) continue;
    const ctorRe = new RegExp('new\\s+' + className + '\\s*\\(');
    if (!ctorRe.test(html)) {
      errors.push(
        `ERROR (GEN-SLOT-INSTANTIATION-MATCH): ScreenLayout.inject() declares \`slots: { ${slotKey}: true }\` but the file never constructs \`new ${className}(...)\`. ` +
        `Either instantiate the component (and add a \`typeof ${className}\` guard to waitForPackages) or remove the slot declaration. ` +
        'See alfred/skills/game-building/reference/mandatory-components.md § Slot ↔ class instantiation contract.'
      );
    }
  }
})();

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
// Correct methods: recordViewEvent(), recordCustomEvent(), reset(), seal(), pause(), resume(),
//   startFlushing(), stopFlushing(), getInputEvents(), getMetadata(), getCurrentView(), debug().
// Root cause of right-triangle-area builds #527, #530, #532 failures.
if (/signalCollector\.trackEvent\s*\(/.test(html)) {
  errors.push(
    'ERROR: signalCollector.trackEvent() does not exist in CDN API. ' +
      'Use signalCollector.recordViewEvent(eventType, data) or signalCollector.recordCustomEvent(eventType, data) instead. ' +
      'Full SignalCollector API: recordViewEvent(eventType, data), recordCustomEvent(eventType, data), ' +
      'reset(), seal(), pause(), resume(), startFlushing(), stopFlushing(). ' +
      'Calling .trackEvent() throws "signalCollector.trackEvent is not a function" at runtime → init crash → blank page.',
  );
}

// GEN-UX-005: SignalCollector must not be called with no args
forbidPattern(/new\s+SignalCollector\s*\(\s*\)/, 'SignalCollector instantiated with no constructor args — must pass { sessionId, studentId, gameId, contentSetId } (GEN-UX-005). flushUrl and playId are set later from signalConfig in game_init postMessage.');

// ─── 5h3. SignalCollector inline stub detection ─────────────────────────────
// Inline stubs (window.SignalCollector = class {...}) shadow the real CDN package,
// causing silent data loss — events never flush to GCS because the stub has no
// flush implementation. The CDN package auto-loads via the Helpers bundle.
if (/window\.SignalCollector\s*=\s*(?:class|function)/.test(html)) {
  errors.push(
    'FORBIDDEN: Inline SignalCollector stub detected (window.SignalCollector = class/function) — ' +
      'this shadows the real CDN package and causes silent data loss. ' +
      'Remove the inline definition and let the CDN Helpers bundle load SignalCollector. ' +
      'Use waitForPackages() with typeof SignalCollector guard to wait for it.'
  );
}
if (/(?:^|\n)\s*class\s+SignalCollector\s*\{/.test(html) && !/signal-collector\/index\.js/.test(html)) {
  errors.push(
    'FORBIDDEN: Inline class SignalCollector definition detected — ' +
      'this shadows the real CDN package. Remove the inline class and use the CDN-loaded SignalCollector.'
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

// GEN-PM-001 (T1): postMessage must use exactly type: 'game_complete'
// 46 confirmed test failures from missing or wrong type field — top failure pattern in DB
if (/postMessage/.test(html) && !/['"]game_complete['"]/.test(html)) {
  errors.push(
    "GEN-PM-001: postMessage found but type: 'game_complete' string is missing — " +
    "endGame() MUST send window.parent.postMessage({ type: 'game_complete', ... }, '*') on BOTH victory AND game-over paths. " +
    "WRONG: type: 'completed', type: 'complete', type: 'game-complete'. RIGHT: type: 'game_complete' (exact string). " +
    '(46 confirmed contract test failures — top failure pattern)'
  );
}

// GEN-PM-DUAL-PATH (T1): game_complete postMessage must not be guarded by a victory-only if-check
// messaging category is 56% pass rate — primary root cause is postMessage inside if (reason === 'victory')
// Detect: if(...'victory'...) { ... postMessage( appearing inside the block before the closing brace
if (/postMessage/.test(html) && /['"]game_complete['"]/.test(html)) {
  const postMsgInVictoryGuard = /if\s*\([^{]*['"]victory['"]\s*[^{]*\)\s*\{[^}]*postMessage\s*\(/s.test(html);
  if (postMsgInVictoryGuard) {
    errors.push(
      "GEN-PM-DUAL-PATH: game_complete postMessage is inside an if-victory guard — " +
      "the postMessage MUST fire unconditionally in endGame() for BOTH 'victory' AND 'game_over' paths. " +
      "WRONG: if (reason === 'victory') { window.parent.postMessage(...) } — game_over path never fires postMessage. " +
      "RIGHT: call window.parent.postMessage(...) unconditionally at the bottom of endGame(), after syncDOMState(). " +
      "(messaging category 56% pass rate — top root cause)"
    );
  }
}

// GEN-PM-READY (T1): game_ready postMessage MUST be sent after initialization
// The parent harness waits for { type: 'game_ready' } before sending game_init with content.
// Without this, the harness never sends content and the game falls back to hardcoded test data.
{
  const hasGameReady = /postMessage\s*\(\s*\{[^}]*['"]game_ready['"][^}]*\}/.test(html);
  if (!hasGameReady) {
    errors.push(
      "GEN-PM-READY: window.parent.postMessage({ type: 'game_ready' }, '*') not found — " +
      "every game MUST send game_ready after initialization so the parent harness knows to send game_init with content. " +
      "Place it inside DOMContentLoaded, AFTER window.addEventListener('message', handlePostMessage). " +
      "(PART-008 mandatory requirement)"
    );
  }
}

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
// syncDOMState() reads window.gameState.phase and sets data-phase on #app.
// If a phase assignment happens without a nearby syncDOMState() call, data-phase
// is never updated → ALL waitForPhase() calls timeout.
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

// ─── 5h2. GEN-TRANSITION-API: transitionScreen.show() string-mode API check ──
// GEN-TRANSITION-API: transitionScreen.show() MUST always use the object API.
// NEVER pass a string as the first argument (e.g. transitionScreen.show('victory', {...})).
// The CDN TransitionScreenComponent has no string-mode API — passing a string causes
// all fields (title, buttons, icons) to be undefined → blank white screen, no buttons,
// user cannot play again. (which-ratio #561 browser audit, BROWSER-P0-001)
if (hasTransitionShow) {
  // Detect: transitionScreen.show( followed by a quote char (string first arg)
  if (/transitionScreen\s*\.\s*show\s*\(\s*['"`]/.test(html)) {
    errors.push(
      "ERROR [GEN-TRANSITION-API]: transitionScreen.show() called with string as first argument — " +
        "the CDN TransitionScreenComponent has no string-mode API. " +
        "WRONG: transitionScreen.show('victory', { score: 10 }); " +
        "RIGHT: transitionScreen.show({ icons: ['🎉'], title: 'Well Done!', subtitle: '...', " +
        "buttons: [{ text: 'Play Again', type: 'primary', action: restartGame }] }); " +
        "Passing a string causes all config fields (title, buttons, icons) to be undefined → " +
        "blank white screen with no buttons — user cannot play again. " +
        "(which-ratio #561 P0, GEN-TRANSITION-API)"
    );
  }
}

// ─── 5h3. GEN-TRANSITION-ICONS: SVG markup in icons[] array check ────────────
// GEN-TRANSITION-ICONS: the icons array in transitionScreen.show() MUST contain
// plain emoji strings. NEVER pass SVG markup, HTML strings, or file paths.
// The CDN TransitionScreenComponent inserts icons via textContent — SVG strings
// appear as raw escaped code text covering the screen. (which-ratio #561, BROWSER-P0-002)
if (hasTransitionShow) {
  // Detect icons array containing SVG opening tag
  if (/icons\s*:\s*\[[\s\S]*?<svg/i.test(html)) {
    errors.push(
      "ERROR [GEN-TRANSITION-ICONS]: icons array in transitionScreen.show() contains SVG markup — " +
        "CDN TransitionScreenComponent inserts icons via textContent which HTML-escapes all markup. " +
        "SVG strings appear as raw escaped code text covering the screen. " +
        "WRONG: icons: ['<svg xmlns=\"http://www.w3.org/2000/svg\"><path d=\"...\"/></svg>'] " +
        "RIGHT: icons: ['🎉'] or icons: ['⭐'] — use plain emoji strings only. " +
        "(which-ratio #561 P0, GEN-TRANSITION-ICONS)"
    );
  }
}

// ─── 5h4. GEN-PROGRESSBAR-LIVES: totalLives must be ≥1 ───────────────────────
// GEN-PROGRESSBAR-LIVES: totalLives in ProgressBarComponent constructor MUST be
// a positive integer (≥1). NEVER pass 0, null, undefined, or a negative value.
// The CDN ProgressBar computes (totalLives - currentLives) for lives indicator.
// If totalLives=0 and currentLives>0, result is negative → RangeError crashes
// progressBar.update() on every round. For no-lives games, pass totalLives equal
// to totalRounds and pass livesRemaining=0 to progressBar.update(). (which-ratio #561, BROWSER-NEW-001)
if (/\bProgressBarComponent\b/.test(html)) {
  if (/totalLives\s*:\s*(?:0+\b|-\d)/.test(html)) {
    errors.push(
      "ERROR [GEN-PROGRESSBAR-LIVES]: totalLives: 0 (or negative) in ProgressBarComponent constructor — " +
        "CDN ProgressBar computes (totalLives - currentLives) for the lives indicator. " +
        "totalLives=0 or negative causes RangeError when progressBar.update() is called with any livesRemaining > 0. " +
        "WRONG: new ProgressBarComponent({ totalLives: 0, totalRounds: 5, slotId: 'mathai-progress-slot' }); " +
        "WRONG: new ProgressBarComponent({ totalLives: -1, totalRounds: 5, slotId: 'mathai-progress-slot' }); " +
        "RIGHT for no-lives games: new ProgressBarComponent({ totalLives: gameState.totalRounds, " +
        "totalRounds: gameState.totalRounds, slotId: 'mathai-progress-slot' }) and call " +
        "progressBar.update(currentRound, 0) to show no hearts. " +
        "(which-ratio #561 P0, GEN-PROGRESSBAR-LIVES, CR-024)"
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

// ─── GEN-ISACTIVE-GUARD (WARNING) ────────────────────────────────────────────
// endGame() guard must use gameEnded flag, NOT isActive.
// isActive is set to false in handleSubmit() before timeout callbacks fire
// (to prevent re-clicks). On the last round, nextRound() → endGame() is called
// from that timeout. The !isActive guard trips → endGame() bails silently →
// results screen NEVER shows. Confirmed P0: visual-memory #528.
{
  const endGameMatch = html.match(/function\s+endGame\s*\([^)]*\)\s*\{([\s\S]{0,800})/);
  if (endGameMatch) {
    const endGameBody = endGameMatch[1];
    if (/[Ii]f\s*\([^)]*!gameState\.isActive/.test(endGameBody)) {
      warnings.push(
        'WARNING [GEN-ISACTIVE-GUARD]: endGame() uses !gameState.isActive as a guard condition — ' +
          'this causes results screen to never show on a perfect playthrough. ' +
          'isActive is set to false in handleSubmit() before timeout callbacks fire; ' +
          'when nextRound() → endGame() fires from that timeout the guard trips and endGame() bails silently. ' +
          'WRONG: if (!gameState.isActive && gameState.lives > 0) return; ' +
          'RIGHT: if (gameState.gameEnded) return; gameState.gameEnded = true; ' +
          '(visual-memory #528 P0 — all-correct path permanently frozen)',
      );
    }
  }
}

// ─── 7b. Mobile viewport scrollability check ────────────────────────────────
// body/html overflow hidden blocks mobile scroll unless preview-wrapper mode
// has an explicit preview-body scroll owner.
const usesPreviewWrapper = /previewScreen\s*:\s*true|PreviewScreenComponent/.test(html);
if (hasRootOverflowHiddenCss(html) && !(usesPreviewWrapper && hasPreviewScrollOwnerCss(html))) {
  warnings.push(
    'MOBILE-SCROLL: html/body has overflow hidden (including overflow-y:hidden) — game content may be unreachable on mobile (480×800). Use root vertical scrolling or an explicit overflow-y:auto content container instead',
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

// ─── 5e0. Standalone-fallback gate (FALLBACK-GATE-WEAK) ─────────────────────
// Every game has a standalone setTimeout fallback inside DOMContentLoaded that
// recovers from waitForPackages() timeout / CDN failure by calling startGame().
// The fallback MUST gate on `previewScreen && previewScreen.isActive()` — not
// just `gameState.phase === 'start_screen'`. Preview does NOT mutate game
// state, so the phase gate alone stays true for the entire preview duration,
// letting the fallback fire Round 1 audio on top of preview audio at t=2s.
// Symptom: welcome transition silently skipped because startGameAfterPreview
// early-returns on gameState.isActive === true.
// See html-template.md rule 11 and alfred/parts/PART-039.md.
(function checkFallbackGate() {
  // Find every setTimeout(...) whose body contains startGame(, showRoundIntro(,
  // or injectGameHTML(. Brace-depth tracking to extract full body.
  const needleRe = /setTimeout\s*\(\s*function\s*\([^)]*\)\s*\{/g;
  let m;
  while ((m = needleRe.exec(html)) !== null) {
    const bodyStart = m.index + m[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < html.length && depth > 0) {
      if (html[i] === '{') depth++;
      else if (html[i] === '}') depth--;
      i++;
    }
    const body = html.slice(bodyStart, i - 1);
    const bodyCallsStart = /\b(?:startGame|showRoundIntro|injectGameHTML)\s*\(/.test(body);
    if (!bodyCallsStart) continue;
    const hasPreviewGate = /previewScreen\.isActive\s*\(\s*\)/.test(body)
      || /!\s*previewScreen\b/.test(body);
    if (!hasPreviewGate) {
      errors.push(
        'ERROR (5e0-FALLBACK-GATE-WEAK): Standalone setTimeout fallback calls startGame()/showRoundIntro()/injectGameHTML() ' +
        'but does not gate on `previewScreen && previewScreen.isActive()`. Preview does NOT mutate gameState.phase, so ' +
        '`phase === "start_screen"` alone is not a sufficient gate — the fallback will fire at t=2s (or t=3s) while ' +
        'a live preview is still playing its audio, cross-firing Round 1 audio and silently skipping the welcome transition. ' +
        'Add `if (previewScreen && previewScreen.isActive && previewScreen.isActive()) return;` as the first statement. ' +
        'See html-template.md rule 11 and PART-039 verification checklist.'
      );
      break; // one report per file is enough
    }
  }
})();

// ─── 5e0-FEEDBACK-RACE-FORBIDDEN. Promise.race on FeedbackManager calls ──────
// FeedbackManager already bounds every call internally (sound.play → audio-duration
// + 1.5s guard; playDynamicFeedback → 60s streaming / 3s TTS API timeout). Any
// template-level `Promise.race([FeedbackManager..., setTimeout(...)])` or an
// `audioRace` helper truncates normal TTS (1-3s) and advances phase/round
// transitions before audio ends. Canonical pattern is plain `await` inside
// try/catch (PART-017, PART-026 Anti-Pattern 32, feedback SKILL Rule 8).
(function checkFeedbackRaceForbidden() {
  const racesReferencingFeedback =
    /FeedbackManager\b|\.sound\.play\s*\(|playDynamicFeedback\s*\(/;
  const helperNameRe =
    /function\s+(?:audioRace|audio_race|feedbackRace|avRace|raceAudio)\b|\b(?:audioRace|audio_race|feedbackRace|avRace|raceAudio)\s*=\s*function/;
  const raceRe = /Promise\.race\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  let flagged = false;
  let m;
  while ((m = raceRe.exec(html)) !== null) {
    const body = m[1];
    const surrounding = html.slice(Math.max(0, m.index - 200), m.index);
    const inFeedbackRace =
      racesReferencingFeedback.test(body) || helperNameRe.test(surrounding);
    if (!inFeedbackRace) continue;
    errors.push(
      'ERROR (5e0-FEEDBACK-RACE-FORBIDDEN): Promise.race wraps a FeedbackManager audio call. ' +
        'FeedbackManager already bounds resolution internally (PART-017): sound.play → audio-duration + 1.5s, ' +
        'playDynamicFeedback → 60s streaming / 3s API timeout. Template-level races truncate normal audio (1-3s TTS) ' +
        'and advance phase/round transitions before feedback finishes. Use plain `await` inside try/catch. ' +
        'See PART-017 "No Promise.race on FeedbackManager Calls" and PART-026 Anti-Pattern 32.'
    );
    flagged = true;
    break;
  }
  // Also flag a helper definition even if no call site yet references it.
  if (!flagged && helperNameRe.test(html) && /Promise\.race\s*\(/.test(html)) {
    errors.push(
      'ERROR (5e0-FEEDBACK-RACE-FORBIDDEN): A helper named audioRace/feedbackRace/avRace is defined ' +
        'and Promise.race is used elsewhere in the file. Remove the helper — FeedbackManager calls ' +
        'must be awaited directly inside try/catch. See PART-017 and PART-026 Anti-Pattern 32.'
    );
  }
})();

// ─── 5e0-CLEANUP-BETWEEN-ROUNDS. Leftover audio/subtitle/sticker carryover ─────
// No leftover audio, subtitle, or sticker from the PREVIOUS round/phase may be
// audible or visible when the NEXT round or the end screen renders. FeedbackManager
// does NOT auto-clear prior feedback on silent round transitions, end-screen entry,
// restart, or level transitions — the overlay auto-clear only fires when a NEW
// playDynamicFeedback() call starts. Every nextRound() / endGame() / restartGame()
// body MUST call FeedbackManager.sound.stopAll?.() (or .pause()) inside a
// try/catch before mutating gameState for the new phase.
// Gates: only applies to games that actually use FeedbackManager (skip legacy /
// single-screen games). Exempt: games whose only FeedbackManager usage is
// playDynamicFeedback inside the round-transition function itself (the new call
// triggers auto-clear of the previous overlay). See GEN-CLEANUP-BETWEEN-ROUNDS
// in CDN_CONSTRAINTS_BLOCK.
(function checkCleanupBetweenRounds() {
  // Only applies to games that load FeedbackManager
  if (!/FeedbackManager\b/.test(html)) return;
  // Only applies to multi-round games (single-screen games have no between-round transition)
  const isMultiRound =
    /function\s+nextRound\s*\(/.test(html) ||
    /function\s+scheduleNextRound\s*\(/.test(html) ||
    /gameState\.currentRound\s*\+\+/.test(html);
  if (!isMultiRound) return;

  // Extract a function body by name (balanced-brace scan). Returns null if not found.
  function extractFunctionBody(src, fnName) {
    const sigRe = new RegExp(
      '(?:async\\s+)?function\\s+' + fnName + '\\s*\\([^)]*\\)\\s*\\{',
      'g'
    );
    const m = sigRe.exec(src);
    if (!m) return null;
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    if (depth !== 0) return null;
    return src.slice(m.index + m[0].length, i - 1);
  }

  // A body is "clean" if it either:
  //   (a) calls sound.stopAll / sound.pause / stream.stopAll / stream.pauseAll, OR
  //   (b) calls playDynamicFeedback() — the new overlay auto-clears the previous one, OR
  //   (c) explicitly clears a feedback DOM element (textContent='' or classList.remove)
  // Optional chaining + try/catch is preferred but not required at the regex level.
  function hasCleanup(body) {
    if (!body) return true; // function absent → nothing to check here
    if (
      /FeedbackManager\.sound\.(?:stopAll|pause|stop)\s*\??\.?\s*\(/.test(body)
    )
      return true;
    if (
      /FeedbackManager\.stream\.(?:stopAll|pauseAll|stop)\s*\??\.?\s*\(/.test(
        body
      )
    )
      return true;
    if (/FeedbackManager\.playDynamicFeedback\s*\(/.test(body)) return true;
    // Custom subtitle/sticker clear
    if (
      /\.(?:textContent|innerText|innerHTML)\s*=\s*['"`]\s*['"`]/.test(body) &&
      /feedback|subtitle|sticker|caption/i.test(body)
    )
      return true;
    return false;
  }

  const violations = [];

  // Check 1: nextRound() / scheduleNextRound() body
  const nextRoundBody =
    extractFunctionBody(html, 'nextRound') ||
    extractFunctionBody(html, 'scheduleNextRound');
  if (nextRoundBody !== null && !hasCleanup(nextRoundBody)) {
    violations.push('nextRound()');
  }

  // Check 2: endGame() body
  const endGameBody = extractFunctionBody(html, 'endGame');
  if (endGameBody !== null && !hasCleanup(endGameBody)) {
    violations.push('endGame()');
  }

  // Check 3: restartGame() body
  const restartBody = extractFunctionBody(html, 'restartGame');
  if (restartBody !== null && !hasCleanup(restartBody)) {
    violations.push('restartGame()');
  }

  if (violations.length > 0) {
    errors.push(
      'ERROR (5e0-CLEANUP-BETWEEN-ROUNDS): Missing feedback cleanup in ' +
        violations.join(', ') +
        '. The previous round\'s audio/subtitle/sticker will bleed into the next round or the end screen — ' +
        'FeedbackManager does NOT auto-clear on silent transitions, restart, or end-screen entry. ' +
        'Add this BEFORE any gameState mutation in each flagged function: ' +
        'try { FeedbackManager.sound.stopAll(); } catch(e) {} try { FeedbackManager.stream.stopAll(); } catch(e) {} ' +
        'If the game renders a custom feedback DOM node, also clear its textContent and remove its "show"/"correct"/"incorrect"/"visible" classes. ' +
        'Canonical source: alfred/skills/feedback/SKILL.md Cross-Cutting Rule 10 + alfred/skills/feedback/reference/timing-and-blocking.md § "Round/Phase Cleanup" + alfred/parts/PART-017.md. Also see CDN_CONSTRAINTS_BLOCK rule GEN-CLEANUP-BETWEEN-ROUNDS.'
    );
  }
})();

// ─── 5e0-FEEDBACK-MIN-DURATION. Bare await on answer-feedback sound.play ───────
// FeedbackManager.sound.play() can resolve before the audio finishes playing.
// Any code after `await sound.play(...)` (round advance, tile reset, game-over
// check) may run while audio/sticker is still audible.  Answer-feedback sound
// IDs (sound_life_lost, sound_correct, wrong_tap, correct_tap, sound_incorrect,
// all_correct, all_incorrect_*, partial_correct_*) MUST be wrapped in
// Promise.all([sound.play(...), new Promise(r => setTimeout(r, 1500))]) to
// guarantee the audio fully plays before the game proceeds.  VO and transition
// audio (vo_*, sound_game_complete, sound_game_over, sound_game_victory) are
// exempt — they play during transition screens where no immediate state change
// follows.  Validator: find each feedback sound.play, check if Promise.all
// wraps it within ~80 chars preceding.
(function checkFeedbackMinDuration() {
  // Only check games that use FeedbackManager
  if (!/FeedbackManager\.sound\.play\s*\(/.test(html)) return;

  // Answer-feedback sound IDs that need the Promise.all wrapper
  const feedbackIds = [
    'sound_life_lost', 'sound_correct', 'wrong_tap', 'correct_tap',
    'sound_incorrect', 'all_correct', 'all_incorrect_attempt1',
    'all_incorrect_last_attempt', 'partial_correct_attempt1',
    'partial_correct_last_attempt'
  ];
  const idPattern = feedbackIds.map(function(id) {
    return id.replace(/_/g, '_');
  }).join('|');

  // Match: FeedbackManager.sound.play('sound_life_lost'  (with optional whitespace)
  const playRe = new RegExp(
    'FeedbackManager\\.sound\\.play\\s*\\(\\s*[\'"](' + idPattern + ')[\'"]',
    'g'
  );

  const violations = [];
  let m;
  while ((m = playRe.exec(html)) !== null) {
    // Look backwards up to 80 chars for Promise.all(
    const start = Math.max(0, m.index - 80);
    const preceding = html.slice(start, m.index);
    if (/Promise\.all\s*\(\s*\[/.test(preceding)) continue; // correctly wrapped

    violations.push(m[1]); // the sound ID
    if (violations.length >= 3) break;
  }

  if (violations.length > 0) {
    errors.push(
      'ERROR (5e0-FEEDBACK-MIN-DURATION): ' + violations.length + ' answer-feedback ' +
        'sound.play() call(s) (' + violations.join(', ') + ') are awaited without ' +
        'Promise.all minimum-duration wrapper. FeedbackManager.sound.play() can resolve ' +
        'BEFORE the audio finishes — code after await runs while audio/sticker is still ' +
        'playing, causing round transitions mid-feedback. Wrap in: await Promise.all([ ' +
        'FeedbackManager.sound.play(id, { sticker }), new Promise(function(r) { ' +
        'setTimeout(r, 1500); }) ]); See PART-017 "Minimum Feedback Duration" and ' +
        'PART-026 Anti-Pattern 34.'
    );
  }
})();

// ─── 5e0-LASTLIFE-SKIP-FORBIDDEN. endGame inside lives<=0 block without preceding feedback
// When lives reaches 0 (last life lost), wrong-answer SFX MUST play BEFORE endGame.
// Pattern: if (gameState.lives <= 0) { ... endGame(false) ... } with NO preceding
// FeedbackManager.sound.play call = student sees game-over with no incorrect feedback.
// Correct: play wrong SFX (awaited, Promise.all 1500ms min) THEN check lives<=0 → endGame.
(function checkLastLifeSkipForbidden() {
  if (!/FeedbackManager\.sound\.play\s*\(/.test(html)) return;
  if (!/endGame/.test(html)) return;

  // Find blocks: if (gameState.lives <= 0) { ... endGame ... }
  // or if (lives <= 0) { ... endGame ... }
  var livesCheckRe = /if\s*\(\s*(?:gameState\.)?lives\s*<=\s*0\s*\)\s*\{([^}]{0,600})\}/g;
  var m;
  var violations = [];
  while ((m = livesCheckRe.exec(html)) !== null) {
    var blockBody = m[1];
    // Check if endGame is called inside this block
    if (!/endGame\s*\(/.test(blockBody)) continue;
    // Check if FeedbackManager.sound.play appears BEFORE this lives check
    // Look back 500 chars for a FeedbackManager.sound.play call (in same function scope)
    var start = Math.max(0, m.index - 500);
    var preceding = html.slice(start, m.index);
    if (/FeedbackManager\.sound\.play\s*\(/.test(preceding)) continue; // feedback plays before check — correct
    violations.push(m.index);
    if (violations.length >= 2) break;
  }

  if (violations.length > 0) {
    errors.push(
      'ERROR (5e0-LASTLIFE-SKIP-FORBIDDEN): ' + violations.length + ' endGame() call(s) found ' +
        'inside a lives<=0 check block WITHOUT preceding wrong-answer feedback audio. ' +
        'When the last life is lost, the wrong SFX MUST play (awaited with Promise.all ' +
        '1500ms minimum) BEFORE endGame(false). Move the lives<=0 check AFTER the ' +
        'feedback audio block. See GEN-LASTLIFE-FEEDBACK and feedback/SKILL.md Case 8.'
    );
  }
})();

// ─── 5e0-LIVES-DUP-FORBIDDEN. Custom lives / hearts DOM duplicating ProgressBar
// ProgressBarComponent with totalLives >= 1 already renders a hearts strip
// inside #mathai-progress-slot. Any game-owned lives element / renderer paints
// a SECOND hearts row (symptom: two hearts rows visible on-screen). Canonical
// path is progressBar.update(roundsCompleted, Math.max(0, lives)) — it owns
// the lives strip. See PART-023, PART-026 Anti-Pattern 33.
(function checkLivesDupForbidden() {
  // Does the game use ProgressBarComponent with lives enabled?
  const ctorRe = /new\s+ProgressBarComponent\s*\(([\s\S]*?)\)/;
  const ctor = ctorRe.exec(html);
  if (!ctor) return;
  // Extract totalLives value (accept literal int or gameState.totalLives / totalLives expression).
  const tlLiteral = /totalLives\s*:\s*([0-9]+)\b/.exec(ctor[1]);
  if (tlLiteral && Number(tlLiteral[1]) === 0) return; // no hearts configured → no duplication risk
  // If totalLives is a literal 0 we bail out above. Otherwise assume lives are in play.

  const violations = [];
  // (1) Custom lives / hearts container elements. Match class= or id= attributes
  //     that carry a lives-* / hearts-* identifier, or a bare single-class "heart"
  //     applied to an element in game HTML.
  const classIdRe = /(?:class|id)\s*=\s*["'][^"']*\b(lives-row|lives-strip|lives-container|lives-display|lives-bar|hearts-row|hearts-strip|hearts-container|hearts-display|hearts-bar|livesRow|livesStrip|heartsRow|heartsStrip)\b[^"']*["']/g;
  let mm;
  while ((mm = classIdRe.exec(html)) !== null) {
    violations.push(`custom "${mm[1]}" element`);
    if (violations.length >= 3) break;
  }
  // Bare class="heart" / class="heart lost" single-class heart glyph elements.
  // Avoid matching ".mathai-preview-heart" or CDN-owned classes by requiring
  // the class list to start with or equal "heart".
  const bareHeartRe = /class\s*=\s*["']heart(?:\s+[a-zA-Z0-9_-]+)*["']/g;
  while (bareHeartRe.exec(html) !== null) {
    violations.push('bare class="heart" element');
    if (violations.length >= 4) break;
  }
  // (2) Custom lives / hearts renderer functions. Match function declarations and
  //     assigned-function expressions.
  const fnRe = /\b(?:function\s+|(?:const|let|var)\s+)(renderLivesRow|renderLives|renderHearts|renderHeartsRow|updateLivesDisplay|updateLivesRow|updateHearts|updateHeartsRow|buildLives|injectLives|paintLives|paintHearts)\b/;
  const fn = fnRe.exec(html);
  if (fn) violations.push(`custom ${fn[1]}() function`);

  if (violations.length === 0) return;
  errors.push(
    'ERROR (5e0-LIVES-DUP-FORBIDDEN): Custom lives / hearts DOM or renderer detected alongside ' +
      'ProgressBarComponent — paints a second hearts row on top of the CDN ProgressBar lives strip ' +
      '(symptom: two rows of hearts visible on-screen). Offenders: ' + violations.join(', ') + '. ' +
      'Remove the custom lives container, the custom renderer, and any <span class="heart"> glyphs. ' +
      'Use progressBar.update(roundsCompleted, Math.max(0, gameState.lives)) — ProgressBar owns the ' +
      'lives strip. For a heart-break animation, target the CDN-rendered heart class with a one-shot ' +
      'CSS class; do NOT build a parallel hearts DOM. See PART-023 "ProgressBar Owns the Lives Display" ' +
      'and PART-026 Anti-Pattern 33.'
  );
})();

// ─── FloatingButton (PART-050) — CDN + slot + predicate + duplication ───────
// Enforces the four invariants of PART-050 FloatingButtonComponent:
//   GEN-FLOATING-BUTTON-CDN       — script tag present when component is used
//   GEN-FLOATING-BUTTON-SLOT      — slots.floatingButton:true in ScreenLayout.inject
//   GEN-FLOATING-BUTTON-PREDICATE — setSubmittable() wired to an input/state handler
//   5e0-FLOATING-BUTTON-DUP       — no duplicate submit/retry/next/cta button in #gameContent
(function checkFloatingButton() {
  const usesFloatingButton = /\bnew\s+FloatingButtonComponent\s*\(/.test(html) ||
    /\bnew\s+FloatingButton\s*\(/.test(html);
  if (!usesFloatingButton) return;
  // Spec opt-out: user wants to hand-roll buttons. Skip CDN/SLOT/PREDICATE/DUP.
  // If they opted out but still used FloatingButton, that's inconsistent but not
  // our problem — the inline button is their chosen path, not ours.
  if (specOptOuts.floatingButton === false) return;

  // (1) GEN-FLOATING-BUTTON-CDN — require the standalone CDN script OR the bundle.
  const hasStandaloneCdn = /<script[^>]+src=["'][^"']*\/floating-button\/index\.js["']/i.test(html);
  const hasBundle = /<script[^>]+src=["'][^"']*\/packages\/components\/index\.js["']/i.test(html);
  if (!hasStandaloneCdn && !hasBundle) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-CDN]: FloatingButtonComponent is instantiated but no CDN script tag is present. ' +
        'Include EITHER the standalone component: ' +
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/floating-button/index.js"></script>, ' +
        'OR the bundle: ' +
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>. ' +
        '(PART-050, GEN-FLOATING-BUTTON-CDN)'
    );
  }

  // (2) GEN-FLOATING-BUTTON-SLOT — ScreenLayout.inject must pass slots.floatingButton:true.
  //     Accept either truthy literal (`floatingButton: true`) or a string slot id.
  const hasSlotDecl = /floatingButton\s*:\s*(?:true\b|['"][^'"]+['"])/.test(html);
  if (!hasSlotDecl) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-SLOT]: FloatingButtonComponent is used but ScreenLayout.inject() does not declare ' +
        'slots.floatingButton. Add floatingButton: true to the slots object, e.g. ' +
        'ScreenLayout.inject(\'app\', { slots: { floatingButton: true, previewScreen: true, ... } }). ' +
        '(PART-050, GEN-FLOATING-BUTTON-SLOT)'
    );
  }

  // (3) GEN-FLOATING-BUTTON-PREDICATE — require that setSubmittable is called somewhere.
  //     This catches the "show once, never hide" anti-pattern where a game calls
  //     setMode('submit') after first interaction and never hides the button again
  //     when the player clears their input. setSubmittable(bool) is the canonical
  //     predicate-driven API; setMode(null) inside a handler also counts as a
  //     valid hide path (for games that prefer manual control).
  const hasSubmittable = /\.setSubmittable\s*\(/.test(html);
  const hasManualHide = /\.setMode\s*\(\s*(?:null|['"]hidden['"])/.test(html) ||
    /\.hide\s*\(\s*\)/.test(html);
  if (!hasSubmittable && !hasManualHide) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-PREDICATE]: FloatingButtonComponent is used but the code never calls ' +
        'setSubmittable() (or setMode(null) / hide()). The button must HIDE when the game state becomes ' +
        'non-submittable (e.g. player clears the input). Define an isSubmittable() predicate over gameState ' +
        'and call floatingBtn.setSubmittable(isSubmittable()) from every input / state-change handler. ' +
        'Without this, the button stays visible after input is cleared — a known regression. ' +
        '(PART-050, GEN-FLOATING-BUTTON-PREDICATE)'
    );
  }

  // (4) 5e0-FLOATING-BUTTON-DUP — no custom Submit/Retry/Next/Check/Done/Commit
  //     button anywhere in the source when FloatingButton is also in use. We
  //     scan the same attributes as GEN-FLOATING-BUTTON-MISSING (id / class /
  //     data-testid / aria-label / innerText) with the same reserved-word list.
  //     Using a narrower scan here is a trap — the build sub-agent has been
  //     observed evading an id/class-only check by renaming to "bb-go" /
  //     "bbGoBtn" while keeping data-testid="bb-submit-btn" and inner text
  //     "Submit" (bodmas-blitz regeneration, 2026-04-23). Match both rules'
  //     detection paths so whichever one fires (MISSING when FB absent, DUP
  //     when FB present) catches the same hand-rolled button.
  const dupCtaWord = /(submit|commit|retry|\bnext\b|\bcta\b|\bcheck\b|\bdone\b)/i;
  const dupBtnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  const dupViolations = [];
  let dbm;
  while ((dbm = dupBtnRe.exec(html)) !== null) {
    const attrs = dbm[1] || '';
    const inner = (dbm[2] || '').replace(/<[^>]+>/g, '').trim();
    // Skip CDN-rendered buttons (shouldn't appear in source but safe).
    if (/\bmathai-(?:fb|ts|preview|action)-/i.test(attrs)) continue;
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const classMatch = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const testidMatch = /\bdata-testid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const ariaMatch = /\baria-label\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const candidates = [
      idMatch ? 'id="' + idMatch[1] + '"' : null,
      classMatch ? 'class="' + classMatch[1] + '"' : null,
      testidMatch ? 'data-testid="' + testidMatch[1] + '"' : null,
      ariaMatch ? 'aria-label="' + ariaMatch[1] + '"' : null,
      inner && inner.length < 40 ? 'text="' + inner + '"' : null
    ].filter(Boolean);
    const hit = candidates.find(c => dupCtaWord.test(c));
    if (hit) {
      dupViolations.push(hit);
      if (dupViolations.length >= 3) break;
    }
  }
  if (dupViolations.length > 0) {
    errors.push(
      'ERROR (5e0-FLOATING-BUTTON-DUP): Custom <button> element(s) with reserved Submit / Retry / Next / Check / ' +
        'Done / Commit / CTA wording (in id, class, data-testid, aria-label, OR inner text) found alongside ' +
        'FloatingButtonComponent. Offender(s): ' + dupViolations.join('; ') + '. ' +
        'FloatingButton owns the Submit / Retry / Next lifecycle — DELETE the duplicate <button> element(s) entirely ' +
        '(including their data-testid and inner text) and wire the handlers to floatingBtn.on(\'submit\' | \'retry\' | \'next\', ...). ' +
        'KNOWN EVASION PATTERN (do NOT attempt): renaming id/class to innocuous names (e.g. "bb-go", "bbGoBtn") while ' +
        'keeping data-testid="bb-submit-btn" and inner text "Submit" — this rule scans all 5 attributes and still fires. ' +
        'If existing tests reference data-testid="bb-submit-btn", update them to target the FloatingButton DOM (' +
        'selector: .mathai-fb-btn-primary, or add a data-testid via the FloatingButton API). ' +
        'Reset remains inline per PART-022. (PART-050, 5e0-FLOATING-BUTTON-DUP)'
    );
  }
})();

// ─── GEN-FLOATING-BUTTON-MISSING — negative rule ────────────────────────────
// Fires when the generated game emits a hand-rolled Submit / Check / Done button
// in HTML source but does NOT instantiate FloatingButtonComponent. Closes the
// gap where archetype PART-flag rows omit PART-050 and the build sub-agent
// produces an inline button instead. Complements the four GEN-FLOATING-BUTTON-*
// rules above, which only fire when FloatingButton IS used.
//
// Matches are intentionally strict:
//   - <button> element source (not runtime-rendered CDN buttons)
//   - id / class / data-testid / inner text contains a submit-CTA word
//   - submit-CTA words: "submit", "check", "done", "commit" (word-boundary for
//     the short ones to avoid matching "checkbox", "doneyet", etc.)
//
// NO HTML-level escape hatch. An earlier version of this rule accepted a
// sentinel comment (<!-- GEN-FLOATING-BUTTON-MISSING: ignore (reason: ...) -->)
// but build sub-agents exploited it by writing plausible-sounding reasons
// ("submit-only flow, no retry/next lifecycle") to bypass the rule — even
// though PART-050 explicitly handles submit-only flows. Narrative justification
// is not a check. If a game legitimately does not need FloatingButton for a
// Submit-labelled button, the spec must declare `floatingButton: false` (which
// means the generator should not emit a Submit CTA at all — the flow should
// auto-evaluate on interaction), OR the button text/id/class should not use
// the reserved words (rename to "Go", "Evaluate", etc.).
//
// Skip conditions:
//   - Button classed mathai-* (CDN-rendered, shouldn't appear in source)
//   - File already instantiates FloatingButtonComponent (handled above)
(function checkFloatingButtonMissing() {
  const usesFloatingButton = /\bnew\s+FloatingButtonComponent\s*\(/.test(html) ||
    /\bnew\s+FloatingButton\s*\(/.test(html);
  if (usesFloatingButton) return;
  // Spec opt-out: user explicitly wants inline buttons for this game. Skip.
  // (Sibling spec.md contains `floatingButton: false`.)
  if (specOptOuts.floatingButton === false) return;

  // Scan every <button ...>...</button> in the source.
  const btnWithContentRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  // CTA words. Word-boundary for "check"/"done" to avoid "checkbox"/"doneyet".
  // "submit" and "commit" are unambiguous enough to not need \b.
  const ctaWord = /(submit|commit|\bcheck\b|\bdone\b)/i;
  const violations = [];
  let m;
  while ((m = btnWithContentRe.exec(html)) !== null) {
    const attrs = m[1] || '';
    const inner = (m[2] || '').replace(/<[^>]+>/g, '').trim(); // strip nested tags
    // Skip CDN-rendered buttons — they shouldn't appear in source but be safe.
    if (/\bmathai-(?:fb|ts|preview|action)-/i.test(attrs)) continue;
    // Check id / class / data-testid / aria-label attributes + inner text.
    const attrStr = attrs.toLowerCase();
    const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const classMatch = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const testidMatch = /\bdata-testid\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const ariaMatch = /\baria-label\s*=\s*["']([^"']+)["']/i.exec(attrs);

    const candidates = [
      idMatch ? 'id="' + idMatch[1] + '"' : null,
      classMatch ? 'class="' + classMatch[1] + '"' : null,
      testidMatch ? 'data-testid="' + testidMatch[1] + '"' : null,
      ariaMatch ? 'aria-label="' + ariaMatch[1] + '"' : null,
      inner && inner.length < 40 ? 'text="' + inner + '"' : null
    ].filter(Boolean);

    // Fire if ANY candidate mentions a CTA word.
    const hit = candidates.find(c => ctaWord.test(c));
    if (hit) {
      violations.push(hit);
      if (violations.length >= 3) break;
    }
  }

  if (violations.length === 0) return;

  errors.push(
    'ERROR [GEN-FLOATING-BUTTON-MISSING]: A hand-rolled Submit / Check / Done / Commit <button> was emitted ' +
      'but FloatingButtonComponent is not instantiated. Offender(s): ' + violations.join('; ') + '. ' +
      'Per PART-050, EVERY flow with a Submit / Check / Done CTA MUST use FloatingButtonComponent — the ' +
      'archetype PART-flags row is a default starting point, but the flow overrides it (game-archetypes SKILL.md constraint #8). ' +
      'This rule has NO escape hatch — narrative justification is not a check. ' +
      'COMMON FAILED REASONING (do NOT use these to justify skipping FloatingButton): ' +
      '(a) "Standalone totalRounds:1, no retry/next lifecycle" — WRONG: PART-050 handles submit-only flows; ' +
      'retry/next are optional modes, the component works perfectly with setMode(\'submit\') only. ' +
      '(b) "Submit button is inside the form alongside the input" — WRONG: FloatingButton is a fixed-bottom ' +
      'action button that replaces the inline submit; inputs stay in #gameContent, only the button moves. ' +
      '(c) "Archetype profile doesn\'t list PART-050" — WRONG: the archetype row is a default; the spec\'s flow overrides it. ' +
      '(d) "Speed Blitz / Lives Challenge / [any archetype] doesn\'t need it" — WRONG: if the spec describes a Submit button, PART-050 applies. ' +
      'FIX (in this order): ' +
      '(1) Add the CDN bundle <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>. ' +
      '(2) Pass slots.floatingButton:true to ScreenLayout.inject(). ' +
      '(3) Instantiate const floatingBtn = new FloatingButtonComponent({ slotId: \'mathai-floating-button-slot\' });. ' +
      '(4) Remove the hand-rolled <button> from the emitted HTML and wire its handler via floatingBtn.on(\'submit\', async () => {...}). ' +
      '(5) Drive visibility with floatingBtn.setSubmittable(isSubmittable()) from every input / state-change handler. ' +
      'If the spec genuinely has NO Submit CTA (e.g. an auto-evaluate-on-interaction flow), the generator should not emit a Submit button ' +
      'at all — remove the button. If the <button> is a rare non-CTA use (e.g. form field that happens to say "Check the box"), ' +
      'rename the id/class/text to avoid the reserved words (submit, check, done, commit) — there is no validator opt-out. ' +
      '(PART-050, GEN-FLOATING-BUTTON-MISSING)'
  );
})();

// ─── PART-050 extension: Next + Try Again ───────────────────────────────────
// Four additional rules enforcing the full FloatingButton lifecycle:
//   GEN-FLOATING-BUTTON-NEXT-MISSING     — Next button must be wired at game end
//   GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE — on('next') handler must emit next_ended
//   GEN-FLOATING-BUTTON-RETRY-STANDALONE — standalone+lives>1 must wire retry
//   GEN-FLOATING-BUTTON-RETRY-LIVES-RESET — retry handler must preserve lives
//
// All four rules auto-skip when the game is in the FloatingButton opt-out
// allowlist (specContext.floatingButton === false).
(function checkFloatingButtonLifecycle() {
  const usesFloatingButton = /\bnew\s+FloatingButtonComponent\s*\(/.test(html) ||
    /\bnew\s+FloatingButton\s*\(/.test(html);
  if (!usesFloatingButton) return;
  if (specContext.floatingButton === false) return;

  // ─── GEN-FLOATING-BUTTON-NEXT-MISSING ─────────────────────────────────────
  // Fires when the game has an end-state flow (anything that posts game_complete,
  // whether inline or via a payload variable) but neither calls setMode('next')
  // nor registers on('next', ...). Every FloatingButton-using game that reaches
  // end-game MUST show Next so the harness receives the next_ended teardown
  // signal.
  //
  // Detection is intentionally broad: we look for `type: 'game_complete'`
  // anywhere in the source (covers both `postMessage({type:...})` inline and
  // `const payload = {type:...}; postMessage(payload)` via a variable). The
  // false-positive risk is limited — the SFX preload uses `id:` not `type:`.
  const postsGameComplete = /type\s*:\s*['"]game_complete['"]/.test(html);
  const callsSetModeNext = /\.setMode\s*\(\s*['"]next['"]/.test(html);
  const registersOnNext = /\.on\s*\(\s*['"]next['"]/.test(html);
  if (postsGameComplete && !callsSetModeNext && !registersOnNext) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-NEXT-MISSING]: FloatingButton is instantiated and game_complete is posted, ' +
        'but the Next button is NEVER shown — no setMode(\'next\') call AND no on(\'next\', ...) handler is registered. ' +
        'Per PART-050 "Next flow", every FloatingButton-using game that reaches an end state MUST show the Next ' +
        'button AFTER the end TransitionScreen dismisses, and MUST emit `{type: \'next_ended\'}` when clicked, so ' +
        'the host harness can tear down the iframe / advance to the next worksheet item. Canonical wiring: ' +
        '(1) async function showNextCTA() { transitionScreen.hide(); floatingBtn.setMode(\'next\'); } ' +
        '(2) floatingBtn.on(\'next\', function () { window.parent.postMessage({ type: \'next_ended\' }, \'*\'); floatingBtn.destroy(); }); ' +
        'The two-step UX is REQUIRED: TransitionScreen shows briefly with stars + message, tap-dismisses, THEN Next appears on the bare screen. ' +
        'Do NOT emit next_ended from the submit handler directly — it fires in response to the user clicking Next AFTER viewing results. ' +
        '(PART-050 "Next flow" + postmessage-schema.md "next_ended", GEN-FLOATING-BUTTON-NEXT-MISSING)'
    );
  }

  // ─── GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE ─────────────────────────────────
  // When on('next', ...) IS registered, its handler body MUST post {type:
  // 'next_ended'}. A silent Next handler breaks the harness signal.
  //
  // Extract the handler body. We match:
  //   floatingBtn.on('next', function() { ... })
  //   floatingBtn.on('next', () => { ... })
  //   floatingBtn.on('next', () => postMessage(...))   // single-expression arrow
  // The body is whatever comes after the arrow or function() { and before the
  // matching close brace. Simple brace-balance walk — survives nested handlers.
  if (registersOnNext) {
    const onNextStart = html.search(/\.on\s*\(\s*['"]next['"]/);
    let handlerBody = '';
    if (onNextStart >= 0) {
      // Advance past the handler opening — look for '=>' or 'function'.
      const after = html.slice(onNextStart);
      const bodyOpen = after.search(/=>\s*[\{(]|function\s*\([^)]*\)\s*\{/);
      if (bodyOpen >= 0) {
        const start = onNextStart + bodyOpen;
        // Walk forward, counting braces, until the handler's top-level scope closes.
        // We accept "arrow with single-expression body" (no braces) up to the closing `)`.
        const tail = html.slice(start);
        if (/^=>\s*\(/.test(tail) || /^=>\s*[a-zA-Z_$]/.test(tail)) {
          // Arrow single-expression body: read up to the matching `)` that closes on(...).
          let depth = 0; let i = 0; let started = false;
          for (; i < tail.length; i++) {
            const c = tail[i];
            if (c === '(') { depth++; started = true; }
            else if (c === ')') { depth--; if (started && depth <= 0) break; }
          }
          handlerBody = tail.slice(0, i);
        } else {
          // Braced body: read up to the matching `}`.
          const braceStart = tail.indexOf('{');
          if (braceStart >= 0) {
            let depth = 0; let i = braceStart;
            for (; i < tail.length; i++) {
              const c = tail[i];
              if (c === '{') depth++;
              else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
            }
            handlerBody = tail.slice(braceStart, i);
          }
        }
      }
    }
    // Detection is intentionally broad to cover both inline postMessage calls
    // and indirect `postMessage(payload)` where the payload is a variable
    // built with `type: 'next_ended'`. We require BOTH `type: 'next_ended'`
    // to appear in the handler body AND a `postMessage` call in the same body.
    const mentionsNextEnded = /type\s*:\s*['"]next_ended['"]/.test(handlerBody);
    const callsPostMessage = /postMessage\s*\(/.test(handlerBody);
    const postsNextEnded = mentionsNextEnded && callsPostMessage;
    if (!postsNextEnded) {
      errors.push(
        'ERROR [GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE]: floatingBtn.on(\'next\', ...) is registered but the handler ' +
          'body does NOT post `{ type: \'next_ended\' }`. The Next handler MUST emit the next_ended postMessage so ' +
          'the host harness receives the iframe-teardown / advance signal. Canonical handler: ' +
          'floatingBtn.on(\'next\', function () { window.parent.postMessage({ type: \'next_ended\' }, \'*\'); floatingBtn.destroy(); }); ' +
          'A silent Next handler (e.g. one that only calls destroy() or navigates internally) leaves the harness ' +
          'without any signal that the player has finished — the iframe stays open indefinitely. ' +
          '(PART-050 "Next flow" + postmessage-schema.md "next_ended", GEN-FLOATING-BUTTON-NEXT-POSTMESSAGE)'
      );
    }
  }

  // ─── GEN-FLOATING-BUTTON-NEXT-TIMING ──────────────────────────────────────
  // Next must be the LAST thing a player sees — its purpose is "tear down the
  // iframe / advance to the next worksheet item". If the game shows Next
  // immediately after (or alongside) game_complete + feedback audio, the
  // player can tap Next before results are visible, destroying the iframe
  // mid-audio. That defeats the whole point of the two-step UX.
  //
  // Bad pattern (bodmas-blitz regression, 2026-04-23):
  //   postGameComplete(sr, su);
  //   floatingBtn.setMode('next');          // <- appears immediately
  //
  // Good pattern:
  //   postGameComplete(sr, su);
  //   transitionScreen.show({ buttons: [] });
  //   transitionScreen.onDismiss(() => {
  //     transitionScreen.hide();
  //     floatingBtn.setMode('next');        // <- appears only after dismiss
  //   });
  //
  // Heuristic: for every `setMode('next')` call, look at the ~400-char window
  // BEFORE it. If that window contains a `game_complete` reference AND does
  // NOT contain any separator signalling async / dismiss / user-action (e.g.
  // `transitionScreen.hide(`, `transitionScreen.onDismiss(`, `await `,
  // `.then(`), flag it as too-early.
  const setModeNextRe = /\.setMode\s*\(\s*['"]next['"]\s*\)/g;
  let smm;
  const tooEarlyOffsets = [];
  while ((smm = setModeNextRe.exec(html)) !== null) {
    const end = smm.index;
    const start = Math.max(0, end - 400);
    const window = html.slice(start, end);
    const mentionsGameComplete = /type\s*:\s*['"]game_complete['"]|postGameComplete\s*\(|postGameCompleteEvent\s*\(/.test(window);
    const hasSeparator = /transitionScreen\.(hide|onDismiss)\s*\(|\bawait\b|\.then\s*\(|\bsetTimeout\s*\(/.test(window);
    if (mentionsGameComplete && !hasSeparator) {
      tooEarlyOffsets.push(end);
      if (tooEarlyOffsets.length >= 3) break;
    }
  }
  if (tooEarlyOffsets.length > 0) {
    // Report with line numbers so the build sub-agent can find the offender.
    const lineNumbers = tooEarlyOffsets.map(off => html.slice(0, off).split('\n').length).join(', ');
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-NEXT-TIMING]: `floatingBtn.setMode(\'next\')` is called too early — ' +
        'within 400 chars of a `game_complete` postMessage AND without a `transitionScreen.hide()` / ' +
        '`transitionScreen.onDismiss(...)` / `await` / `.then()` / `setTimeout()` separating them. Call site line(s): ' + lineNumbers + '. ' +
        'Next is the LAST thing a player should see — its purpose is signalling iframe teardown via `next_ended`. ' +
        'If Next appears while feedback audio is still playing, the player can tap it and destroy the iframe ' +
        'mid-audio, defeating the two-step end-of-game UX. ' +
        'CORRECT SEQUENCE (PART-050 "Next flow"): ' +
        '(1) evaluate → await FeedbackManager.play(...) (full audio + sticker sequence) ' +
        '(2) post game_complete ' +
        '(3) transitionScreen.show({ content: resultsHtml, buttons: [] }) — NO buttons, tap-dismissible ' +
        '(4) transitionScreen.onDismiss(() => { transitionScreen.hide(); floatingBtn.setMode(\'next\'); }); ' +
        '(5) floatingBtn.on(\'next\', () => { window.parent.postMessage({ type: \'next_ended\' }, \'*\'); floatingBtn.destroy(); }); ' +
        'DO NOT call setMode(\'next\') inside `endGame()` / `postGameComplete()` / `handleGameOver()` or on any ' +
        'line right after `postGameComplete(...)` — that is the regression this rule catches. ' +
        '(PART-050 "Next flow", GEN-FLOATING-BUTTON-NEXT-TIMING)'
    );
  }

  // ─── GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN ─────────────────────────────────
  // The Next/Continue/Done/Finish CTA — i.e. the "advance the lifecycle one
  // step" navigation verb — is owned by FloatingButton, NOT by a button inside
  // a TransitionScreen card. A sub-agent regression (bodmas-blitz 2026-04-23)
  // put `text: 'Next'` inside the transitionScreen.show(...) buttons array,
  // producing a confusing two-step Next UX: (1) player sees Next on the card,
  // clicks it, (2) floating Next then appears at the bottom, player clicks
  // THAT to actually fire next_ended. Users see two Next buttons in sequence.
  //
  // Reserved words (forbidden in TS button text): NAVIGATION VERBS only —
  // {Next, Continue, Done, Finish, Go to Next, Skip Forward}.
  //
  // Allowed in TS button text: SEMANTIC END-GAME ACTIONS that name a
  // destination/branch — {Play Again, Claim Stars, Try Again, I'm ready,
  // Let's go, Skip}. These belong on Victory / Game Over / Motivation cards
  // and route to specific screens (showMotivation, showStarsCollected,
  // restartGame). They are NOT navigation verbs and do NOT compete with
  // FloatingButton's `next` mode.
  //
  // The canonical Victory template (default-transition-screens.md § 3) uses
  // `[Play Again, Claim Stars]` for <3★ and `[Claim Stars]` for 3★. Stripping
  // those buttons to silence this rule breaks the Play Again loop and is the
  // pattern this rule explicitly does NOT want. See GEN-VICTORY-BUTTONS-
  // REQUIRED for the positive enforcement of that template.
  const tsCtaPattern = /text\s*:\s*['"](?:Next|Continue|Done\b|Finish|Go\s*to\s*Next|Skip\s*Forward)['"]/gi;
  const tsCtaMatches = [];
  let tsm;
  while ((tsm = tsCtaPattern.exec(html)) !== null) {
    // Extract the matched text value
    const labelMatch = tsm[0].match(/['"]([^'"]+)['"]/);
    if (labelMatch) {
      const lineNo = html.slice(0, tsm.index).split('\n').length;
      tsCtaMatches.push({ label: labelMatch[1], line: lineNo });
      if (tsCtaMatches.length >= 3) break;
    }
  }
  if (tsCtaMatches.length > 0) {
    const offenders = tsCtaMatches.map(m => 'line ' + m.line + ': text:"' + m.label + '"').join('; ');
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN]: TransitionScreen button with a navigation-verb text ' +
        '(Next / Continue / Done / Finish / Go to Next / Skip Forward) was found AND FloatingButton is in use. ' +
        'Offender(s): ' + offenders + '. ' +
        'Navigation verbs are owned by FloatingButton, NOT by a button inside the TransitionScreen card. ' +
        'A Next inside the TS card followed by a floating Next at the bottom is a confusing double-Next UX. ' +
        'CORRECT PATTERN for END-OF-FLOW (after AnswerComponent reveal, or after final inline feedback): ' +
        'floatingBtn.setMode(\'next\'); floatingBtn.on(\'next\', () => { postMessage({type:\'next_ended\'}); floatingBtn.destroy(); }); ' +
        'NOTE: SEMANTIC END-GAME ACTIONS (Play Again, Claim Stars, Try Again, I\'m ready, Let\'s go, Skip) are ' +
        'ALLOWED on TS cards — they name a destination, not a navigation step. The canonical Victory template ' +
        '(default-transition-screens.md § 3) requires `[Play Again, Claim Stars]` for <3★ and `[Claim Stars]` for 3★. ' +
        'Do NOT strip those buttons to silence this rule — they are NOT in the reserved list. ' +
        '(PART-050 "Next flow", GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN, default-transition-screens.md § 3, ' +
        'see also GEN-VICTORY-BUTTONS-REQUIRED for positive enforcement)'
    );
  }

  // ─── GEN-VICTORY-BUTTONS-REQUIRED ─────────────────────────────────────────
  // Positive enforcement of the canonical Victory template
  // (default-transition-screens.md § 3). Three sub-agent regressions
  // (cross-logic, bodmas-blitz 2026-04-23, others) have stripped the Victory
  // buttons array entirely to silence GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN,
  // breaking the Play Again -> showMotivation loop. This rule catches that
  // regression directly: any `transitionScreen.show({...})` whose `title:`
  // matches /Victory/i MUST contain a `Claim Stars` button. If the source
  // also branches on `gameState.stars` (implying a <3★ path exists), it MUST
  // additionally contain a `Play Again` button.
  //
  // Auto-skips for standalone games (totalRounds === 1) — those are barred
  // from TransitionScreen entirely by GEN-FLOATING-BUTTON-STANDALONE-TS-
  // FORBIDDEN, so there's no Victory TS to enforce.
  if (!isStandalone) {
    const victoryShowPattern = /transitionScreen\s*\.\s*show\s*\(\s*\{[\s\S]{0,3000}?\}\s*\)/g;
    let vsm;
    while ((vsm = victoryShowPattern.exec(html)) !== null) {
      const block = vsm[0];
      const isVictory = /title\s*:\s*['"][^'"]*Victory/i.test(block);
      if (!isVictory) continue;
      const hasClaimStars = /text\s*:\s*['"][^'"]*Claim\s*Stars[^'"]*['"]/i.test(block);
      const hasPlayAgain = /text\s*:\s*['"][^'"]*Play\s*Again[^'"]*['"]/i.test(block);
      const branchesOnStars =
        /gameState\s*\.\s*stars\s*[<!=]/.test(block) ||
        /stars\s*[<!=]/.test(block) ||
        /showMotivation\s*\(/.test(html);
      const lineNo = html.slice(0, vsm.index).split('\n').length;
      if (!hasClaimStars) {
        errors.push(
          'ERROR [GEN-VICTORY-BUTTONS-REQUIRED]: Victory transitionScreen.show at line ' + lineNo +
            ' is missing a `text: "Claim Stars"` button. The canonical Victory template ' +
            '(default-transition-screens.md § 3) MUST include a primary "Claim Stars" button that routes to ' +
            'showStarsCollected. Stripping the buttons array (e.g. `buttons: []` plus an `onDismiss` workaround) ' +
            'breaks the documented end-of-game flow and is a direct regression — `Claim Stars` is NOT in ' +
            'GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN\'s reserved list. ' +
            'CORRECT: const buttons = stars === 3 ? [{text: "Claim Stars", type: "primary", action: showStarsCollected}] ' +
            ': [{text: "Play Again", type: "secondary", action: showMotivation}, {text: "Claim Stars", type: "primary", action: showStarsCollected}]; ' +
            'transitionScreen.show({ title: "Victory 🎉", stars, buttons, ... }). ' +
            '(default-transition-screens.md § 3, GEN-VICTORY-BUTTONS-REQUIRED)'
        );
      }
      if (branchesOnStars && !hasPlayAgain) {
        errors.push(
          'ERROR [GEN-VICTORY-BUTTONS-REQUIRED]: Victory transitionScreen.show at line ' + lineNo +
            ' branches on gameState.stars (or showMotivation exists) implying a <3★ path, but no `text: "Play Again"` ' +
            'button is present. The canonical Victory template requires `[Play Again, Claim Stars]` when stars < 3 ' +
            'so the player can choose to retry the game. ' +
            'CORRECT: include {text: "Play Again", type: "secondary", action: showMotivation} in the buttons array ' +
            'when stars < 3. (default-transition-screens.md § 3, GEN-VICTORY-BUTTONS-REQUIRED)'
        );
      }
    }
  }

  // ─── GEN-FLOATING-BUTTON-LIFECYCLE ────────────────────────────────────────
  // FloatingButton state per screen. Victory / Game Over / Motivation MUST
  // hide the FloatingButton (setMode('hidden') or .destroy()) before the
  // TransitionScreen renders its in-card buttons — otherwise both the in-card
  // CTA (Claim Stars / Try Again / I'm ready) and a floating button compete
  // for the player's attention. setMode('next') is reserved for AnswerComponent
  // reveal (or, for answerComponent: false games, for Stars Collected onMounted
  // after celebration audio).
  //
  // Static check: each `transitionScreen.show({...title: "Victory|Game Over|
  // Ready to improve"...})` call site must have a `floatingBtn.setMode('hidden')`
  // OR `floatingBtn.destroy()` within ±25 lines (typically immediately before
  // the show()). This catches the "Victory rendered while submit-mode floating
  // button still visible" regression.
  if (/\bfloatingBtn\b/.test(html) || /\bnew\s+FloatingButtonComponent\s*\(/.test(html)) {
    const lifecycleScreens = [
      { name: 'Victory', re: /title\s*:\s*['"][^'"]*Victory/i },
      { name: 'Game Over', re: /title\s*:\s*['"][^'"]*Game\s*Over/i },
      { name: 'Motivation', re: /title\s*:\s*['"][^'"]*Ready\s*to\s*improve/i },
    ];
    const showCallPattern = /transitionScreen\s*\.\s*show\s*\(\s*\{[\s\S]{0,3000}?\}\s*\)/g;
    let scm;
    while ((scm = showCallPattern.exec(html)) !== null) {
      const block = scm[0];
      const screen = lifecycleScreens.find(s => s.re.test(block));
      if (!screen) continue;
      const lineNo = html.slice(0, scm.index).split('\n').length;
      const lines = html.split('\n');
      const start = Math.max(0, lineNo - 25);
      const end = Math.min(lines.length, lineNo + 5);
      const window = lines.slice(start, end).join('\n');
      const hidden =
        /floatingBtn\s*\.\s*setMode\s*\(\s*['"]hidden['"]/.test(window) ||
        /floatingBtn\s*\.\s*destroy\s*\(/.test(window);
      if (!hidden) {
        errors.push(
          'ERROR [GEN-FLOATING-BUTTON-LIFECYCLE]: ' + screen.name + ' transitionScreen.show at line ' + lineNo +
            ' has no `floatingBtn.setMode(\'hidden\')` or `floatingBtn.destroy()` within the surrounding 25 lines. ' +
            'The FloatingButton MUST be hidden before Victory / Game Over / Motivation renders, otherwise the ' +
            'in-card buttons compete with a stale floating button. ' +
            'setMode(\'next\') is reserved for AnswerComponent reveal (or Stars Collected onMounted when ' +
            'answerComponent: false). ' +
            'CORRECT: try { floatingBtn.setMode(\'hidden\'); } catch (e) {} ' +
            'await transitionScreen.show({ ... }); ' +
            '(default-transition-screens.md FloatingButton ownership table, GEN-FLOATING-BUTTON-LIFECYCLE)'
        );
      }
    }
  }

  // ─── GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN ──────────────────────────
  // Standalone games (Shape 1, `totalRounds: 1`) have a single question, a
  // single submit, and a single end state. There is nothing to "transition
  // between" — TransitionScreen is architecturally redundant. The round's
  // inline feedback panel (rendered in #gameContent with worked-example,
  // stars, message) is the end-of-game display. After feedback completes,
  // FloatingButton `setMode('next')` reveals Next directly — no card to
  // tap-dismiss first.
  //
  // Banning TransitionScreen in standalone also sidesteps the whole class of
  // "double-Next" / "TS with Next button" regressions (GEN-FLOATING-BUTTON-
  // TS-CTA-FORBIDDEN).
  //
  // Scope: fires only when FloatingButton is in use AND totalRounds === 1 AND
  // source references TransitionScreen (`new TransitionScreenComponent(` OR
  // `transitionScreen.show(`). Auto-skips for games in the allowlist.
  const isStandalone = specContext.totalRounds === 1;
  const usesTransitionScreen =
    /\bnew\s+TransitionScreenComponent\s*\(/.test(html) ||
    /\btransitionScreen\s*\.\s*show\s*\(/.test(html);
  if (isStandalone && usesTransitionScreen) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN]: Spec declares totalRounds=1 (Shape 1 Standalone) ' +
        'AND FloatingButton is used, but the source references TransitionScreen (either `new TransitionScreenComponent(` ' +
        'or `transitionScreen.show(`). Standalone games have a single round — there is nothing to transition between. ' +
        'The inline feedback panel rendered in #gameContent (worked-example, stars, message) is the canonical ' +
        'end-of-game display for Shape 1. ' +
        'CORRECT STANDALONE FLOW (PART-050 "Next flow — standalone variant"): ' +
        '(1) await FeedbackManager.play(correct ? "correct" : "incorrect") — awaited audio + sticker sequence ' +
        '(2) render inline feedback in #gameContent (worked-example, result, stars if correct) ' +
        '(3) window.parent.postMessage({ type: "game_complete", data: { metrics: ... } }, "*") ' +
        '(4) floatingBtn.setMode("next") — Next appears directly, no TransitionScreen ' +
        '(5) floatingBtn.on("next", () => { postMessage({type:"next_ended"}); floatingBtn.destroy(); }); ' +
        'REMOVE: `new TransitionScreenComponent(...)`, any `transitionScreen.show(...)` call, and the ' +
        '`transitionScreen: true` slot entry from `ScreenLayout.inject()`. Also drop `transitionScreen.onDismiss(...)` ' +
        'and `transitionScreen.hide()` — they are dead code once show() is removed. ' +
        'Multi-round games (totalRounds > 1) are UNAFFECTED by this rule — they continue to use TransitionScreen ' +
        'for round intros and victory / game_over screens (with buttons: [] per the TS-CTA-FORBIDDEN rule). ' +
        '(PART-050 "Next flow — standalone variant", GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN)'
    );
  }

  // ─── GEN-ENDGAME-AFTER-TTS ────────────────────────────────────────────────
  // endGame() is the SINGLE orchestrator owning all 5 beats — TTS must be
  // awaited inside endGame() before show_star + Next. Splitting the beats
  // across runFeedbackSequence / finalizeAfterDwell / inner-endGame() causes
  // game_complete + Next to fire after only SFX while TTS is still playing
  // (bodmas-blitz regression).
  //
  // Heuristic: if the file uses playDynamicFeedback AND defines an endGame
  // function, look for an `await ... playDynamicFeedback` somewhere AFTER the
  // last `endGame(` call site OR detect a SYNC `endGame(` call inside an
  // async function that subsequently awaits TTS.
  //
  // Conservative pattern: search for `endGame(` followed within ~200 chars
  // by `await ... playDynamicFeedback`. That's the broken shape — endGame
  // returned (or was scheduled SYNC) BEFORE TTS finishes.
  // Scope: STANDALONE games only. In multi-round games (`totalRounds > 1`),
  // round-N feedback is legitimately fire-and-forget like every other round
  // — Stars Collected `onMounted` owns end-of-game audio. The split-helper
  // antipattern (runFeedbackSequence / finalizeAfterDwell) is only a bug
  // when there's no Stars Collected to serialize audio → animation → Next,
  // which is the standalone shape.
  if (isStandalone && /playDynamicFeedback\b/.test(html)) {
    // The presence of a `function finalizeAfterDwell` or `function
    // runFeedbackSequence` definition is itself the split-orchestrator
    // antipattern in standalone games — TTS is always fire-and-forget
    // after endGame in that shape, so show_star + Next overlap with audio.
    const splitDefRe = /\bfunction\s+(?:finalizeAfterDwell|runFeedbackSequence)\b/;
    const splitMatch = splitDefRe.exec(html);
    if (splitMatch) {
      const offset = splitMatch.index;
      const lineNumber = html.slice(0, offset).split('\n').length;
      const m = { index: offset };
      errors.push(
        'ERROR [GEN-ENDGAME-AFTER-TTS]: `endGame(...)` is called BEFORE `await ... playDynamicFeedback(...)` — ' +
          'TTS plays AFTER endGame() has already posted game_complete and (likely) revealed Next. ' +
          'Call site near line ' + lineNumber + '. ' +
          'Fix: `endGame()` is the SINGLE orchestrator owning all 5 beats. The submit handler is one line — ' +
          '`await endGame(correct);`. Move the entire feedback sequence INTO endGame: ' +
          '(1) `await FeedbackManager.sound.play(sfxId, {sticker})` ' +
          '(2) renderInlineFeedbackPanel + postGameComplete (SYNC) ' +
          '(3) `await FeedbackManager.playDynamicFeedback({...})` ' +
          '(4) `window.postMessage({type:"show_star", data:{...}}, "*")` ' +
          '(5) `setTimeout(() => floatingBtn.setMode("next"), 1100)`. ' +
          'Do NOT split into runFeedbackSequence / finalizeAfterDwell / inner-endGame — ' +
          'TTS MUST be awaited inside endGame() before it returns. ' +
          '(PART-050 "Next flow", flow-implementation.md beat sequence, GEN-ENDGAME-AFTER-TTS)'
      );
    }
  }

  // ─── GEN-SHOW-STAR-ONCE ───────────────────────────────────────────────────
  // show_star is the end-of-game flying-star celebration — a single-shot beat,
  // not a per-round effect. Firing it on every correct answer plays N stacked
  // animations in a multi-round game and spams the player. Per-round score
  // bumps belong in `previewScreen.setScore(...)` (direct, no animation).
  const showStarRe = /type\s*:\s*['"]show_star['"]/g;
  const showStarMatches = html.match(showStarRe) || [];
  if (showStarMatches.length > 1) {
    const offsets = [];
    let m;
    showStarRe.lastIndex = 0;
    while ((m = showStarRe.exec(html)) !== null) offsets.push(m.index);
    const lineNumbers = offsets
      .slice(0, 5)
      .map((off) => html.slice(0, off).split('\n').length)
      .join(', ');
    errors.push(
      'ERROR [GEN-SHOW-STAR-ONCE]: `show_star` postMessage found ' + showStarMatches.length + ' times — ' +
        'it must fire EXACTLY ONCE per game session, at the end-of-game celebration beat, not on every correct answer. ' +
        'Call sites near lines: ' + lineNumbers + '. ' +
        'Per-round score bumps MUST use `previewScreen.setScore(gameState.score + "/" + gameState.totalRounds)` — ' +
        'direct method, no animation. Reserve the show_star flying-star animation for the ONE end-of-game beat ' +
        '(standalone: inside endGame, after all feedback audio; multi-round: inside the victory / stars-collected ' +
        'TransitionScreen\'s onMounted or onDismiss, after celebration audio). ' +
        '(PART-040 "show_star payload contract", code-patterns.md "ActionBar header refresh", GEN-SHOW-STAR-ONCE)'
    );
  }

  // ─── GEN-HEADER-REFRESH ───────────────────────────────────────────────────
  // PART-040 v1.2.0 makes the ActionBar header state-driven: #previewScore and
  // #previewQuestionLabel only update when the game tells them to. Without
  // these calls the header stays on its boot value forever (e.g. "0/3") even
  // after the student answers correctly, and the star-award animation's
  // landing-tier swap is the only visible change.
  //
  // Heuristic: if PreviewScreenComponent is in use AND FloatingButton is in
  // use (i.e. real gameplay, not a demo shell), require at least one of:
  //   - `previewScreen.setScore(` somewhere in source (direct method path)
  //   - A show_star postMessage whose data object contains `score:` (the
  //     animation-end atomic path introduced with PART-040 v1.2.0's score
  //     payload extension)
  // Either is sufficient. Games that use both are fine.
  const usesPreviewScreen = /new\s+PreviewScreenComponent\b|previewScreen\s*=/.test(html);
  const usesFloatingBtn = /new\s+FloatingButtonComponent\b/.test(html);
  if (usesPreviewScreen && usesFloatingBtn) {
    const callsSetScore = /previewScreen\s*\.\s*setScore\s*\(/.test(html);
    const showStarHasScore = /type\s*:\s*['"]show_star['"][\s\S]{0,400}\bscore\s*:/.test(html);
    if (!callsSetScore && !showStarHasScore) {
      errors.push(
        'ERROR [GEN-HEADER-REFRESH]: ActionBar header score never updates. ' +
          'The header `#previewScore` is state-driven (PART-040 v1.2.0+) — without a ' +
          '`previewScreen.setScore(...)` call OR a `score:` field inside the show_star ' +
          'postMessage payload, the score stays on its boot value forever even when the ' +
          'student answers correctly. ' +
          'Fix (pick ONE): ' +
          '(A) Inside the correct-answer path, fire ' +
          '`window.postMessage({type:"show_star", data:{count, variant:"yellow", ' +
          'score: gameState.score + "/" + gameState.totalRounds}}, "*")` — the score ' +
          'is applied AFTER the 1s animation finishes, so the celebration precedes the ' +
          'number change. OR ' +
          '(B) Call `previewScreen.setScore(gameState.score + "/" + gameState.totalRounds)` ' +
          'directly in the correct-answer handler (updates immediately). ' +
          'Also seed the initial header state once from startGameAfterPreview(): ' +
          '`previewScreen.setQuestionLabel("Q1"); previewScreen.setScore("0/" + gameState.totalRounds);`. ' +
          'DO NOT re-post game_init from game code — the game\'s own handlePostMessage ' +
          'would re-run setupGame() with fallback content. ' +
          '(PART-040 "Updating header state from game code", GEN-HEADER-REFRESH)'
      );
    }
  }

  // ─── GEN-ROUND-BOUNDARY-STOP ──────────────────────────────────────────────
  // Multi-round games fire-and-forget `playDynamicFeedback` in the submit
  // handler so next-round transition isn't blocked on TTS. But the TTS keeps
  // streaming — if `showRoundIntro(N+1)` runs without first calling
  // `FeedbackManager.sound.stopAll()` + `stream.stopAll()`, the previous
  // round's subtitle/audio plays on top of the new round's `sound_round_n`
  // and bleeds into N+1 gameplay (equivalent-ratios regression).
  //
  // Heuristic: multi-round (totalRounds > 1) AND defines `showRoundIntro` AND
  // calls `playDynamicFeedback` AND the showRoundIntro body does NOT contain
  // a sound.stopAll() or stream.stopAll() in its first ~600 chars.
  if (
    !isStandalone &&
    specContext.totalRounds > 1 &&
    /\bplayDynamicFeedback\b/.test(html) &&
    /function\s+showRoundIntro\s*\(|showRoundIntro\s*=\s*(?:async\s*)?function|async\s+function\s+showRoundIntro\s*\(/.test(html)
  ) {
    const introMatch = html.match(/(?:async\s+)?function\s+showRoundIntro\s*\([^)]*\)\s*\{([\s\S]{0,800})/);
    const introBody = introMatch ? introMatch[1] : '';
    const stopsAudio = /FeedbackManager\.(?:sound|stream)\.stopAll\s*\(/.test(introBody);
    if (!stopsAudio) {
      errors.push(
        'ERROR [GEN-ROUND-BOUNDARY-STOP]: Multi-round game (totalRounds=' +
          specContext.totalRounds + ') uses fire-and-forget `playDynamicFeedback` mid-round but ' +
          '`showRoundIntro(n)` does not stop in-flight audio at entry. The previous round\'s TTS ' +
          'keeps streaming and bleeds into the new round\'s `sound_round_n` and gameplay ' +
          '(equivalent-ratios regression). ' +
          'Fix: add as the FIRST lines of showRoundIntro(n), before the new round\'s ' +
          '`transitionScreen.show()` / `sound_round_n` play call: ' +
          '`try { FeedbackManager.sound.stopAll(); } catch (e) {} ' +
          'try { FeedbackManager.stream.stopAll(); } catch (e) {} ' +
          'try { FeedbackManager._stopCurrentDynamic && FeedbackManager._stopCurrentDynamic(); } catch (e) {}`. ' +
          '(feedback/reference/timing-and-blocking.md "Stop Triggers" — showRoundIntro entry row, ' +
          'flow-implementation.md "Round-boundary audio cleanup", GEN-ROUND-BOUNDARY-STOP)'
      );
    }
  }

  // ─── GEN-FEEDBACK-TTS-AWAIT ───────────────────────────────────────────────
  // FeedbackManager.playDynamicFeedback(...) MUST be awaited in submit handlers
  // and at round-complete. Without await, the TTS streams in 200–800 ms after
  // the call returns, by which time `showRoundIntro(N+1)` has painted — the
  // subtitle/audio bleed into the next round (equivalent-ratios regression).
  //
  // Carve-outs (legitimate fire-and-forget):
  //   - showRoundIntro / roundStart contexts (round-start TTS)
  //   - chainProgress / partialMatch contexts (chain games)
  //   - onMounted callbacks (transition screens — they own their own audio sequencing)
  //   - startGame / restartGame
  //
  // Heuristic: scan each `playDynamicFeedback(` call. Walk back to find whether
  // it is preceded by `await` (with optional whitespace + try block boundary).
  // If not awaited AND the enclosing-function-name signal is a submit/finish-
  // round/round-complete site, error.
  {
    const pdfRegex = /\bFeedbackManager\s*\.\s*playDynamicFeedback\s*\(/g;
    const offending = [];
    let pdfMatch;
    while ((pdfMatch = pdfRegex.exec(html)) !== null) {
      const callIdx = pdfMatch.index;
      // Look at up to 60 chars before the call for an `await` keyword.
      const back = html.slice(Math.max(0, callIdx - 60), callIdx);
      const isAwaited = /\bawait\s*$/.test(back) || /\bawait\s+\(?\s*$/.test(back);
      if (isAwaited) continue;
      // Find the nearest enclosing `function NAME(` walking backwards from the call.
      // We grab up to 4000 chars of preceding context and find the LAST function
      // declaration in that window.
      const ctx = html.slice(Math.max(0, callIdx - 4000), callIdx);
      const fnNames = [...ctx.matchAll(/\bfunction\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map(
        (m) => m[1]
      );
      const enclosingFn = fnNames.length ? fnNames[fnNames.length - 1] : '';
      const lower = enclosingFn.toLowerCase();
      // Carve-outs: round-start, chain-progress, transition onMounted helpers,
      // startGame/restartGame, showRoundIntro itself, anything that looks like
      // a transition / mount callback.
      const carveOuts = [
        'showroundintro',
        'showleveltransition',
        'showlevelintro',
        'showwelcome',
        'showmotivation',
        'showvictory',
        'showgameover',
        'roundstart',
        'chainprogress',
        'partialmatch',
        'onmounted',
        'startgame',
        'restartgame',
        'setupgame',
        'rendertransition'
      ];
      if (carveOuts.some((name) => lower.includes(name))) continue;
      // Submit-handler / finish-round signals — names that strongly indicate
      // an evaluation context.
      const submitSignals = [
        'submit',
        'evaluate',
        'finishround',
        'handleanswer',
        'handlesubmit',
        'oncorrect',
        'onwrong',
        'onincorrect',
        'checkanswer',
        'process',
        'answer',
        'roundcomplete',
        'completeround'
      ];
      const looksLikeSubmit = submitSignals.some((sig) => lower.includes(sig));
      // If we couldn't identify the enclosing function, also flag if the broad
      // context contains submit-handler markers in the same scope.
      const ctxLower = ctx.toLowerCase();
      const ctxSignals =
        /\bfloatingbtn\s*\.\s*on\s*\(\s*['"]submit['"]/.test(ctxLower) ||
        /\brecordattempt\s*\(\s*\{[\s\S]{0,200}?\bcorrect\s*:/.test(ctxLower);
      if (!looksLikeSubmit && !ctxSignals) continue;
      offending.push({
        line: html.slice(0, callIdx).split('\n').length,
        fn: enclosingFn || '(unknown enclosing function)'
      });
    }
    if (offending.length > 0) {
      const lineList = offending
        .slice(0, 5)
        .map((o) => 'line ' + o.line + ' in ' + o.fn)
        .join('; ');
      errors.push(
        'ERROR [GEN-FEEDBACK-TTS-AWAIT]: `FeedbackManager.playDynamicFeedback(...)` is not awaited at ' +
          offending.length + ' submit-handler / finish-round / round-complete site' +
          (offending.length === 1 ? '' : 's') + ' (' + lineList + '). ' +
          'Without `await`, the TTS streams in 200–800 ms after the call returns — by which time the next ' +
          'round\'s transition has already painted, and the explanation\'s subtitle/audio bleeds into the ' +
          'next round (equivalent-ratios regression). ' +
          'Fix: wrap each call in `try { await FeedbackManager.playDynamicFeedback({...}); } catch(e) {}`. ' +
          'The package already bounds resolution at 3 s (TTS API timeout) and 60 s (streaming), so awaiting ' +
          'can never freeze the game indefinitely; the `try/catch` swallows rejection so a network failure ' +
          'still advances. ' +
          'Carve-outs that may stay fire-and-forget: round-start TTS (inside `showRoundIntro` / `onMounted`), ' +
          'chain-progress / partial-match audio. ' +
          '(feedback/SKILL.md "Default Feedback by Game Type", timing-and-blocking.md submit-handler pattern, ' +
          'code-patterns.md "Dynamic VO", GEN-FEEDBACK-TTS-AWAIT)'
      );
    }
  }

  // ─── GEN-FLOATING-BUTTON-RETRY-STANDALONE ─────────────────────────────────
  // When the spec declares `totalRounds: 1` AND `totalLives > 1`, the game MUST
  // wire on('retry', ...) for the Try Again flow. Multi-round games use
  // TransitionScreen retry buttons — they are NOT affected by this rule.
  // (isStandalone declared above)
  const hasExtraLives = typeof specContext.totalLives === 'number' && specContext.totalLives > 1;
  const registersOnRetry = /\.on\s*\(\s*['"]retry['"]/.test(html);
  if (isStandalone && hasExtraLives && !registersOnRetry) {
    errors.push(
      'ERROR [GEN-FLOATING-BUTTON-RETRY-STANDALONE]: Spec declares totalRounds=1 AND totalLives=' +
        specContext.totalLives + ' (standalone game with spare lives) AND FloatingButton is used, but the Try Again ' +
        'flow is NOT wired — no floatingBtn.on(\'retry\', ...) handler is registered. Per PART-050 "Try Again flow", ' +
        'standalone games with more than one life MUST show Try Again after a wrong submit so the player can use ' +
        'their remaining lives. Canonical wiring inside the submit handler\'s wrong-answer branch: ' +
        'gameState.lives -= 1; recordAttempt({ correct: false, is_retry: ... }); await feedback; ' +
        'if (gameState.lives > 0) { clear/keep input per retryPreservesInput; gameState.isProcessing = false; floatingBtn.setMode(\'retry\'); } ' +
        'else { endGame(false); } — and separately: floatingBtn.on(\'retry\', function () { floatingBtn.setMode(null); }); ' +
        'Multi-round games use TransitionScreen retry buttons instead (out of scope for this rule). ' +
        '(PART-050 "Try Again flow", GEN-FLOATING-BUTTON-RETRY-STANDALONE)'
    );
  }

  // ─── GEN-FLOATING-BUTTON-RETRY-LIVES-RESET ────────────────────────────────
  // When on('retry', ...) IS registered, its handler body MUST NOT reset
  // gameState.lives. The whole point of Try Again is to USE the already-
  // decremented lives value. A reset defeats the lives mechanic silently.
  if (registersOnRetry) {
    const onRetryStart = html.search(/\.on\s*\(\s*['"]retry['"]/);
    let handlerBody = '';
    if (onRetryStart >= 0) {
      const after = html.slice(onRetryStart);
      const bodyOpen = after.search(/=>\s*[\{(]|function\s*\([^)]*\)\s*\{/);
      if (bodyOpen >= 0) {
        const start = onRetryStart + bodyOpen;
        const tail = html.slice(start);
        if (/^=>\s*\(/.test(tail) || /^=>\s*[a-zA-Z_$]/.test(tail)) {
          let depth = 0; let i = 0; let started = false;
          for (; i < tail.length; i++) {
            const c = tail[i];
            if (c === '(') { depth++; started = true; }
            else if (c === ')') { depth--; if (started && depth <= 0) break; }
          }
          handlerBody = tail.slice(0, i);
        } else {
          const braceStart = tail.indexOf('{');
          if (braceStart >= 0) {
            let depth = 0; let i = braceStart;
            for (; i < tail.length; i++) {
              const c = tail[i];
              if (c === '{') depth++;
              else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
            }
            handlerBody = tail.slice(braceStart, i);
          }
        }
      }
    }
    // Patterns that reset lives inside the retry handler:
    //   gameState.lives = gameState.totalLives
    //   gameState.lives = <numeric literal>
    //   gameState.lives = window.gameState.totalLives
    // Do NOT flag `gameState.lives -= 1` (decrement) or `.lives +=` (defensive).
    const resetPattern = /\bgameState\.lives\s*=\s*(?:(?:window\.)?gameState\.totalLives\b|\d+)/;
    if (resetPattern.test(handlerBody)) {
      errors.push(
        'ERROR [GEN-FLOATING-BUTTON-RETRY-LIVES-RESET]: floatingBtn.on(\'retry\', ...) handler body contains ' +
          'a lives reset (e.g. `gameState.lives = gameState.totalLives` or `gameState.lives = <literal>`). ' +
          'Per PART-050 "Try Again flow", the retry handler MUST PRESERVE the already-decremented lives state. ' +
          'Resetting lives inside the retry handler defeats the entire lives mechanic — the player gets infinite ' +
          'attempts. Remove the lives assignment. The retry handler should only: (1) call floatingBtn.setMode(null) ' +
          'so the submittable predicate takes over again, (2) optionally focus the input if retryPreservesInput is false. ' +
          'Lives decrement happens ONCE in the wrong-answer branch of the submit handler — NOT in the retry handler. ' +
          '(PART-050 "Try Again flow", GEN-FLOATING-BUTTON-RETRY-LIVES-RESET)'
      );
    }
  }
})();

// ─── 5e1-TS-BTN-ONCLICK-FORBIDDEN. TransitionScreen button uses `onClick` ────
// CDN TransitionScreenComponent reads `btn.action()` (not `btn.onClick`). A
// button with `onClick: ...` is a silent no-op — the click handler never fires
// and the transition screen stays visible forever. Symptom: user taps the CTA
// ("I'm ready", "Let's go", "Play Again", "Next") and NOTHING happens; game
// stalls at welcome / victory / game-over phase. Match-up-equivalent-ratios
// 2026-04-17 root cause (5 call sites all used `onClick`).
(function checkTransitionScreenButtonOnClick() {
  // Only check if the file uses transitionScreen at all.
  if (!/transitionScreen\b/.test(html)) return;
  // A TransitionScreen button object literal has the shape:
  //   { text: '...', type?: '...', onClick: function(){...} }
  // Use a proximity check: any `onClick:` within 300 chars AFTER a `text:` key
  // is almost certainly a TransitionScreen button object. This survives nested
  // braces in the handler body (try/catch blocks) that break naive {...} regex.
  const onClickRe = /\bonClick\s*:/g;
  const violations = [];
  let m;
  while ((m = onClickRe.exec(html)) !== null) {
    const start = Math.max(0, m.index - 300);
    const preceding = html.slice(start, m.index);
    if (/\btext\s*:/.test(preceding)) {
      violations.push(m.index);
      if (violations.length >= 3) break;
    }
  }
  if (violations.length > 0) {
    errors.push(
      'ERROR (5e1-TS-BTN-ONCLICK-FORBIDDEN): TransitionScreen button uses `onClick` — a silent no-op. ' +
        'The CDN TransitionScreenComponent (warehouse/packages/components/transition-screen/index.js line 305) ' +
        'invokes `btn.action()` on click; any other key name is never called. Symptom: user taps the CTA ' +
        '("I\'m ready", "Let\'s go", "Play Again", "Next") and NOTHING happens — the transition screen stays ' +
        'visible and the game stalls. Rename `onClick` to `action` in every buttons: [{...}] entry. ' +
        `Violations at HTML offset(s): ${violations.join(', ')}. ` +
        'WRONG: buttons: [{ text: "I\'m ready", onClick: function() { startGame(); } }]. ' +
        'RIGHT: buttons: [{ text: "I\'m ready", type: "primary", action: function() { startGame(); } }].'
    );
  }
})();

// ─── 5e2-TS-PERSIST-FALLTHROUGH. Game-flow call after await transitionScreen.show()
// CDN TransitionScreenComponent.show() promise resolves immediately (next rAF after
// onMounted), NOT on button tap. Any game-flow continuation (showRoundIntro, renderRound,
// startGame, restartGame, nextRound, showMotivation, showWelcome, showLevelTransition)
// after `await transitionScreen.show(...)` when buttons are present runs before the
// student taps — the transition screen flashes for one frame then gets replaced.
// Continuation must go inside the button `action` callback.
// Source incident: scale-it-up-ratios 2026-04-17.
(function checkTransitionScreenPersistFallthrough() {
  if (!/transitionScreen\.show\s*\(/.test(html)) return;
  // Find every `await transitionScreen.show(...)` and inspect what follows.
  // We look for the closing of the show() call (accounting for nested braces),
  // then check the next ~200 chars for game-flow function calls.
  const showRe = /await\s+transitionScreen\.show\s*\(/g;
  const flowFns = /\b(showRoundIntro|renderRound|startGame|restartGame|nextRound|showMotivation|showWelcome|showLevelTransition|showRound|loadRound)\s*\(/;
  const violations = [];
  let m;
  while ((m = showRe.exec(html)) !== null) {
    // Check if this show() call has buttons in its arguments
    const callBody = html.slice(m.index, Math.min(html.length, m.index + 2000));
    if (!/\bbuttons\s*:/.test(callBody.slice(0, 1500))) continue;
    // Find end of the show() call — scan for balanced parens
    let depth = 0;
    let endIdx = m.index + m[0].length;
    for (let i = endIdx; i < Math.min(html.length, m.index + 3000); i++) {
      if (html[i] === '(') depth++;
      else if (html[i] === ')') {
        if (depth === 0) { endIdx = i + 1; break; }
        depth--;
      }
    }
    // Skip past optional catch/try wrappers and whitespace/semicolons
    const after = html.slice(endIdx, Math.min(html.length, endIdx + 400));
    // Strip leading whitespace, semicolons, } catch(e) {...}, and closing braces/parens
    // of the enclosing function/block. Repeat the closing-brace strip to handle
    // multiple nesting levels (e.g. `}); }` closing both try and the function).
    // A flow call in the NEXT function definition is NOT a continuation — new scope.
    let stripped = after
      .replace(/^\s*;?\s*\}\s*catch\s*\([^)]*\)\s*\{[^}]*\}\s*/g, '');  // catch block
    // Repeatedly strip closing braces/parens + whitespace
    let prev = '';
    while (stripped !== prev) {
      prev = stripped;
      stripped = stripped.replace(/^\s*[;)}\]]\s*/, '');
    }
    stripped = stripped.trim();
    // Only flag if the flow call appears as a STATEMENT (not a function declaration).
    // A function declaration like `async function showRoundIntro(` is NOT a continuation.
    if (/^(async\s+)?function\s/.test(stripped)) continue;
    if (flowFns.test(stripped.slice(0, 200))) {
      violations.push(m.index);
      if (violations.length >= 3) break;
    }
  }
  if (violations.length > 0) {
    errors.push(
      'ERROR (5e2-TS-PERSIST-FALLTHROUGH): Game-flow function call found after ' +
        '`await transitionScreen.show(...)` with buttons — the show() promise resolves immediately, ' +
        'so this code runs before the student taps the button. The transition screen flashes for one ' +
        'frame then gets replaced. Move game-flow continuation (showRoundIntro, renderRound, startGame, ' +
        'restartGame, nextRound, etc.) inside the button `action` callback. ' +
        'See PART-024 "show() Promise Resolves IMMEDIATELY" and GEN-TS-PERSIST-FALLTHROUGH. ' +
        `Violations at HTML offset(s): ${violations.join(', ')}.`
    );
  }
})();

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

// ─── PART-028: CSS stylesheet integrity check ────────────────────────────────
// Targeted fix LLMs sometimes strip the entire <style> block and replace it with
// a comment-only placeholder (e.g. /* CSS preserved */). Tests and the reviewer
// cannot detect this because the page renders with browser defaults — no JS errors.
// This check catches it deterministically before any test run.
const styleBlocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
for (const block of styleBlocks) {
  const content = block.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '');
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (stripped.length === 0) {
    errors.push(
      'ERROR [PART-028-CSS-STRIPPED]: CSS stylesheet block exists but contains only comments — entire stylesheet was stripped. ' +
      'This is always a bug in targeted fixes. WRONG: replacing <style> with /* CSS preserved */. RIGHT: leave <style>...</style> unchanged.',
    );
  }
}
if (styleBlocks.length === 0) {
  warnings.push(
    'WARNING [PART-028-NO-CSS]: No <style> block found — game has no custom CSS. Likely missing layout and button styling.',
  );
}

// ─── W7. GEN-CSS-TOKENS: banned CSS custom property tokens in feedback styles ──
// GEN-CSS-TOKENS (commit 8221ae2) bans --mathai-green, --color-red, --color-orange,
// --color-green, --color-success, --feedback-color, --answer-color, and --status-green
// in generated HTML feedback styles.
// Use --mathai-success, --mathai-error, or --mathai-warning instead.
// This is a WARNING (not error) — GEN-CSS-TOKENS is a quality rule, not a hard blocker.
// Catching banned tokens at T1 prevents 5+ wasted fix-loop iterations.
{
  const bannedTokenPatterns = [
    /--mathai-green/,
    /--color-red/,
    /--color-orange/,
    /--color-green/,
    /--color-success/,
    /--feedback-color/,
    /--answer-color/,
    /--status-green/,
  ];
  for (const pattern of bannedTokenPatterns) {
    if (pattern.test(html)) {
      warnings.push(
        `WARNING [GEN-CSS-TOKENS]: banned CSS custom property used: var(${pattern.source}) — ` +
        'this token does not exist in the CDN design system. Use CDN-approved colors or hardcoded hex values.',
      );
    }
  }
}

// ─── W5. ARIA-001: feedback elements missing aria-live ───────────────────────
// WCAG SC 4.1.3 (Status Messages) requires dynamic feedback regions to have
// aria-live so screen readers announce changes without focus movement.
// Detect div elements whose id/class suggests feedback content and check
// whether they carry aria-live. This is a WARNING (not error) — false positives
// are possible when feedback is injected entirely by JS without a static div.
// Covers confirmed audit variants: 'feedback' (9 instances), compound '-feedback'
// variants (#answer-feedback, #result-feedback), and hint-text panels.
// Does NOT match bare 'answers', 'results', or 'score' container divs.
{
  // Match any div whose id or class:
  //   (a) contains 'feedback' anywhere — the primary signal (9 audit instances)
  //   (b) ends with '-feedback' or '_feedback' — compound answer/result/practice variants
  //   (c) is exactly 'hint-text' or contains 'hint-text' — hint panel variant
  // Regex alternation order: most-specific patterns before the broad 'feedback' catch-all.
  const feedbackDivRe =
    /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:(?:answer|result|practice|faded|phase)-feedback|hint-text|feedback)[^"']*["'][^>]*>/gi;
  const feedbackDivs = html.match(feedbackDivRe) || [];
  const withoutAriaLive = feedbackDivs.filter((el) => !el.includes('aria-live'));
  if (withoutAriaLive.length > 0) {
    warnings.push(
      `WARNING [ARIA-001]: ${withoutAriaLive.length} dynamic feedback div(s) found without aria-live attribute — ` +
      'WCAG SC 4.1.3 requires dynamic feedback regions to have aria-live="polite" and role="status". ' +
      'Applies to ANY element whose text changes in response to user interaction, regardless of id/class name. ' +
      'Confirmed variants: #feedback-panel, #faded-feedback, #practice-feedback, #feedback-area, ' +
      '#answer-feedback, #result-feedback, #feedback, .feedback-message, #correct-feedback, #incorrect-feedback, #hint-text. ' +
      `Missing on: ${withoutAriaLive.slice(0, 3).map((el) => el.slice(0, 80)).join(' | ')}`,
    );
  }
}

// ─── W6. ARIA-002: aria-live="assertive" without role="alert" ────────────────
// WCAG 4.1.3 + ARIA spec: aria-live="assertive" interrupts the screen reader
// immediately. The ARIA spec pairs assertive live regions with role="alert" to
// signal urgency. Using assertive without role="alert" is technically incorrect
// and should always be replaced with aria-live="polite" unless it is a genuine
// error alert requiring role="alert".
{
  const assertiveLiveRe = /<[^>]+aria-live\s*=\s*["']assertive["'][^>]*>/gi;
  const assertiveEls = html.match(assertiveLiveRe) || [];
  const assertiveWithoutAlert = assertiveEls.filter((el) => !el.includes('role="alert"') && !el.includes("role='alert'"));
  if (assertiveWithoutAlert.length > 0) {
    warnings.push(
      `WARNING [ARIA-002]: ${assertiveWithoutAlert.length} element(s) use aria-live="assertive" without role="alert" — ` +
      'assertive interrupts screen reader immediately; WCAG requires role="alert" to accompany aria-live="assertive". ' +
      'Use aria-live="polite" for standard feedback. Only use assertive for genuine error alerts that require immediate attention.',
    );
  }
}

// ─── GEN-LOCAL-ASSETS (ERROR) ────────────────────────────────────────────────
// GEN-LOCAL-ASSETS (rule 49): local asset paths will 404 in production.
// CDN deployment only serves from storage.googleapis.com — relative paths like
// assets/, images/, ../, src/ are never present at runtime → broken images P0.
// Exempt: https:// URLs, data: URIs, and inline <svg elements.
{
  // src= and href= attribute patterns (catch assets/, images/, ../, src/ prefixes)
  const localSrcPattern = /src\s*=\s*["'](?!https?:\/\/)(?!data:)(?:assets|images|\.\.\/|src\/)/.test(html);
  // CSS url() patterns
  const localUrlPattern = /url\s*\(\s*['"]?(?!https?:\/\/)(?!data:)(?:assets|images|\.\.\/)/.test(html);
  // icons array with local path (e.g. icons: ['assets/icon.png'])
  const localIconsPattern = /icons\s*:\s*\[['"](?!https?:\/\/)(?!data:)(?:assets|images|\.\.\/)/.test(html);

  if (localSrcPattern || localUrlPattern || localIconsPattern) {
    errors.push(
      'ERROR [GEN-LOCAL-ASSETS]: local asset path will 404 in production — use CDN URL, emoji, or inline SVG. ' +
        'CDN deployment only serves files from storage.googleapis.com; relative paths (assets/, images/, ../, src/) ' +
        'are never present at runtime → broken images. ' +
        'WRONG: src="assets/icon.svg", url("images/bg.png"), icons: [\'assets/img.png\']. ' +
        'RIGHT: src="https://storage.googleapis.com/...", inline <svg>, or emoji string. (GEN-LOCAL-ASSETS, rule 49)'
    );
  }
}

// ─── W13. GEN-RESTART-RESET: restartGame() must reset required gameState fields ──
// Rule 42: restartGame() MUST reset ALL mutable gameState fields.
// Confirmed missing-reset instances: quadratic-formula #546, find-triangle-side #549, associations #472.
// Required fields: currentRound, score, lives (or totalLives), events, attempts.
// Only warn if restartGame IS defined — skip for games that don't have it.
{
  const hasRestartGame = /function\s+restartGame\s*\(|(?:const|let|var)\s+restartGame\s*=/.test(html);
  if (hasRestartGame) {
    // Extract the restartGame() function body
    const restartFnMatch = html.match(
      /(?:function\s+restartGame\s*\([^)]*\)|(?:const|let|var)\s+restartGame\s*=\s*(?:async\s+)?function\s*\([^)]*\)|(?:const|let|var)\s+restartGame\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)\s*\{([\s\S]*?)(?=\n\s*(?:function\s+\w|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?function|\}\s*\n\s*(?:function|const|let|var|\/\/\s*─|window\s*\.|\/\*)))/
    );
    if (restartFnMatch) {
      const restartBody = restartFnMatch[1];
      const missingFields = [];
      // Check for currentRound reset (= 0 or = some value)
      if (!/gameState\s*\.\s*currentRound\s*=/.test(restartBody)) {
        missingFields.push('currentRound');
      }
      // Check for score reset
      if (!/gameState\s*\.\s*score\s*=/.test(restartBody)) {
        missingFields.push('score');
      }
      // Check for lives reset (lives or totalLives reference)
      if (!/gameState\s*\.\s*lives\s*=/.test(restartBody)) {
        missingFields.push('lives');
      }
      // Check for events reset (= [] or similar)
      if (!/gameState\s*\.\s*events\s*=/.test(restartBody)) {
        missingFields.push('events');
      }
      // Check for attempts reset (= [] or similar)
      if (!/gameState\s*\.\s*attempts\s*=/.test(restartBody)) {
        missingFields.push('attempts');
      }
      if (missingFields.length > 0) {
        warnings.push(
          `WARNING [GEN-RESTART-RESET]: restartGame() missing state reset for: ${missingFields.join(', ')} — ` +
            'GEN rule 42 requires resetting ALL mutable gameState fields. ' +
            'WRONG: function restartGame() { gameState.gameEnded = false; gameState.phase = "start"; syncDOMState(); showStartScreen(); } ' +
            'RIGHT: function restartGame() { gameState.currentRound = 0; gameState.lives = gameState.totalLives; gameState.score = 0; gameState.events = []; gameState.attempts = []; gameState.gameEnded = false; gameState.phase = "start"; syncDOMState(); showStartScreen(); } ' +
            'Confirmed 3 browser instances: quadratic-formula #546 (data-lives="2" at second game start), find-triangle-side #549, associations #472. (CR-032)'
        );
      }
    }
  }
}

// ─── W14b. GEN-TESTID-RESTART: restart button must use data-testid="btn-restart" ─
// UI/UX audit one-digit-doubles #487 found data-testid="restart-btn" — the test
// harness clicks '[data-testid="btn-restart"]' so any other name fails silently.
// WARNING (not error): regex may miss dynamically-added buttons, but catches the
// most common typos produced by the generator.
{
  const hasWrongRestartTestid = /data-testid=["'](restart-btn|replay-btn|play-again-btn|restart_btn)["']/i.test(html);
  if (hasWrongRestartTestid) {
    warnings.push(
      'WARNING [GEN-TESTID-RESTART]: restart button uses non-standard data-testid. ' +
        'Must be data-testid="btn-restart". ' +
        'WRONG: data-testid="restart-btn" / "replay-btn" / "play-again-btn". ' +
        'The test harness clicks document.querySelector(\'[data-testid="btn-restart"]\') — ' +
        'any other value causes the click to fail silently. (UI/UX audit one-digit-doubles #487)'
    );
  }
}

// ─── GEN-SVG-CONTRAST (WARNING) ──────────────────────────────────────────────
// GEN-SVG-CONTRAST (rule 48): low-contrast SVG stroke/fill colors fail WCAG AA
// at typical icon sizes. Confirmed failing hex values at small icon sizes:
//   #64748b (slate-500), #94a3b8 (slate-400), #6b7280 (gray-500),
//   #cbd5e1 (slate-300), #9ca3af (gray-400).
// Use #374151 (gray-700) or #1f2937 (gray-800) or currentColor instead.
{
  const lowContrastColors = /stroke\s*=\s*["']#(?:64748b|94a3b8|6b7280|cbd5e1|9ca3af)["']/i.test(html) ||
    /fill\s*=\s*["']#(?:64748b|94a3b8|6b7280|cbd5e1|9ca3af)["']/i.test(html);
  if (lowContrastColors) {
    warnings.push(
      'WARNING [GEN-SVG-CONTRAST]: SVG stroke/fill color fails WCAG AA at small sizes — ' +
        'use #374151 or #1f2937 or currentColor. ' +
        'Low-contrast colors confirmed failing: #64748b, #94a3b8, #6b7280, #cbd5e1, #9ca3af. ' +
        'Find-triangle-side #549 confirmed both violations at runtime. (GEN-SVG-CONTRAST, rule 48)'
    );
  }
}

// ─── W14. LP-PROGRESSBAR-CLAMP: progressBar.update() 2nd arg must be clamped ─
// Rule 51: Before calling progressBar.update(currentRound, livesRemaining),
// the lives value MUST be clamped with Math.max(0, gameState.lives).
// Passing a negative lives value causes String.prototype.repeat(negative) →
// RangeError: "Invalid count value: -1" — crashes game on every round after
// lives run out. Accounts for ~50% of LP (level-progression) test failures.
// Pattern to detect: progressBar.update(..., gameState.lives) without Math.max wrapper.
// Only warn — do not hard-error (false positive risk for complex expressions).
{
  const hasProgressBar = /progressBar/.test(html);
  if (hasProgressBar) {
    // Detect progressBar.update(X, gameState.lives) where lives is passed WITHOUT Math.max(0,...)
    // Match the update() call — look for gameState.lives as the second argument directly
    const directLivesPattern =
      /progressBar\s*\.\s*update\s*\(\s*[^)]*,\s*gameState\s*\.\s*lives\s*\)/.test(html);
    // Check if there IS a Math.max(0, ...) wrapper anywhere near progressBar.update calls
    const hasMathMaxClamp = /Math\s*\.\s*max\s*\(\s*0\s*,\s*gameState\s*\.\s*lives\s*\)/.test(html) ||
      /Math\s*\.\s*max\s*\(\s*0\s*,\s*lives\s*\)/.test(html) ||
      /displayLives\s*=\s*Math\s*\.\s*max/.test(html) ||
      /clampedLives\s*=\s*Math\s*\.\s*max/.test(html) ||
      /safeLives\s*=\s*Math\s*\.\s*max/.test(html);
    if (directLivesPattern && !hasMathMaxClamp) {
      warnings.push(
        'WARNING [W14/LP-PROGRESSBAR-CLAMP]: progressBar.update() called with gameState.lives directly — ' +
          'lives can go negative (e.g. -1) when a life is lost while already at 0. ' +
          'String.prototype.repeat(-1) throws RangeError: "Invalid count value: -1" → blank page. ' +
          'Fix: clamp before the call — WRONG: progressBar.update(gameState.currentRound, gameState.lives); ' +
          'RIGHT: const displayLives = Math.max(0, gameState.lives); progressBar.update(gameState.currentRound, displayLives); ' +
          '(LP-PROGRESSBAR-CLAMP rule 51 — ~50% of LP test failures)'
      );
    }
  }
}

// ─── 5e0-PROGRESSBAR-START-ONE: progressBar.update() must start at 0 ─────────
// INVARIANT: the first arg of progressBar.update() is a progression counter
// that MUST start at 0 when the game begins (PART-023, code-patterns.md §
// ProgressBarComponent). The counter may be computed game-specifically
// (rounds completed, correct answers, points, …), but the "<expr> + N"
// shape — typically progressBar.update(gameState.currentRound + 1, ...) —
// is a hard anti-pattern: at game start gameState.currentRound is 0, so
// "currentRound + 1" evaluates to 1 and the bar paints "Round 1/N" before
// round 1 is played. This rule flags any progressBar.update() whose first
// arg ends in "+ <positive-literal>" or is itself a bare positive literal.
// Source: sort-the-shapes build-local-20260417-2026 regression (April 2026).
{
  const hasProgressBar = /progressBar/.test(html);
  if (hasProgressBar) {
    const callRe = /progressBar\s*\.\s*update\s*\(/g;
    const offenders = [];
    let cm;
    while ((cm = callRe.exec(html)) !== null) {
      // Walk forward with balanced paren/brace tracking to extract the first arg.
      let i = cm.index + cm[0].length;
      while (i < html.length && /\s/.test(html[i])) i++;
      const argStart = i;
      let depth = 0;
      while (i < html.length) {
        const c = html[i];
        if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') {
          if (depth === 0) break;
          depth--;
        } else if (c === ',' && depth === 0) break;
        i++;
      }
      const firstArg = html.slice(argStart, i).trim();
      // Anti-pattern A: "<anything> + <positive-literal>" at the end.
      const plusLiteral = /\+\s*(\d+)\s*$/.exec(firstArg);
      // Anti-pattern B: bare positive literal (e.g. update(1, ...)).
      const bareLiteral = /^(\d+)$/.exec(firstArg);
      const plusHit = plusLiteral && parseInt(plusLiteral[1], 10) >= 1;
      const bareHit = bareLiteral && parseInt(bareLiteral[1], 10) >= 1;
      if (plusHit || bareHit) {
        const lineNum = html.slice(0, cm.index).split('\n').length;
        offenders.push({ firstArg, lineNum });
      }
    }
    if (offenders.length > 0) {
      const first = offenders[0];
      const extra = offenders.length > 1
        ? ` (+${offenders.length - 1} more offending call${offenders.length - 1 === 1 ? '' : 's'} in the same file)`
        : '';
      errors.push(
        `ERROR [5e0-PROGRESSBAR-START-ONE]: progressBar.update() first arg violates start-at-0 invariant at line ${first.lineNum}${extra}. ` +
          `Found: progressBar.update(${first.firstArg}, …). ` +
          'INVARIANT: the first arg is a progression counter that starts at 0 when the game begins, never at 1. ' +
          'Common anti-pattern: progressBar.update(gameState.currentRound + 1, …) — at game start gameState.currentRound is 0, ' +
          'so the bar renders "Round 1/N" before round 1 is played. ' +
          'Fix: track a progression counter in state that starts at 0 (e.g. gameState.progress = 0), ' +
          'bump it on EVERY round attempted (correct OR wrong — default policy is "rounds attempted", NOT "rounds correct" — so a 10-round game ends with the bar showing 10/10 even if some rounds were answered wrong), and pass that variable directly to update(). ' +
          'Score (correct count) is a SEPARATE counter on gameState.score that drives previewScreen.setScore() — do NOT use it for the progress bar. ' +
          'See alfred/skills/game-building/reference/code-patterns.md § Round-complete handler and alfred/parts/PART-023.md.'
      );
    }
  }
}

// ─── GEN-ROUNDSETS-MIN-3: fallbackContent.rounds must contain ≥ 3 distinct set values ─
// Background: restartGame() rotates gameState.setIndex across the labeled sets in
// fallbackContent.rounds so a student who retries in-session sees a different
// question set each attempt (A → B → C → A). For the rotation to have content
// at every position, fallbackContent must ship at least 3 sets.
//
// Rule:
// 1. Parse the fallbackContent = { ... } literal. Locate its rounds: [ ... ] array.
// 2. Parse each round object's `set` key (a string literal such as "A", "B", ...).
// 3. If ZERO rounds have a `set` key → rule skipped (legacy single-set games pass).
// 4. If SOME but not all rounds have `set` keys → ERROR (mixed mode).
// 5. If ALL rounds have `set` keys, enforce:
//      - ≥ 3 distinct `set` values.
//      - Each set's round count === value of `totalRounds` in the same fallbackContent.
//      - All `id` field values globally unique across all rounds.
//
// Parser is intentionally conservative: if the literal structure is too dynamic
// to parse (e.g. rounds is computed, or the object literal is generated at
// runtime), fail open and return without error — static validation is best-effort.
// See alfred/skills/game-building/SKILL.md Step 4 for the content contract.
{
  const fbDeclRe = /(?:const|let|var)\s+fallbackContent\s*=\s*\{/;
  const fbMatch = fbDeclRe.exec(html);
  if (fbMatch) {
    // Walk forward from the opening `{` with balanced brace tracking to extract
    // the fallbackContent object literal body.
    const objStart = fbMatch.index + fbMatch[0].length - 1; // index of `{`
    let i = objStart;
    let depth = 0;
    let objEnd = -1;
    // Simple brace counter — ignores braces inside strings/comments; conservative enough
    // because fallbackContent is typically plain data with no regex or template-string
    // braces at the top level.
    while (i < html.length) {
      const c = html[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) { objEnd = i; break; }
      }
      i++;
    }
    if (objEnd > objStart) {
      const fbBody = html.slice(objStart + 1, objEnd);
      // Extract totalRounds value from the fallbackContent body (e.g. totalRounds: 5).
      const totalRoundsMatch = /\btotalRounds\s*:\s*(\d+)/.exec(fbBody);
      // Locate the rounds: [ ... ] array within the body.
      const roundsKeyRe = /\brounds\s*:\s*\[/;
      const roundsMatch = roundsKeyRe.exec(fbBody);
      if (roundsMatch) {
        // Walk forward from `[` with balanced bracket tracking.
        let j = roundsMatch.index + roundsMatch[0].length - 1; // index of `[`
        let bracketDepth = 0;
        let arrStart = j;
        let arrEnd = -1;
        while (j < fbBody.length) {
          const c = fbBody[j];
          if (c === '[') bracketDepth++;
          else if (c === ']') {
            bracketDepth--;
            if (bracketDepth === 0) { arrEnd = j; break; }
          }
          j++;
        }
        if (arrEnd > arrStart) {
          const arrBody = fbBody.slice(arrStart + 1, arrEnd);
          // Walk the array body and slice each top-level round object literal.
          const roundObjs = [];
          let k = 0;
          while (k < arrBody.length) {
            // Skip whitespace + commas
            while (k < arrBody.length && /[\s,]/.test(arrBody[k])) k++;
            if (k >= arrBody.length) break;
            if (arrBody[k] !== '{') { k++; continue; }
            let oDepth = 0;
            const oStart = k;
            let oEnd = -1;
            while (k < arrBody.length) {
              const c = arrBody[k];
              if (c === '{') oDepth++;
              else if (c === '}') {
                oDepth--;
                if (oDepth === 0) { oEnd = k; break; }
              }
              k++;
            }
            if (oEnd < oStart) break; // unbalanced — fail open
            roundObjs.push(arrBody.slice(oStart + 1, oEnd));
            k = oEnd + 1;
          }
          if (roundObjs.length > 0) {
            // For each round body, extract `set` and `id` values if present.
            // Matches: set: "A" | set: 'A' | set: `A` — keyed or unkeyed quotes.
            const setKeyRe = /\bset\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/;
            const idKeyRe = /\bid\s*:\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/;
            const parsed = roundObjs.map(function(body) {
              const sm = setKeyRe.exec(body);
              const im = idKeyRe.exec(body);
              return {
                set: sm ? (sm[1] || sm[2] || sm[3]) : null,
                id: im ? (im[1] || im[2] || im[3]) : null,
              };
            });
            const tagged = parsed.filter(function(r) { return r.set !== null; });
            const untagged = parsed.filter(function(r) { return r.set === null; });
            // Case 3: no round has a `set` key — legacy single-set game, skip.
            if (tagged.length === 0) {
              // pass — rule skipped
            } else if (untagged.length > 0) {
              // Case 4: mixed mode.
              errors.push(
                'ERROR [GEN-ROUNDSETS-MIN-3]: mixed mode detected in fallbackContent.rounds — ' +
                  tagged.length + ' round(s) have a `set` key but ' + untagged.length + ' do not. ' +
                  'All rounds must have a `set` key if any do. ' +
                  'See alfred/skills/game-building/SKILL.md Step 4.'
              );
            } else {
              // Case 5: all rounds tagged — enforce ≥3 sets, equal counts, unique ids.
              const setCounts = {};
              for (let p = 0; p < parsed.length; p++) {
                const s = parsed[p].set;
                setCounts[s] = (setCounts[s] || 0) + 1;
              }
              const setKeys = Object.keys(setCounts);
              if (setKeys.length < 3) {
                errors.push(
                  'ERROR [GEN-ROUNDSETS-MIN-3]: fallbackContent.rounds has only ' + setKeys.length +
                    ' distinct `set` value(s) (' + setKeys.sort().join(', ') + ') — ' +
                    'at least 3 sets are required (e.g. "A", "B", "C"). ' +
                    'See alfred/skills/game-building/SKILL.md Step 4.'
                );
              } else if (totalRoundsMatch) {
                const tr = parseInt(totalRoundsMatch[1], 10);
                const mismatched = setKeys.filter(function(s) { return setCounts[s] !== tr; });
                if (mismatched.length > 0) {
                  const detail = mismatched.map(function(s) {
                    return s + '=' + setCounts[s];
                  }).join(', ');
                  errors.push(
                    'ERROR [GEN-ROUNDSETS-MIN-3]: each set must contain exactly totalRounds (' + tr +
                      ') rounds; offending counts: ' + detail + '. ' +
                      'See alfred/skills/game-building/SKILL.md Step 4.'
                  );
                }
              }
              // Uniqueness of id across all rounds (only enforceable when ids exist).
              const idSeen = {};
              const dupIds = [];
              for (let p = 0; p < parsed.length; p++) {
                const id = parsed[p].id;
                if (id === null) continue;
                if (idSeen[id]) dupIds.push(id);
                else idSeen[id] = true;
              }
              if (dupIds.length > 0) {
                const uniqueDups = Array.from(new Set(dupIds));
                errors.push(
                  'ERROR [GEN-ROUNDSETS-MIN-3]: duplicate `id` value(s) across rounds: ' +
                    uniqueDups.join(', ') + '. ' +
                    'All round `id` values MUST be globally unique across sets — use prefix ' +
                    'convention "A_r1_…", "B_r1_…", "C_r1_…". ' +
                    'See alfred/skills/game-building/SKILL.md Step 4.'
                );
              }
            }
          }
        }
      }
    }
  }
}

// ─── W15. GEN-DATA-LIVES-SYNC: syncDOMState() must write data-lives for lives games ─
// GEN-DATA-LIVES-SYNC: For games with totalLives > 0, syncDOMState() must set
// app.dataset.lives = String(gameState.lives). The test harness getLives() reads
// #app[data-lives] via getAttribute('data-lives'). If never set, getLives() returns
// null → parseInt(null) = NaN → all lives-decrement assertions fail.
// Detection: game declares totalLives > 0 in gameState AND syncDOMState is defined
// BUT syncDOMState does not reference dataset.lives or setAttribute('data-lives').
// Only warn — regex cannot be 100% accurate (user may set it in a helper).
{
  // Check if this is a lives game: totalLives appears with a positive literal or gameState.totalLives
  const hasTotalLivesPositive =
    /totalLives\s*:\s*(?:[1-9]\d*)\b/.test(html) ||
    /gameState\.totalLives\s*=\s*(?:[1-9]\d*)\b/.test(html);
  // Check if syncDOMState is defined in this file
  const hasSyncDOMState = /function\s+syncDOMState\s*\(/.test(html);
  if (hasTotalLivesPositive && hasSyncDOMState) {
    // Check if syncDOMState body sets data-lives
    const setsDataLives =
      /dataset\s*\.\s*lives\s*=/.test(html) ||
      /setAttribute\s*\(\s*['"]data-lives['"]/.test(html);
    if (!setsDataLives) {
      warnings.push(
        'WARNING [W15/GEN-DATA-LIVES-SYNC]: game has totalLives > 0 but syncDOMState() does not set ' +
          'app.dataset.lives. The test harness getLives() reads #app[data-lives] — if this attribute ' +
          'is never written, getLives() returns NaN and ALL mechanics assertions on life decrements fail. ' +
          'WRONG: syncDOMState() that omits app.dataset.lives. ' +
          'RIGHT: add inside syncDOMState(): if (gameState.totalLives > 0) { app.dataset.lives = String(gameState.lives); } ' +
          '(Source: UI/UX audit addition-mcq-lives F7; GEN-DATA-LIVES-SYNC rule 56)'
      );
    }
  }
}

// ─── GEN-WAITFOR-MATCH: cross-validate waitForPackages typeof vs loaded scripts ──
// GEN-WAITFOR-MATCH ensures the set of CDN components checked in waitForPackages()
// exactly matches the set of components actually loaded and used by the game.
//
// Check A (ERROR): typeof FeedbackManager in waitForPackages, but feedback-manager
//   script NOT in <head> → guaranteed 180s timeout → ALL tests fail.
//   Source: adjustment-strategy builds #376-#378.
//
// Checks B/C/D (WARNING): new X() used in game code but typeof X is absent from
//   waitForPackages() → ReferenceError at instantiation (CDN components load async).
{
  // Check A — FeedbackManager in waitForPackages but no feedback-manager script in <head>
  // Extract <head> block for reliable script-presence check
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const headBlock = headMatch ? headMatch[0] : '';
  const hasFeedbackManagerScript = /feedback-manager/.test(headBlock);
  const hasFeedbackManagerTypeofCheck = /typeof\s+FeedbackManager/.test(html);
  if (hasFeedbackManagerTypeofCheck && !hasFeedbackManagerScript) {
    errors.push(
      'ERROR [GEN-WAITFOR-MATCH-A]: waitForPackages() checks typeof FeedbackManager but ' +
        '/packages/feedback-manager/index.js is NOT loaded in <head>. ' +
        'FeedbackManager never loads when the script tag is absent → ' +
        'waitForPackages() spins until the 180s timeout fires → ALL tests fail in beforeEach. ' +
        'WRONG: typeof FeedbackManager in waitForPackages when PART-017=NO (no feedback-manager script). ' +
        'FIX: Remove typeof FeedbackManager from waitForPackages(), OR add the feedback-manager ' +
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"> tag. ' +
        '(adjustment-strategy builds #376–#378 root cause)'
    );
  }

  // Check B — new TimerComponent( used but typeof TimerComponent not in waitForPackages
  if (/new\s+TimerComponent\s*\(/.test(html) && !/typeof\s+TimerComponent/.test(html) &&
      !/typeof\s+window\.components\??\.TimerComponent/.test(html)) {
    warnings.push(
      'WARNING [GEN-WAITFOR-MATCH-B]: game uses new TimerComponent() but waitForPackages() ' +
        'does not check typeof TimerComponent — ReferenceError risk. ' +
        'TimerComponent loads at CDN step 7 (last). Without a typeof guard in waitForPackages(), ' +
        'init can run before TimerComponent is defined → ReferenceError → blank page. ' +
        'Add to waitForPackages() condition: || typeof TimerComponent === "undefined"'
    );
  }

  // Check C — new ProgressBarComponent( used but typeof ProgressBarComponent not in waitForPackages
  if (/new\s+ProgressBarComponent\s*\(/.test(html) && !/typeof\s+ProgressBarComponent/.test(html) &&
      !/typeof\s+window\.components\??\.ProgressBarComponent/.test(html)) {
    warnings.push(
      'WARNING [GEN-WAITFOR-MATCH-C]: game uses new ProgressBarComponent() but waitForPackages() ' +
        'does not check typeof ProgressBarComponent — ReferenceError risk. ' +
        'ProgressBarComponent loads at CDN step 3. Without a typeof guard in waitForPackages(), ' +
        'init can run before ProgressBarComponent is defined → ReferenceError → blank page. ' +
        'Add to waitForPackages() condition: || typeof ProgressBarComponent === "undefined"'
    );
  }

  // Check D — new TransitionScreenComponent( used but typeof TransitionScreenComponent not in waitForPackages
  if (/new\s+TransitionScreenComponent\s*\(/.test(html) && !/typeof\s+TransitionScreenComponent/.test(html) &&
      !/typeof\s+window\.components\??\.TransitionScreenComponent/.test(html)) {
    warnings.push(
      'WARNING [GEN-WAITFOR-MATCH-D]: game uses new TransitionScreenComponent() but waitForPackages() ' +
        'does not check typeof TransitionScreenComponent — ReferenceError risk. ' +
        'TransitionScreenComponent loads at CDN step 4. Without a typeof guard in waitForPackages(), ' +
        'init can run before TransitionScreenComponent is defined → ReferenceError → blank page. ' +
        'Add to waitForPackages() condition: || typeof TransitionScreenComponent === "undefined"'
    );
  }
}

// ─── GEN-RESULTS-FIXED: #results-screen must have position:fixed ────────────
// GEN-UX-001 rule: #results-screen must have position:fixed; top:0; left:0;
// width:100%; height:100%; z-index:100. 13+ confirmed live instances where it
// was position:static instead, causing the results screen to render off-screen
// (scrolled below game content) on mobile viewports.
// Only warn when id="results-screen" element IS present — some games use the
// CDN TransitionScreen for results and have no custom #results-screen element.
// Detection: find the CSS rule block for #results-screen and check for
// position:\s*fixed. If the block exists without it → WARNING.
if (/id\s*=\s*["']results-screen["']/.test(html)) {
  // Extract all CSS rule blocks for #results-screen from <style> blocks
  // Strategy: find #results-screen { ... } blocks in the HTML and check for position:fixed
  const resultsScreenCssMatch = html.match(/#results-screen\s*\{([^}]*)\}/);
  if (!resultsScreenCssMatch) {
    // #results-screen element exists in HTML but no CSS rule block for it
    warnings.push(
      'WARNING [GEN-RESULTS-FIXED]: id="results-screen" element found but no CSS rule block for #results-screen — ' +
        'GEN-UX-001 requires position:fixed; top:0; left:0; width:100%; height:100%; z-index:100. ' +
        'Without position:fixed, results screen renders off-screen (below game content) on mobile. ' +
        '(13+ confirmed live instances — GEN-UX-001)'
    );
  } else {
    const cssBlock = resultsScreenCssMatch[1];
    const hasPositionFixed = /position\s*:\s*fixed/.test(cssBlock);
    if (!hasPositionFixed) {
      warnings.push(
        'WARNING [GEN-RESULTS-FIXED]: #results-screen does not have position:fixed — results screen may render off-screen (GEN-UX-001 rule). ' +
          'GEN-UX-001 requires: position:fixed; top:0; left:0; width:100%; height:100%; z-index:100. ' +
          '13+ confirmed live instances of position:static causing results screen to be hidden below game content on mobile. ' +
          'Fix: add position:fixed to the #results-screen CSS rule block. ' +
          '(GEN-RESULTS-FIXED, GEN-UX-001)'
      );
    }
  }
}

// ─── GEN-RESULTS-ROUNDS: multi-round games must have rounds-completed element ────────────
// For games with gameState.totalRounds (multi-round indicator), the results screen must
// include an id="rounds-completed" element so students can see their completion progress.
// Does NOT apply to lives-only games (no totalRounds in the HTML).
if (/totalRounds/.test(html) && /id\s*=\s*["']results-screen["']/.test(html)) {
  if (!/id\s*=\s*["']rounds-completed["']/.test(html)) {
    warnings.push(
      'WARN [GEN-RESULTS-ROUNDS]: results-screen present in multi-round game but no id="rounds-completed" element found. ' +
        'Add <p id="rounds-completed">Rounds: N/9</p> to the results screen. ' +
        'Cache the DOM reference at module scope and populate in showResults() — GEN-DOM-CACHE bans getElementById inside dynamically-called functions. ' +
        '(stats-mean-direct #580 M-002)'
    );
  }
}

// ─── GEN-PHASE-INIT: initial data-phase on #app must match gameState.phase init value ─────
// Detection: extract data-phase from the #app element opening tag, and the phase field
// from the gameState object literal. If both are present and differ, warn.
// Rationale: cold-load tests see the hardcoded HTML attribute; post-restart tests see
// whatever syncDOMState() last wrote. When these diverge (e.g. "start" vs "start_screen"),
// test behaviour is inconsistent across runs. (crazy-maze UI-CM-003 #481)
{
  const appPhaseMatch = /id=["']app["'][^>]*data-phase=["']([^"']+)["']/.exec(html) ||
    /data-phase=["']([^"']+)["'][^>]*id=["']app["']/.exec(html);
  const gameStatePhaseMatch = /gameState\s*=\s*\{[^}]*phase\s*:\s*['"](\w+)['"]/.exec(html);
  if (appPhaseMatch && gameStatePhaseMatch) {
    const htmlPhase = appPhaseMatch[1];
    const jsPhase = gameStatePhaseMatch[1];
    if (htmlPhase !== jsPhase) {
      warnings.push(
        `WARNING [GEN-PHASE-INIT]: #app initial data-phase="${htmlPhase}" does not match gameState.phase="${jsPhase}". ` +
          'Use the same value in both places to prevent test fragility on cold load vs restart. ' +
          'WRONG: <div id="app" data-phase="start"> with gameState.phase = \'start_screen\'. ' +
          'CORRECT: <div id="app" data-phase="start_screen"> with gameState.phase = \'start_screen\'.'
      );
    }
  }
}

// ─── GEN-BTN-START: start / "Let's go!" button must have data-testid="btn-start" ───────────
// Detection: presence of mathai-transition-slot, TransitionScreen, or a start-screen pattern
// combined with absence of data-testid="btn-start".
// Rationale: tests that click the start button use [data-testid="btn-start"] — if absent,
// the selector silently fails and the game-flow test never reaches gameplay. (crazy-maze #481)
{
  const hasTransitionOrStart = /mathai-transition-slot|TransitionScreen|start.screen/i.test(html);
  const hasBtnStart = /data-testid=["']btn-start["']/.test(html);
  if (hasTransitionOrStart && !hasBtnStart) {
    warnings.push(
      'WARNING [GEN-BTN-START]: No data-testid="btn-start" found. ' +
        'The "Let\'s go!" / start button must have data-testid="btn-start" so tests can reliably click it. ' +
        'WRONG: <button class="btn-start"> RIGHT: <button class="btn-start" data-testid="btn-start">'
    );
  }
}

// ─── GEN-PHASE-MCQ: MCQ/timed games must call syncDOMState() at all 4 phase transitions ──
// Detection: MCQ pattern = option buttons (class containing 'option' or 'choice' or 'answer-btn'
// or 'choice-btn' or 'opt-btn' or 'mcq') + lives tracking (gameState.lives) or timer usage.
// If detected: count syncDOMState() calls. < 3 calls → WARNING.
// Rationale: 22% of game-flow iter-1 failures are phase-transition misses. All 4 call sites
// (showStartScreen, startGame/renderRound, endGame gameover, endGame victory) must be present.
// 3 is the minimum threshold: at minimum start + playing + one endGame path must be present.
{
  const hasMcqPattern =
    /class\s*=\s*["'][^"']*(?:option|choice|answer-btn|choice-btn|opt-btn|mcq)[^"']*["']/.test(html) ||
    /class\s*=\s*['"][^'"]*\b(?:option|choice)\b/.test(html);
  const hasLivesOrTimer =
    /gameState\.lives\b/.test(html) ||
    /\btotalLives\b/.test(html) ||
    /new\s+TimerComponent\s*\(/.test(html);
  if (hasMcqPattern && hasLivesOrTimer) {
    const syncDOMStateCalls = (html.match(/syncDOMState\s*\(/g) || []).length;
    if (syncDOMStateCalls < 3) {
      warnings.push(
        `WARNING [GEN-PHASE-MCQ]: MCQ game has fewer than 3 syncDOMState() calls (found ${syncDOMStateCalls}) — likely missing phase transitions. ` +
          'ALL 4 required call sites: (1) showStartScreen() → syncDOMState() after gameState.phase=\'start\', ' +
          '(2) startGame()/renderRound() → syncDOMState() after gameState.phase=\'playing\', ' +
          '(3) endGame() lives=0 → syncDOMState() after gameState.phase=\'gameover\', ' +
          '(4) endGame() lives>0 → syncDOMState() after gameState.phase=\'results\'. ' +
          'Missing any call site causes waitForPhase() to timeout → 100% game-flow test failures for that phase. ' +
          '(GEN-PHASE-MCQ-FULL, GEN-MCQ-PHASE rule 33)'
      );
    }
  }
}

// ─── GEN-PHASE-SEQUENCE: endGame must set gameState.phase BEFORE syncDOMState ─
// The LLM commonly generates endGame() that calls syncDOMState() WITHOUT first
// assigning gameState.phase — leaving data-phase='playing' when postMessage fires.
// This is the primary root cause of 18% game-flow pass rate (analytics 2026-03-23).
//
// Detection: extract the endGame() function body and check that:
//   (a) gameState.phase is assigned somewhere inside endGame()
//   (b) the phase assignment appears BEFORE the syncDOMState() call
//
// Strategy: find the endGame function body using a regex that captures content
// between 'function endGame' and the matching closing brace. Because JS nesting
// is complex, we use a heuristic: find the substring from 'function endGame' to
// 'window.parent.postMessage' or 'syncDOMState()' (whichever comes first) and
// check that a phase assignment precedes syncDOMState().
{
  const endGameMatch = /function\s+endGame\s*\([^)]*\)\s*\{([\s\S]{0,2000}?)(?=\n\}|window\.endGame\s*=)/m.exec(html);
  if (endGameMatch) {
    const body = endGameMatch[1];
    const hasSyncDOMState = /syncDOMState\s*\(/.test(body);
    if (hasSyncDOMState) {
      // Check that gameState.phase is assigned somewhere before syncDOMState() in the body
      const phaseAssignIdx = body.search(/gameState\s*\.\s*phase\s*=/);
      const syncDOMIdx = body.search(/syncDOMState\s*\(/);
      if (phaseAssignIdx === -1) {
        // syncDOMState called but no phase assignment at all in endGame body
        warnings.push(
          'WARNING [GEN-PHASE-SEQUENCE]: endGame() calls syncDOMState() but never assigns gameState.phase ' +
          'inside endGame() — data-phase stays "playing" when syncDOMState runs, and waitForPhase("results") ' +
          'or waitForPhase("gameover") will timeout. ' +
          'REQUIRED: set gameState.phase = reason === "victory" ? "results" : "gameover" BEFORE calling syncDOMState(). ' +
          'WRONG: function endGame(r) { gameState.gameEnded=true; syncDOMState(); postMessage({...}); } ' +
          'RIGHT: function endGame(r) { gameState.gameEnded=true; gameState.phase=r==="victory"?"results":"gameover"; syncDOMState(); postMessage({...}); } ' +
          '(GEN-PHASE-SEQUENCE — game-flow 18% pass rate root cause, analytics 2026-03-23)'
        );
      } else if (phaseAssignIdx > syncDOMIdx) {
        // Phase IS assigned but AFTER syncDOMState — still wrong ordering
        warnings.push(
          'WARNING [GEN-PHASE-SEQUENCE]: endGame() calls syncDOMState() BEFORE assigning gameState.phase ' +
          '— data-phase is written with the old "playing" value, then phase is assigned too late. ' +
          'REQUIRED order: (1) gameState.phase = "results"/"gameover", (2) syncDOMState(), (3) postMessage. ' +
          'WRONG: syncDOMState(); gameState.phase = "results"; ' +
          'RIGHT: gameState.phase = "results"; syncDOMState(); ' +
          '(GEN-PHASE-SEQUENCE — game-flow 18% pass rate root cause, analytics 2026-03-23)'
        );
      }
    }
  }
}

// ─── GEN-SHOWRESULTS-SYNC: showResults() must call syncDOMState() after phase='results' ─
// Root cause from keep-track #571 MED-2: showResults() sets gameState.phase='results' but
// never calls syncDOMState(), leaving #app[data-phase] stuck at previous phase ('guess').
// waitForPhase('results') always times out as a result.
//
// Detection: find showResults() function body (heuristic: capture up to 40 lines after the
// function declaration) and check that:
//   (a) gameState.phase is assigned inside showResults()
//   (b) syncDOMState() is also called inside the same function body
//
// Distinct from GEN-PHASE-SEQUENCE (which checks ordering inside endGame) — this checks
// that syncDOMState() is present at all inside showResults().
{
  const showResultsMatch =
    /(?:function\s+showResults\s*\([^)]*\)|showResults\s*=\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>))\s*\{([\s\S]{0,1500}?)(?=\n\}(?:\s*\n|\s*\/\/|\s*function|\s*window\.|$))/m.exec(
      html,
    );
  if (showResultsMatch) {
    const body = showResultsMatch[1];
    const setsPhase = /gameState\s*\.\s*phase\s*=/.test(body);
    const callsSyncDOMState = /syncDOMState\s*\(/.test(body);
    if (setsPhase && !callsSyncDOMState) {
      warnings.push(
        'WARNING [GEN-SHOWRESULTS-SYNC]: showResults() sets gameState.phase but does not call syncDOMState() ' +
          '— #app[data-phase] will not update, waitForPhase(\'results\') will timeout. ' +
          'REQUIRED: call syncDOMState() immediately after gameState.phase = \'results\' inside showResults(). ' +
          'WRONG: function showResults() { gameState.phase = \'results\'; document.getElementById(\'results-screen\').style.display = \'block\'; } ' +
          'RIGHT: function showResults() { gameState.phase = \'results\'; syncDOMState(); document.getElementById(\'results-screen\').style.display = \'block\'; } ' +
          '(GEN-SHOWRESULTS-SYNC — root cause keep-track #571 MED-2)',
      );
    }
  }
}

// ─── W16. GEN-SYNCDOMSTATE-ALLATTRS: syncDOMState() must write data-round and data-score ─
// GEN-SYNCDOMSTATE-ALLATTRS: If a game defines syncDOMState() AND the function sets
// data-phase BUT does NOT set data-round or data-score, the DOM attributes will lag
// behind gameState after restartGame() resets currentRound/score to 0. Tests reading
// #app[data-round] or #app[data-score] after Play Again will see stale end-of-game values.
// Only warn (not error) — some games legitimately have no rounds/score.
// Only fire if the game has currentRound in gameState (no-round games should not be flagged).
{
  const hasSyncDOMState = /function\s+syncDOMState\s*\(/.test(html);
  if (hasSyncDOMState) {
    // Extract syncDOMState function body (up to 800 chars after function declaration)
    const syncMatch = html.match(/function\s+syncDOMState\s*\([^)]*\)\s*\{([\s\S]{0,800})/);
    if (syncMatch) {
      const syncBody = syncMatch[1];
      const setsDataPhase =
        /setAttribute\s*\(\s*['"]data-phase['"]/.test(syncBody) ||
        /dataset\s*\.\s*phase\s*=/.test(syncBody);
      const setsDataRound =
        /setAttribute\s*\(\s*['"]data-round['"]/.test(syncBody) ||
        /dataset\s*\.\s*round\s*=/.test(syncBody);
      const setsDataScore =
        /setAttribute\s*\(\s*['"]data-score['"]/.test(syncBody) ||
        /dataset\s*\.\s*score\s*=/.test(syncBody);
      // Only flag if the game uses currentRound (games without rounds should not be flagged)
      const hasCurrentRound = /currentRound/.test(html);
      if (setsDataPhase && hasCurrentRound && (!setsDataRound || !setsDataScore)) {
        const missing = [];
        if (!setsDataRound) missing.push('data-round');
        if (!setsDataScore) missing.push('data-score');
        warnings.push(
          `WARNING [W16/GEN-SYNCDOMSTATE-ALLATTRS]: syncDOMState() sets data-phase but does NOT set ` +
            `${missing.join(' or ')}. After restartGame() resets gameState fields to 0, ` +
            `DOM attributes lag behind and tests see stale end-of-game values (e.g. "5" instead of "0"). ` +
            'WRONG: function syncDOMState() { const app = document.getElementById(\'app\'); if (app) app.setAttribute(\'data-phase\', gameState.phase); } ' +
            'RIGHT: syncDOMState() must also set app.dataset.round = String(gameState.currentRound || 0) and app.dataset.score = String(gameState.score || 0). ' +
            '(Confirmed: hide-unhide #461 MEDIUM-6; GEN-SYNCDOMSTATE-ALLATTRS rule 56b)'
        );
      }
    }
  }
}

// ─── GEN-MOBILE-STACK: flex-direction:row on game container or MCQ options ───
// Fix 2: WARNING for flex-direction:row on common game layout selectors.
// False-positive risk: TRUE/FALSE two-button layouts and timer+score bars are
// legitimately row layouts — skip for known non-container selectors.
// Fix 3: ERROR for flex-direction:row on MCQ option button containers.
//
// Strategy: extract all CSS rule blocks from <style> tags, find blocks that
// set flex-direction:row, classify the selector as game-container (WARNING)
// or MCQ option container (ERROR).
// Shared between Block 1 (ERROR check) and Block 2 (dedup guard) — defined here
// so both bare blocks below can reference it without repeating the literal.
const MCQ_CONTAINER_SELECTOR_RE =
  /\.options\b|\.option-btn\b|\.options-container\b|\.options-grid\b|#options\b/;
{
  // Extract all content inside <style> blocks
  const styleBlocks = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch;
  while ((styleMatch = styleRe.exec(html)) !== null) {
    styleBlocks.push(styleMatch[1]);
  }
  const allCss = styleBlocks.join('\n');

  // Find all CSS rule blocks that contain flex-direction: row
  // Pattern: capture selector + block body
  const cssRuleRe = /([^{}]+)\{([^}]*)\}/g;
  let ruleMatch;
  while ((ruleMatch = cssRuleRe.exec(allCss)) !== null) {
    const selector = ruleMatch[1].trim();
    const block = ruleMatch[2];

    if (!/flex-direction\s*:\s*row/.test(block)) continue;

    // Known valid row patterns — skip these (single-button internals, timer/score bars, header/footer)
    const isKnownValid =
      /\.game-btn\b|btn-|\.timer\b|\.score\b|\.icon\b|\.header\b|\.footer\b|\.navbar\b|\.toolbar\b/.test(selector);
    if (isKnownValid) continue;

    // ERROR: MCQ option button container with flex-direction:row
    // Applies when HTML has MCQ option elements AND the selector targets the options container
    const hasMcqOptions =
      /data-testid=["']option-0["']/.test(html) ||
      /class=["'][^"']*\boption-btn\b/.test(html) ||
      /class=["'][^"']*\boptions-container\b/.test(html);

    const isMcqContainer = MCQ_CONTAINER_SELECTOR_RE.test(selector);

    if (hasMcqOptions && isMcqContainer) {
      errors.push(
        `ERROR [GEN-MOBILE-STACK]: MCQ option button container "${selector}" uses flex-direction:row — ` +
          'option button containers MUST use flex-direction:column so each button is a full-width row. ' +
          'flex-direction:row splits options into narrow columns that fail the 44px touch target minimum. ' +
          'WRONG: .options-container { display:flex; flex-direction:row; } ' +
          'RIGHT: .options-container { display:flex; flex-direction:column; } each option is full-width, min-height:44px. ' +
          '(GEN-MOBILE-STACK — stats-identify-class #573 P0-1)'
      );
      continue;
    }

    // WARNING: general game layout container with flex-direction:row
    const isGameContainer =
      /game-container\b|game-layout\b|game-area\b|options-grid\b|options-container\b|question-panel\b/.test(
        selector
      );

    if (isGameContainer) {
      // Suppress if flex-wrap:wrap is present in the same block (safe for option grids)
      // or if there is an @media max-width:480px media query override elsewhere in the CSS
      const hasFlexWrap = /flex-wrap\s*:\s*wrap/.test(block);
      const hasMediaQuery480 = /@media[^{]*max-width\s*:\s*480\s*px/.test(allCss);
      if (!hasFlexWrap && !hasMediaQuery480) {
        warnings.push(
          `WARNING [GEN-MOBILE-STACK]: Selector "${selector}" uses flex-direction:row — ` +
            'primary game sections should use flex-direction:column to stack vertically on 375px mobile viewport. ' +
            'flex-direction:row on a game container splits sections into narrow columns (e.g. 164px+121px+50px) ' +
            'causing all child buttons to fail the 44px touch target minimum. ' +
            'WRONG: #game-container { display:flex; flex-direction:row; } ' +
            'RIGHT: #game-container { display:flex; flex-direction:column; gap:16px; } ' +
            'Exception: flex-direction:row is acceptable for icon+label within a single button, ' +
            'TRUE/FALSE two-option pairs ≥44px min-height, or timer+score inline display. ' +
            '(GEN-MOBILE-STACK — stats-identify-class #573 P0-1)'
        );
      }
    }
  }
}

// ─── GEN-MOBILE-STACK-WRAP: flex-direction:row on option/choice containers without flex-wrap ─
// Complement to the flex-direction:row ERROR above.
// When a game legitimately uses a multi-column grid layout (flex-direction:row allowed for
// TRUE/FALSE pairs, two-option layouts, etc.), the container MUST also have flex-wrap:wrap
// OR a @media max-width:480px rule to prevent buttons from overflowing on mobile.
// stats-identify-class #581 P0-1: 3-column flex row with no flex-wrap → buttons overflow
// 480px viewport → P0 mobile UX failure.
// This is a WARNING (not ERROR) — some option grids are intentionally narrow (TRUE/FALSE).
{
  const styleBlocks2 = [];
  const styleRe2 = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let styleMatch2;
  while ((styleMatch2 = styleRe2.exec(html)) !== null) {
    styleBlocks2.push(styleMatch2[1]);
  }
  const allCss2 = styleBlocks2.join('\n');

  // Check for an @media max-width:480px media query anywhere in the CSS
  const hasMedia480 = /@media[^{]*max-width\s*:\s*480\s*px/.test(allCss2);

  // Selectors that already fired an ERROR from Block 1 (MCQ container check) — skip to avoid double-report
  const hasMcqOptions2 =
    /data-testid=["']option-0["']/.test(html) ||
    /class=["'][^"']*\boption-btn\b/.test(html) ||
    /class=["'][^"']*\boptions-container\b/.test(html);

  // Find CSS rules that match option/choice multi-button containers with flex-direction:row
  const cssRuleRe2 = /([^{}]+)\{([^}]*)\}/g;
  let ruleMatch2;
  while ((ruleMatch2 = cssRuleRe2.exec(allCss2)) !== null) {
    const selector2 = ruleMatch2[1].trim();
    const block2 = ruleMatch2[2];

    if (!/flex-direction\s*:\s*row/.test(block2)) continue;

    // Only check option/choice/answer multi-button container selectors
    const isOptionGrid =
      /options-grid|choices-grid|option-container|choice-container|answer-grid|answers-grid/.test(selector2);
    if (!isOptionGrid) continue;

    // Skip if Block 1 already fired ERROR for this selector (MCQ container + hasMcqOptions)
    const alreadyCoveredByBlock1 =
      hasMcqOptions2 && MCQ_CONTAINER_SELECTOR_RE.test(selector2);
    if (alreadyCoveredByBlock1) continue;

    // If flex-wrap is present in the same rule block, it's fine
    if (/flex-wrap\s*:\s*wrap/.test(block2)) continue;

    // If there's a @media max-width:480px override elsewhere, also fine
    if (hasMedia480) continue;

    warnings.push(
      `WARNING [GEN-MOBILE-STACK]: "${selector2}" uses flex-direction:row without flex-wrap:wrap and no @media max-width:480px — ` +
        'buttons will overflow or become too narrow to tap on 480px mobile viewport. ' +
        'WRONG: .options-grid { display:flex; flex-direction:row; gap:12px; }  ← no flex-wrap, columns break at 480px. ' +
        'RIGHT: .options-grid { display:flex; flex-direction:row; flex-wrap:wrap; gap:12px; } ' +
        '.option-btn { flex:1 1 calc(33% - 12px); min-width:120px; }  ← wraps gracefully. ' +
        'ALSO RIGHT: @media(max-width:480px) { .options-grid { flex-direction:column; } }. ' +
        'WHY: stats-identify-class #581 — 3-column flex row with no flex-wrap → buttons overflow viewport at 480px → P0 mobile UX failure. ' +
        '(GEN-MOBILE-STACK)'
    );
  }
}

// ─── GEN-DOM-CACHE: getElementById/querySelector inside per-round functions ───
// GEN-DOM-CACHE (WARNING): Fires when a common per-round function (loadQuestion,
// loadRound, showRound, showQuestion, renderOptions) contains a document.getElementById()
// or document.querySelector() call in its function body.
// These elements live inside a <template> cloned into #gameContent. Due to CDN
// ScreenLayout slot injection timing, the elements may not be in the document root when
// the per-round function first runs. The null-dereference is swallowed by CDN's internal
// try/catch, producing a blank game silently with no console errors.
// Only a WARNING (not ERROR) because not all querySelector calls inside functions are
// problematic — only those affected by CDN timing. The warning guides the LLM to cache
// refs at init instead. (stats-mean-direct #575 root cause. Lesson L-GF-005.)
{
  // Extract the full function body by tracking brace depth, supporting nested if/for/try blocks.
  // Returns the text between the opening and closing braces of the named function, or null if not found.
  function extractFunctionBody(src, funcName) {
    const declPattern = new RegExp(
      `(?:async\\s+)?(?:function\\s+${funcName}\\s*\\([^)]*\\)|${funcName}\\s*=\\s*(?:async\\s+)?(?:function|\\([^)]*\\)\\s*=>))\\s*\\{`,
      'g'
    );
    const match = declPattern.exec(src);
    if (!match) return null;
    let depth = 1;
    let i = match.index + match[0].length;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    return src.slice(match.index + match[0].length, i - 1);
  }

  const bannedFunctions = [
    'loadQuestion', 'loadRound', 'showRound', 'renderOptions', 'nextRound',
    'renderRound', 'showQuestion', 'displayRound', 'loadPuzzle', 'renderPuzzle', 'showPuzzle',
  ];
  const domLookupPattern = /document\.(getElementById|querySelector)\s*\(/;

  for (const funcName of bannedFunctions) {
    const body = extractFunctionBody(html, funcName);
    if (body && domLookupPattern.test(body)) {
      warnings.push(
        'WARNING [GEN-DOM-CACHE]: document.getElementById() or document.querySelector() called inside a per-round function ' +
          '(loadQuestion/loadRound/showRound/renderRound/showQuestion/displayRound/loadPuzzle/renderPuzzle/showPuzzle/renderOptions/nextRound). ' +
          'These elements live inside a <template> cloned into #gameContent — CDN slot promotion timing may cause getElementById() ' +
          'to return null when the function first runs. The null crash is swallowed by CDN\'s error boundary, producing a blank game silently. ' +
          'FIX: cache all DOM element references as module-scope variables at the end of DOMContentLoaded, AFTER ScreenLayout.inject() and after any template clone. ' +
          'WRONG: function loadQuestion(i) { const el = document.getElementById("question-text"); el.textContent = ...; } ' +
          'RIGHT: // after ScreenLayout.inject(): const questionEl = document.getElementById("question-text"); ' +
          'function loadQuestion(i) { questionEl.textContent = ...; } ' +
          '(GEN-DOM-CACHE — stats-mean-direct #575 root cause. Lesson L-GF-005.)'
      );
      break; // one warning per file is sufficient
    }
  }
}

// ─── GEN-TIMER-GETTIME: timer.getTime() / timer.getCurrentTime() are not CDN methods ─
// These method names are hallucinated — the CDN TimerComponent only exposes
// start/stop/pause/resume/reset/destroy. Calling getTime() throws TypeError in endGame,
// preventing window.parent.postMessage from firing (game_complete never sent).
// Source: associations #578 — contract 0/2 due to timer.getTime() in endGame.
{
  const bannedTimerMethods = /\btimer\s*\.\s*(?:getTime|getCurrentTime|getElapsed|getElapsedTime|getMilliseconds|getSeconds)\s*\(/;
  if (bannedTimerMethods.test(html)) {
    errors.push(
      'ERROR [GEN-TIMER-GETTIME]: timer.getTime() / timer.getCurrentTime() are not valid CDN TimerComponent methods. ' +
      'These method names are hallucinated — calling them throws TypeError in endGame, preventing game_complete postMessage. ' +
      'VALID methods: timer.start(), timer.stop(), timer.pause(), timer.resume(), timer.reset(), timer.destroy(). ' +
      'To track elapsed time, use: const elapsed = (Date.now() - gameState.startTime) / 1000. ' +
      '(Source: associations #578 — timer.getTime() in endGame blocked postMessage. Lesson: hallucinated CDN timer API.)'
    );
  }
}

// ─── GEN-CORRECT-ANSWER-EXPOSURE: round uses string correct-answer field but gameState.correctAnswer never set ─
// If the game reads round.correctOption / round.correctAnswer / round.correctValue / round.answer
// (or similar) but never assigns gameState.correctAnswer, the test harness answer() falls back to
// clicking button index 0 — submitting the wrong answer for most rounds → 0% correct submissions →
// game stuck at data-phase='playing' → 52% game-flow failure rate.
// Source: stats-identify-class #581 root cause diagnosis.
const hasMcqAnswerField = /round\??\s*\.\s*(?:correctOption|correctAnswer|correctValue|solution|correctWord|correctItem)\b/.test(html);
const hasTextAnswerField = /round\??\s*\.\s*answer\b/.test(html);
const setsGameStateCorrectAnswer = /gameState\s*\.\s*correctAnswer\s*=/.test(html);
const setsGameStateAnswer = /gameState\s*\.\s*answer\s*=/.test(html);

// Text-input carve-out: only exempt when using round.answer (NOT MCQ fields) AND setting gameState.answer
const isTextInputExempt = !hasMcqAnswerField && hasTextAnswerField && setsGameStateAnswer;

if ((hasMcqAnswerField || hasTextAnswerField) && !setsGameStateCorrectAnswer && !isTextInputExempt) {
  warnings.push(
    'WARN [GEN-CORRECT-ANSWER-EXPOSURE]: round uses a string correct-answer field (round.correctOption / ' +
    'round.correctAnswer / round.correctValue / round.answer / round.solution / round.correctWord / ' +
    'round.correctItem) but gameState.correctAnswer is never assigned. ' +
    'The test harness answer(page, true) reads gameState.correctAnswer to find which button to click — ' +
    'if undefined, it defaults to button index 0, submitting the wrong answer for most rounds → ' +
    '0% correct submissions → game stuck at data-phase=\'playing\'. ' +
    'FIX: add gameState.correctAnswer = round.correctOption (or appropriate field) BEFORE syncDOMState() ' +
    'in renderRound() / loadRound(). ' +
    'Exception: text-input games that set gameState.answer = round.answer are exempt — harness uses gameState.answer as fallback. ' +
    '(stats-identify-class #581 — 100% wrong answer submissions root cause)'
  );
}

// ─── GEN-WORKED-EXAMPLE-TEARDOWN (WARNING) ───────────────────────────────────
// When a worked-example panel has a "Got It" / dismiss button, the handler MUST
// re-enable option buttons before hiding the panel. If optionBtns were disabled
// before showing the panel, the buttons remain permanently disabled after the panel
// closes — player cannot proceed. This check fires when:
//   (a) HTML contains worked-example panel logic
//   (b) HTML has a "Got It" handler
//   (c) The handler does NOT re-enable buttons (removeAttribute 'disabled')
// WARN level only — cannot reliably detect exact structure.
// (Root cause: build #583 — handleGotIt() hid panel without re-enabling option buttons)
{
  const hasWorkedExample =
    /worked[_-]?example|workedExample|workedExamplePanel|worked-example/i.test(html);
  const hasGotItHandler =
    /gotIt|handleGotIt|got-it|gotit|closePanel|dismissExample|onDismiss|handleClose|hidePanel|closedWorked|handleDismiss/i.test(html);
  if (hasWorkedExample && hasGotItHandler) {
    const hasReenableButtons =
      /removeAttribute\s*\(\s*['"]disabled['"]\s*\)|\.disabled\s*=\s*false\b|classList\.remove\s*\(\s*['"]disabled['"]\s*\)/.test(html);
    if (!hasReenableButtons) {
      warnings.push(
        'WARNING [GEN-WORKED-EXAMPLE-TEARDOWN]: worked-example panel dismiss handler found but no button re-enable pattern detected. ' +
        'Add one of: optionBtns.forEach(btn => btn.removeAttribute(\'disabled\')), btn.disabled = false, or classList.remove(\'disabled\') before hiding the panel. ' +
        'Without re-enabling buttons, option buttons remain permanently disabled after the panel closes ' +
        'and the player cannot proceed. ' +
        '(Root cause: build #583 — handleGotIt() hid panel without re-enabling option buttons)'
      );
    }
  }
}

// ─── GEN-ISPROCESSING-RESET (WARNING) ────────────────────────────────────────
// If isProcessing flag is used, it MUST also be reset to false somewhere.
// isProcessing = true set in answer handler but never cleared after worked-example
// teardown leaves the game permanently locked even after buttons are re-enabled.
// (Root cause: build #583 — isProcessing never reset after handleGotIt() teardown path)
{
  const hasIsProcessingTrue =
    /isProcessing\s*=\s*true/.test(html);
  const hasIsProcessingFalse =
    /isProcessing\s*=\s*false/.test(html);
  if (hasIsProcessingTrue && !hasIsProcessingFalse) {
    warnings.push(
      'WARNING [GEN-ISPROCESSING-RESET]: isProcessing = true found but isProcessing = false is never set. ' +
      'isProcessing MUST be reset to false: ' +
      '(1) at the END of handleGotIt() / dismiss-worked-example handler, ' +
      '(2) at the END of nextRound() after all setup is complete, ' +
      '(3) on game restart. ' +
      'NEVER leave isProcessing = true across round boundaries — the next round\'s option buttons ' +
      'are unclickable even after they are re-enabled. ' +
      '(Root cause: build #583 — isProcessing stuck true after handleGotIt() teardown path)'
    );
  }
}

// ─── 13. Video player validation (PART-040) ────────────────────────────────
// Only runs if the HTML contains a <video> element — conditional check.
const hasVideoElement = /<video\b/.test(html);
if (hasVideoElement) {
  // REQUIRED: controls attribute — user must be able to play/pause
  if (!/<video[^>]*\bcontrols\b/.test(html)) {
    errors.push('VIDEO [PART-040]: <video> element missing `controls` attribute — user cannot play the video');
  }

  // REQUIRED: playsinline — prevents fullscreen takeover on iOS
  if (!/<video[^>]*\bplaysinline\b/.test(html)) {
    errors.push('VIDEO [PART-040]: <video> element missing `playsinline` attribute — iOS will hijack to fullscreen');
  }

  // REQUIRED: controlsList="nofullscreen" — matches production VideoPart.tsx
  if (!/<video[^>]*controlsList\s*=\s*["'][^"']*nofullscreen/.test(html)) {
    warnings.push('WARNING [PART-040]: <video> element missing controlsList="nofullscreen" — fullscreen button will show');
  }

  // FORBIDDEN: autoplay — blocked by browser policies, causes silent failures
  if (/<video[^>]*\bautoplay\b/.test(html)) {
    errors.push('VIDEO [PART-040]: <video> has `autoplay` — forbidden. User must tap play explicitly');
  }

  // FORBIDDEN: black background on video container — must be white per VideoPart.tsx
  // Check for background: #000 or background: black on elements wrapping video
  const videoContainerBlackBg = /\.video[-_]?(?:container|wrapper|player)[^}]*background\s*:\s*(?:#000|black)/i.test(html);
  if (videoContainerBlackBg) {
    warnings.push('WARNING [PART-040]: Video container has black background — should be white per VideoPart.tsx pattern');
  }

  // FORBIDDEN: forced aspect-ratio on video container — let video size naturally
  const videoForcedAspect = /\.video[-_]?(?:container|wrapper|player)[^}]*aspect-ratio\s*:/i.test(html);
  if (videoForcedAspect) {
    warnings.push('WARNING [PART-040]: Video container has forced aspect-ratio — remove it, let video determine natural height');
  }

  // REQUIRED: error event listener — for debugging video load failures
  if (!/(?:gameVideo|patternVideo|video).*addEventListener\s*\(\s*['"]error['"]/.test(html) &&
      !/addEventListener\s*\(\s*['"]error['"].*(?:gameVideo|patternVideo|video)/.test(html) &&
      !/\.onerror\s*=/.test(html)) {
    warnings.push('WARNING [PART-040]: No error event listener on <video> element — video failures will be silent');
  }
}

// ─── 14. Audio player validation (PART-041) ────────────────────────────────
// Only runs if the HTML contains an <audio> element — conditional check.
const hasAudioElement = /<audio\b/.test(html);
if (hasAudioElement) {
  // FORBIDDEN: autoplay — blocked by browser policies
  if (/<audio[^>]*\bautoplay\b/.test(html)) {
    errors.push('AUDIO [PART-041]: <audio> has `autoplay` — blocked by browsers, causes silent failure');
  }

  // Check for custom player UI pattern (PART-041 uses custom UI, not native controls)
  // If <audio> has controls attribute, it's using native controls instead of custom UI
  const audioHasNativeControls = /<audio[^>]*\bcontrols\b/.test(html);
  const hasCustomPlayBtn = /audio[-_]?play[-_]?btn|toggleAudioPlayback|audioPlayBtn/i.test(html);
  if (audioHasNativeControls && hasCustomPlayBtn) {
    warnings.push('WARNING [PART-041]: <audio> has both native `controls` and custom play button — use one or the other');
  }

  // WARN: no ended event listener
  if (!/(?:gameAudio|audio).*addEventListener\s*\(\s*['"]ended['"]/.test(html) &&
      !/addEventListener\s*\(\s*['"]ended['"].*(?:gameAudio|audio)/.test(html) &&
      !/\.onended\s*=/.test(html)) {
    warnings.push('WARNING [PART-041]: No ended event listener on <audio> element — playback completion will not be tracked');
  }

  // WARN: no error event listener
  if (!/(?:gameAudio|audio).*addEventListener\s*\(\s*['"]error['"]/.test(html) &&
      !/addEventListener\s*\(\s*['"]error['"].*(?:gameAudio|audio)/.test(html)) {
    warnings.push('WARNING [PART-041]: No error event listener on <audio> element — audio failures will be silent');
  }
}

// FORBIDDEN: new Audio() anywhere — RULE-006 + PART-041
if (/new\s+Audio\s*\(/.test(html)) {
  errors.push('AUDIO [RULE-006]: new Audio() found — use <audio> element in DOM instead (RULE-006 forbids new Audio())');
}

// ─── AnswerComponent (PART-051) — CDN + slot + lifecycle + slide shape ──────
// Rules:
//   GEN-ANSWER-COMPONENT-CDN              — script tag (or bundle) when used
//   GEN-ANSWER-COMPONENT-SLOT             — slots.answerComponent:true in ScreenLayout.inject
//   GEN-ANSWER-COMPONENT-INSTANTIATE      — `new AnswerComponentComponent(...)` exists
//   GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK — .show() appears after FeedbackManager.play
//   GEN-ANSWER-COMPONENT-AFTER-CELEBRATION — multi-round: .show() NOT in endGame; reached
//                                            only via Stars Collected onMounted hand-off
//   GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE — floatingBtn.on('next', ...) is single-stage
//                                            exit; no two-stage `if (!firstClick)` branch
//   GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW   — .show() not gated by previewScreen.isActive() === true
//   GEN-ANSWER-COMPONENT-DESTROY          — .destroy() called from cleanup path
//   GEN-ANSWER-COMPONENT-SLIDE-SHAPE      — slides[] use `render` callback only (no html / element keys)
(function checkAnswerComponent() {
  // Spec opt-out short-circuits ALL rules in this block, regardless of whether
  // the source still references the component.
  if (specContext.answerComponent === false) return;

  const usesAnswer = /\bnew\s+AnswerComponentComponent\s*\(/.test(html) ||
    /\bnew\s+AnswerComponent\s*\(/.test(html);
  if (!usesAnswer) {
    // Component not instantiated and no opt-out declared — surface a single
    // missing-instantiation error so the build sub-agent knows to wire it up.
    // Skip when there's no spec at all (validator was invoked outside the
    // game directory) to avoid noise in ad-hoc runs.
    if (specContext.totalRounds == null && specContext.floatingButton == null) return;
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-INSTANTIATE]: Spec does not opt out of the AnswerComponent ' +
        '(no `answerComponent: false` declaration found) but the source never instantiates ' +
        '`new AnswerComponentComponent({ slotId: "mathai-answer-slot" })`. Wire up the component ' +
        'per PART-051. ' +
        'DO NOT "fix" this error by adding `answerComponent: false` to spec.md — that flag is a ' +
        'CREATOR-ONLY opt-out (PART-051 § Opt-out). The build step (step 4) MUST NOT mutate the spec ' +
        'to silence this rule. If you believe the game genuinely should not have an answer carousel, ' +
        'flag the spec for review at step 2 — do not patch it at build time. ' +
        '(PART-051, GEN-ANSWER-COMPONENT-INSTANTIATE)'
    );
    return;
  }

  // (1) GEN-ANSWER-COMPONENT-CDN — require the standalone CDN script OR the bundle.
  const ansHasStandaloneCdn = /<script[^>]+src=["'][^"']*\/answer-component\/index\.js["']/i.test(html);
  const ansHasBundle = /<script[^>]+src=["'][^"']*\/packages\/components\/index\.js["']/i.test(html);
  if (!ansHasStandaloneCdn && !ansHasBundle) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-CDN]: AnswerComponentComponent is instantiated but no CDN script tag is present. ' +
        'Include EITHER the standalone component: ' +
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/answer-component/index.js"></script>, ' +
        'OR the bundle: ' +
        '<script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>. ' +
        '(PART-051, GEN-ANSWER-COMPONENT-CDN)'
    );
  }

  // (2) GEN-ANSWER-COMPONENT-SLOT — ScreenLayout.inject must declare the slot.
  const ansHasSlotDecl = /answerComponent\s*:\s*(?:true\b|['"][^'"]+['"])/.test(html);
  if (!ansHasSlotDecl) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-SLOT]: AnswerComponentComponent is used but ScreenLayout.inject() does not declare ' +
        'slots.answerComponent. Add answerComponent: true to the slots object, e.g. ' +
        'ScreenLayout.inject(\'app\', { slots: { previewScreen: true, floatingButton: true, answerComponent: true } }). ' +
        '(PART-051, GEN-ANSWER-COMPONENT-SLOT)'
    );
  }

  // (3) GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK — at least one `.show(` call
  //     for the answer ref must appear AFTER an `await FeedbackManager.play(`
  //     in the source. Heuristic: look for any answer-ref `.show(` in source
  //     order following a FeedbackManager.play awaits. We use byte-offsets in
  //     `html` because validator scans plain text.
  const fbPlayMatch = /await\s+FeedbackManager\s*\.\s*play\s*\(/.exec(html);
  const ansShowMatches = [];
  const ansShowRe = /\b(?:answerComponent|answerComp|answerCmp|answer)\s*\.\s*show\s*\(/g;
  let asm;
  while ((asm = ansShowRe.exec(html)) !== null) {
    ansShowMatches.push(asm.index);
    if (ansShowMatches.length > 8) break;
  }
  if (ansShowMatches.length === 0) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK]: AnswerComponentComponent is instantiated but no `.show({ slides })` ' +
        'call is found. Reveal the component AFTER the final-round feedback completes ' +
        '(`await FeedbackManager.play(...)`), then call `floatingBtn.setMode(\'next\')`. ' +
        '(PART-051, GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK)'
    );
  } else if (fbPlayMatch && ansShowMatches.every(idx => idx < fbPlayMatch.index)) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK]: All `answerComponent.show(...)` calls appear in source BEFORE ' +
        'any `await FeedbackManager.play(...)`. The component must be revealed AFTER feedback completes — moving it ' +
        'earlier shows the answer before the player has finished hearing the verdict. ' +
        '(PART-051, GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK)'
    );
  }

  // (4a) GEN-ANSWER-COMPONENT-AFTER-CELEBRATION — for multi-round games that
  //      use TransitionScreen, `answerComponent.show(...)` MUST NOT appear
  //      inside `endGame()` (or be called directly from any path before the
  //      Stars Collected celebration). The reveal must be reached only via
  //      the Stars Collected `onMounted` setTimeout that calls the
  //      answer-reveal function. The Stars Collected TS stays mounted (no
  //      `transitionScreen.hide()` in `onMounted` per
  //      default-transition-screens.md — the celebration is the backdrop for
  //      the answer review). Skipped for standalone games (totalRounds === 1)
  //      since they don't use TS at all (GEN-FLOATING-BUTTON-STANDALONE-TS-
  //      FORBIDDEN).
  const isMultiRound = specContext.totalRounds == null || specContext.totalRounds > 1;
  const usesTSForAnswer =
    /\bnew\s+TransitionScreenComponent\s*\(/.test(html) ||
    /\btransitionScreen\s*\.\s*show\s*\(/.test(html);
  if (isMultiRound && usesTSForAnswer) {
    // Locate the endGame function body and check for answerComponent.show
    // inside it. Tolerates `function endGame`, `async function endGame`, and
    // `var/let/const endGame = ` forms.
    const endGameRe = /(?:async\s+)?function\s+endGame\b|(?:const|let|var)\s+endGame\s*=/;
    const eg = endGameRe.exec(html);
    if (eg) {
      const blockStart = eg.index;
      // Crude but bounded: scan ~3000 chars after the function header.
      const block = html.slice(blockStart, blockStart + 3000);
      if (/\b(?:answerComponent|answerComp|answer)\s*\.\s*show\s*\(/.test(block)) {
        errors.push(
          'ERROR [GEN-ANSWER-COMPONENT-AFTER-CELEBRATION]: `answerComponent.show(...)` is called inside `endGame()`. ' +
            'For multi-round games that use TransitionScreen, the answer carousel must appear AFTER the Stars Collected ' +
            'celebration beat — never alongside or before it. Pattern: `endGame()` posts `game_complete` and routes to ' +
            '`showVictory()` / `showStarsCollected()`. Stars Collected\'s `onMounted` plays the yay sound + show_star ' +
            'animation, then via setTimeout calls a `showAnswerCarousel()` function (the Stars Collected TS stays mounted ' +
            'as the celebration backdrop — no `transitionScreen.hide()` in `onMounted`, per default-transition-screens.md). ' +
            'That function is the ONLY place that calls `answerComponent.show(...)` + `floatingBtn.setMode(\'next\')`. ' +
            'Calling it in endGame() (or in a Victory `Claim Stars` action that skips Stars Collected) steals the ' +
            'celebration moment AND forces a multi-stage Next handler. ' +
            '(PART-051, GEN-ANSWER-COMPONENT-AFTER-CELEBRATION)'
        );
      }
    }
  }

  // (4b) GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE — `floatingBtn.on('next', ...)`
  //      must be a single-stage exit. Detect the two-stage anti-pattern where
  //      the handler body contains a conditional that calls a celebration
  //      function (showStarsCollected / transitionScreen.show) on the first
  //      click and posts next_ended only on the second click. Heuristic: a
  //      handler whose body contains BOTH a celebration-screen invocation
  //      AND a `setMode(null)` / `setMode("hidden")` call alongside an
  //      `if (...) { ... } else { ... post next_ended }` shape.
  const nhRe = /\b(?:floatingBtn|floatingButton)\s*\.\s*on\s*\(\s*['"]next['"]\s*,\s*(?:async\s+)?(?:function[^()]*\([^)]*\)|\([^)]*\)\s*=>)\s*\{/;
  const nh = nhRe.exec(html);
  if (nh) {
    const bodyStart = nh.index + nh[0].length;
    // Bounded body slice — handler body is rarely > 1500 chars.
    const body = html.slice(bodyStart, bodyStart + 2000);
    const callsCelebration =
      /\bshowStarsCollected\s*\(/.test(body) ||
      /\btransitionScreen\s*\.\s*show\s*\(/.test(body);
    const hidesNextMidHandler = /\.\s*setMode\s*\(\s*(?:null|['"]hidden['"])/.test(body);
    const hasBranchingFlag =
      /\bif\s*\(\s*!?[a-zA-Z_$][\w$]*\.[a-zA-Z_$][\w$]*\s*\)/.test(body) ||
      /\bif\s*\(\s*!\s*gameState\b/.test(body) ||
      /\bif\s*\(\s*[a-zA-Z_$][\w$]*\s*\)\s*\{[\s\S]{0,300}?\belse\b/.test(body);
    if (callsCelebration && (hidesNextMidHandler || hasBranchingFlag)) {
      errors.push(
        'ERROR [GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE]: `floatingBtn.on(\'next\', ...)` handler appears to be a ' +
          'two-stage exit — its body invokes a celebration screen (`showStarsCollected(` or `transitionScreen.show(`) ' +
          'AND either hides the floating button mid-handler (`setMode(null)`) or branches on a flag. The Next button ' +
          'must be a single-stage exit: by the time it is visible, the player has already seen Victory + Stars ' +
          'Collected + AnswerComponent. The handler body must only: (1) `answerComponent.destroy()`, (2) post ' +
          '`{type:"next_ended"}`, (3) destroy preview + floating button. ' +
          'Move the celebration call into the path that runs BEFORE `floatingBtn.setMode(\'next\')` is fired (typically ' +
          'a Stars Collected `onMounted` setTimeout that calls the answer-reveal function — the Stars Collected TS itself ' +
          'stays mounted as the celebration backdrop, no hide() needed). ' +
          '(PART-051, GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE)'
      );
    }
  }

  // (5) GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW — flag a `.show(` for the answer
  //     ref that appears inside an `if (previewScreen.isActive())` /
  //     `state === 'preview'` true-branch.
  const previewGuardedShow = /if\s*\(\s*(?:previewScreen\s*\.\s*isActive\s*\(\s*\)|[a-zA-Z_$][\w$]*\.state\s*===\s*['"]preview['"])\s*\)\s*\{[^}]{0,400}\b(?:answerComponent|answerComp|answer)\s*\.\s*show\s*\(/.test(html);
  if (previewGuardedShow) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW]: `answerComponent.show(...)` is called inside a branch gated by ' +
        '`previewScreen.isActive()` / `state === "preview"`. The component must NEVER be shown during preview state. ' +
        '(PART-051, GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW)'
    );
  }

  // (6) GEN-ANSWER-COMPONENT-DESTROY — require at least one .destroy() call.
  const ansHasDestroy = /\b(?:answerComponent|answerComp|answer)\s*\.\s*destroy\s*\(/.test(html);
  if (!ansHasDestroy) {
    errors.push(
      'ERROR [GEN-ANSWER-COMPONENT-DESTROY]: AnswerComponentComponent is instantiated but `.destroy()` is never called. ' +
        'Call it from `floatingBtn.on(\'next\', ...)` (and from `restartGame()` if the game supports restart). ' +
        '(PART-051, GEN-ANSWER-COMPONENT-DESTROY)'
    );
  }

  // (7) GEN-ANSWER-COMPONENT-SLIDE-SHAPE — slides[] entries must use `render`
  //     callback only. We scan for `slides:` array literals nearby a `.show(`
  //     call and reject `html:` / `element:` keys inside them. Best-effort
  //     heuristic — looks within ~1500 chars after a `.show(`.
  const showCallRe = /\b(?:answerComponent|answerComp|answer)\s*\.\s*show\s*\(\s*\{/g;
  let scm;
  let slideShapeErr = null;
  while ((scm = showCallRe.exec(html)) !== null) {
    const window15 = html.slice(scm.index, scm.index + 1500);
    if (/\bslides\s*:\s*\[/.test(window15)) {
      // Pull the slides array body and scan for forbidden keys.
      const slicedFromSlides = window15.slice(window15.indexOf('slides'));
      // Look for forbidden keys before what is plausibly the closing `]` of slides.
      const arrayEnd = slicedFromSlides.indexOf(']');
      const slidesBody = arrayEnd > 0 ? slicedFromSlides.slice(0, arrayEnd) : slicedFromSlides;
      if (/\bhtml\s*:/.test(slidesBody) || /\belement\s*:/.test(slidesBody)) {
        slideShapeErr =
          'ERROR [GEN-ANSWER-COMPONENT-SLIDE-SHAPE]: `answerComponent.show({ slides: [...] })` contains a slide entry ' +
          'with an `html:` or `element:` key. Slides MUST use the `render(container)` callback shape ONLY — these other ' +
          'keys are not supported by the component and will throw at runtime. ' +
          '(PART-051, GEN-ANSWER-COMPONENT-SLIDE-SHAPE)';
        break;
      }
    }
  }
  if (slideShapeErr) errors.push(slideShapeErr);
})();

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
