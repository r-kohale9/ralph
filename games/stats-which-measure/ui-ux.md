# stats-which-measure — Pre-Build Spec Audit
**Date:** 2026-03-23
**Method:** Spec review (no build exists yet)

## Pre-Build Checklist

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | game_complete dual-path — endGame() handles both victory AND game-over with separate TransitionScreen calls | PASS | endGame(victory) at §7.6: `transitionScreen.show({ type: victory ? 'victory' : 'game_over', ... })` — single call handles both paths via ternary. postMessage sent on both paths. |
| 2 | Timer destroy+recreate in restartGame() — timer.destroy() + new TimerComponent() | PASS | §7.7: `if (timer) timer.destroy(); timer = new TimerComponent('timer-container', { theme: 'minimal' })` — exact required pattern. |
| 3 | syncDOMState() at ALL phase transitions — all 3 transitions covered | PASS | Page load → phase='start' → syncDOMState() (§6 state machine). startGame() → phase='playing' → syncDOMState() (§7.1 line after phase set). endGame(true/false) → phase='results'/'game_over' → syncDOMState() (§7.6 immediately after phase assignment). Life lost (wrong/timeout) → syncDOMState() in handleMeasureSelect() and handleTimeout(). All 5 call sites covered. |
| 4 | transitionScreen.show() ONE-arg object form — NEVER show('screen-type', config) | PASS | §7.6: `transitionScreen.show({ type: victory ? 'victory' : 'game_over', score: ..., stars: ..., message: ... })` — single object argument. §12 CDN table: "ALWAYS object form". §6 state machine also confirms start screen uses object form. |
| 5 | FeedbackManager.init() absent — must not appear anywhere | PASS | FeedbackManager.init() appears only in 4 warning/prohibition callouts (header CRITICAL, PART-017 row, §12 CDN table, §15 anti-patterns). No actual invocation present anywhere in spec. §7.3 uses FeedbackManager.sound('correct'/'wrong') only. |
| 6 | gameState.gameId first field — `gameId: 'stats-which-measure'` as first field | PASS | §3 gameState literal: `gameId: 'stats-which-measure'` is the first key (preceded only by a comment). CRITICAL callout in spec header reinforces this. |
| 7 | ProgressBar slotId key — `{ slotId: 'mathai-progress-slot', ... }` | PASS | §12 CDN table: `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 6, totalLives: 3 })`. PART-023 row confirms correct key name. |

## Summary

**All 7 checks: PASS. Zero spec fixes required.**

Spec is build-ready. No changes made.

## Spec Quality Notes (non-blocking)

- 5 Exa research sources cited inline (NCERT, ABS, Laerd, Penn State STAT 200, Pubadmin) — strong pedagogical grounding.
- 6 fallback rounds with full content (scenario, options, correctMeasure, feedbackCorrect, feedbackWrong, misconceptionTag) — well-structured test content.
- 4 misconception tags (MC-outlier-ignore ×3, MC-mode-discrete ×1, MC-symmetric-median ×1, MC-categorical-mean ×1) covering full L4 Analyze scenario space.
- results-screen position:fixed CSS constraint explicitly documented in §5 structural rules and §10 CSS.
- waitForPackages maxWait=180000 explicitly enforced in §13.
