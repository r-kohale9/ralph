# HTML Structure Template

The exact document structure every game must follow. Do not deviate from the element order. This template reflects the authoritative init sequence from `PRODUCTION-CHECKLIST.md`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{Game Title}</title>

  <!-- ====== 1. SentryConfig package (MUST be first script) ====== -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js"></script>

  <!-- ====== 2. initSentry() definition (inline) ====== -->
  <script>
    function initSentry() {
      if (typeof SentryConfig === 'undefined' || !SentryConfig.enabled) return;
      if (typeof Sentry === 'undefined') return;
      Sentry.init(SentryConfig.getConfig({
        release: '{game-id}@1.0.0'
      }));
    }
  </script>

  <!-- ====== 3. Sentry SDK (3 scripts, NO integrity attribute) ====== -->
  <script src="https://browser.sentry-cdn.com/10.23.0/bundle.tracing.replay.feedback.min.js" crossorigin="anonymous"></script>
  <script src="https://browser.sentry-cdn.com/10.23.0/captureconsole.min.js" crossorigin="anonymous"></script>
  <script src="https://browser.sentry-cdn.com/10.23.0/browserprofiling.min.js" crossorigin="anonymous"></script>

  <!-- ====== 4. Initialize Sentry on load ====== -->
  <script>window.addEventListener('load', initSentry);</script>

  <!-- ====== 5-7. Game CDN packages (exact order: feedback-manager, components, helpers) ====== -->
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js"></script>
  <script src="https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js"></script>

  <style>
    /* 1. :root variables (--mathai-* system, including --mathai-success/error/warning) */
    /* 2. Reset: *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; } */
    /* 3. html, body { width: 100%; height: 100dvh; overflow: hidden; } -- use 100dvh NOT 100vh */
    /* 4. .hidden { display: none !important; } -- MUST be defined if .hidden class is used */
    /* 5. #results-screen { position: fixed; top:0; left:0; right:0; bottom:0; z-index:100; } */
    /* 6. Layout overrides for .mathai-layout-root (max-width: 480px; margin: 0 auto;) */
    /* 7. Transition screen overrides (.mathai-ts-screen.active, .mathai-ts-card) */
    /* 8. Gameplay styles (header, progress, question, options) */
    /* 9. Results screen / Game-over screen (lives games only) */
    /* 10. Micro-animations (@keyframes) */
    /* 11. Responsive & touch (44x44px targets, -webkit-tap-highlight-color: transparent) */
  </style>
</head>
<body>
  <!-- Body contains ONLY #app -- no manual layout divs (.page-center, .game-wrapper, .game-stack) -->
  <!-- ScreenLayout.inject() creates the internal scaffold including #gameContent -->
  <div id="app" data-phase="start_screen" data-score="0"></div>

  <script>
    /* ====== Function & variable definitions (global scope) ====== */
    /* 1. gameState initialization (gameId MUST be first field) */
    /* 2. window.gameState = gameState */
    /* 3. fallbackContent (complete rounds matching spec schema) */
    /* 4. Module-scope vars: timer, visibilityTracker, signalCollector, progressBar, transitionScreen, previewScreen */
    /* 5. syncDOM */
    /* 6. trackEvent */
    /* 7. recordAttempt */
    /* 8. getStars */
    /* 9. getRounds (with fallback) */
    /* 10. waitForPackages (typeof checks for 4 packages, 180s timeout) */
    /* 11. FeedbackManager preload + audio helper functions */
    /* 12. handlePostMessage */
    /* 13. render (phase router) */
    /* 14. startGame */
    /* 15. loadRound (first 3 lines: isProcessing=false, isActive=true, syncDOM) */
    /* 16. answer handler (with isProcessing + gameEnded guards) */
    /* 17. nextRound */
    /* 18. endGame (gameEnded guard, both victory + game-over paths) */
    /* 19. showResults (populate #results-screen directly, NOT via transitionScreen) */
    /* 20. restartGame (reset ALL fields including game-specific, re-instantiate SignalCollector) */

    /* ====== DOMContentLoaded -- 15-step init sequence ====== */
    document.addEventListener('DOMContentLoaded', async function() {
      try {
        /* 1.  await waitForPackages() */
        /* 2.  await FeedbackManager.init() -- do NOT call unlock() after */
        /* 3.  SignalCollector creation */
        /* 4.  ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true }, sections: {...}, styles: {...} }) -- previewScreen slot is default; OMIT the previewScreen key when spec declares previewScreen: false */
        /* 5.  Inject timer container into header slot */
        /* 6.  Build play area HTML into #gameContent */
        /* 7.  TimerComponent creation (autoStart: false) */
        /* 8.  InteractionManager creation */
        /* 9.  VisibilityTracker creation (onInactive/onResume handlers -- also wire previewScreen.pause/resume when preview is enabled) */
        /* 10. createProgressBar() */
        /* 11. TransitionScreenComponent creation */
        /* 12. PreviewScreenComponent creation: new PreviewScreenComponent({ slotId: 'mathai-preview-slot' }) -- SKIP entirely when spec previewScreen=false */
        /* 13. Audio preloading: FeedbackManager.sound.preload([{id, url}]) -- include previewAudio when preview is enabled */
        /* 14. Register handlePostMessage listener -- BEFORE game_ready */
        /* 15. Send game_ready postMessage */
        /* 16. setupGame() -- when preview enabled, setupGame() renders #gameContent first then calls previewScreen.show() last. When spec previewScreen=false, DOMContentLoaded calls the first TransitionScreen (level/round intro) directly instead of setupGame()/showPreviewScreen() */
      } catch (e) {
        console.error('[init] ' + e.message);
      }

      /* Window exposures (MUST be here, at bottom of DOMContentLoaded) */
      window.gameState = gameState;
      window.endGame = endGame;
      window.restartGame = restartGame;
      window.nextRound = nextRound;
      window.startGame = startGame;
    });
  </script>
</body>
</html>
```

## Initial `#app` Attributes

The `#app` element MUST have initial `data-*` attributes matching gameState initial values:

```html
<!-- No-lives game -->
<div id="app" data-phase="start_screen" data-score="0"></div>

<!-- Lives game -->
<div id="app" data-phase="start_screen" data-score="0" data-lives="3"></div>
```

**GEN-PHASE-INIT:** The `data-phase` value in HTML must match `gameState.phase` initial value. Mismatch = build failure.

## Script Loading Rules

Scripts load in two groups, in this exact order:

**Group 1: Sentry (error tracking)**
1. SentryConfig package: `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/sentry/index.js`
2. `initSentry()` inline definition
3. Sentry SDK (3 scripts from `https://browser.sentry-cdn.com/10.23.0/`) -- NO `integrity` attributes
4. `window.addEventListener('load', initSentry)` -- not inline call

**Group 2: Game CDN packages**
5. FeedbackManager: `https://storage.googleapis.com/test-dynamic-assets/packages/feedback-manager/index.js`
6. Components: `https://storage.googleapis.com/test-dynamic-assets/packages/components/index.js`
7. Helpers: `https://storage.googleapis.com/test-dynamic-assets/packages/helpers/index.js`

**Rules:**
- Never invent CDN URLs -- copy exactly from this template
- No other external scripts. No CDN libraries (jQuery, lodash, etc.)
- No `<link>` tags to external CSS
- All game CSS is inline in `<style>`
- All game JS is inline in `<script>`
- Sentry release tag must match game ID: `"{game-id}@1.0.0"`

## Init Sequence Rules

The `DOMContentLoaded` handler runs 16 steps in order (see template above). Critical constraints:

1. `waitForPackages()` uses `typeof` checks for FeedbackManager, TimerComponent, VisibilityTracker, SignalCollector with 180s timeout
2. `FeedbackManager.init()` must be awaited -- but do NOT call `unlock()` after it
3. `ScreenLayout.inject()` must run before any DOM insertion into `#gameContent`. `slots.previewScreen: true` is MANDATORY -- every game has a preview screen
4. `PreviewScreenComponent` is instantiated AFTER `ScreenLayout.inject()` with only `{ slotId: 'mathai-preview-slot' }` -- do NOT pass `autoInject`, `gameContentId`, `questionLabel`, `score`, or `showStar`
5. PostMessage listener registered BEFORE `game_ready` sent -- prevents race condition
6. Entire init block wrapped in try/catch
7. `setupGame()` is the last call. **DOMContentLoaded MUST NOT show a TransitionScreen before `setupGame()`** — no `Let's go!`, no `Start`, no `Welcome` screen before preview. The PreviewScreen **is** the first user-facing content. Any `transitionScreen.show(...)` invocation inside DOMContentLoaded, ahead of `setupGame()`, is a bug (5e0-DOMCL-TRANSITION).
8. `setupGame()` must (a) render the full round DOM into `#gameContent` then (b) call `previewScreen.show(...)` as its last step. Reversing this order produces an empty preview area when `showGameOnPreview: true`
9. `endGame()` must call `previewScreen.destroy()`; `restartGame()` must NOT call `previewScreen.show()` or `setupGame()` -- the preview shows once per session
10. Window exposures (`window.gameState`, `window.endGame`, `window.restartGame`, `window.nextRound`, `window.startGame`) at bottom of DOMContentLoaded
11. **Standalone-fallback gate (5e0-FALLBACK-GATE-WEAK).** Any `setTimeout` standalone fallback (inside OR after `DOMContentLoaded`) that calls `startGame()`, `showRoundIntro()`, or `injectGameHTML()` MUST, as its first statement, check:

    ```javascript
    if (previewScreen && previewScreen.isActive && previewScreen.isActive()) return;
    ```

    The fallback exists *only* to recover from `waitForPackages()` timeout / CDN failure. If `previewScreen` is instantiated and active, the preview path is live and the fallback must abort. Do NOT rely on `gameState.phase === 'start_screen'` alone — preview does not mutate game state, so phase stays `'start_screen'` for the entire preview duration. Symptom if omitted: preview audio and Round 1 intro audio overlap; the welcome transition is silently skipped because `startGameAfterPreview` early-returns on `gameState.isActive === true`.

## Preview Header / Wrapper Invariants

The PreviewScreen wrapper is **persistent** for the entire session (see PART-039 Wrapper persistence invariant). Every game's structure must respect:

- **Header is fixed at top**, above content, visible in both `preview` and `game` states. The header renders avatar, back button, question label, score, and star — all fed from `game_init` payload and mutated through `syncDOM`.
- **Single scroll area** below the header: instruction body + `.game-stack` share one scroll container, `.mathai-preview-body`. Root/page scrolling is locked to the viewport in preview-wrapper mode, so generated games MUST include the compatibility CSS below until the components bundle rollout is universal:

  ```css
  #mathai-preview-slot {
    height: 100dvh;
    overflow: hidden;
  }

  #mathai-preview-slot .mathai-preview-body {
    height: 100dvh;
    box-sizing: border-box;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
  ```

  Games MUST NOT add `overflow: auto` / `overflow: scroll` to children of `.game-stack` (nested scrolling breaks iOS momentum + causes layout jumps).
- **No duplicate header inside `#gameContent`.** Do not render a separate score / lives / avatar / back-button element inside the play area — it will duplicate the preview header.
- **No hiding, re-parenting, or destroying the wrapper mid-session.** `mathai-preview-slot` stays in the DOM with its original parent for the entire session. `#gameContent` stays inside `.game-stack`. Victory / Game Over / Play Again / Try Again render INSIDE the wrapper via `transitionScreen.show()` into `mathai-transition-slot`. `previewScreen.destroy()` fires exactly once, in the session-final `endGame()`. See `code-patterns.md` § Wrapper persistence for the canonical pattern.
