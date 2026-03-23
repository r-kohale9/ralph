# UI/UX Audit Log

**Created:** March 23, 2026
**Maintained by:** UI/UX Slot (mandatory active slot — see CLAUDE.md Rule 16)

---

## Purpose

Track visual and interaction quality audits of generated games. Each entry records: what was audited, what issues were found, how they were classified, and what action was taken.

**Issue classification:**
- **Gen prompt rule** → add to CDN_CONSTRAINTS_BLOCK or VISUAL_CONSTRAINTS_BLOCK in lib/prompts.js
- **Spec addition** → add visual requirement to game spec (docs/education/trig-session.md etc.)
- **CDN constraint** → add T1 check in lib/validate-static.js

---

## Active Audit Target

**Current task:** Next approved game without full browser playthrough — addition-mcq (pending build), or next stats game build.
**Last completed:** stats-mean-direct #580 — 2026-03-23 — 0 P0 + 0 HIGH + 3 MEDIUM + 2 LOW — APPROVED. All 9 rounds functional, results screen position:fixed PASS, Play Again state reset PASS. M-001: window.nextRound harness timing (test gap). M-002: results missing rounds-completed metric (gen rule). M-003: aria-atomic absent on feedback (gen rule).
**Waiting on:** —

### Batch 20 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | stats-mean-direct | #580 | **full browser playthrough** 2026-03-23 — 0 P0 + 0 HIGH + 3 MEDIUM + 2 LOW + 1 CDN | APPROVED — no re-queue required. 9/9 rounds complete, results fixed, Play Again PASS. M-001 test gap (nextRound harness timing), M-002 gen rule (results rounds-completed), M-003 gen rule (aria-atomic). |

### Batch 19 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | associations | #578 | **full browser playthrough** 2026-03-23 — 1 P0 + 3 MEDIUM + 2 LOW | RE-QUEUE REQUIRED — timer.getTime is not a function in endGame() blocks results screen. Play Again crash FIXED. gameState.gameId FIXED. results-screen testid FIXED. |

### Batch 18 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | visual-memory | #528 | **full browser playthrough** 2026-03-23 — 1 P0 + 2 HIGH + 4 MEDIUM + 3 LOW + 1 CDN | RE-QUEUE REQUIRED — endGame guard blocks results screen on perfect playthrough (gameState.isActive=false guard misfires) |

### Batch 17 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | associations | #513 | **full browser playthrough** 2026-03-23 — 1 P0 + 4 MEDIUM + 2 LOW | RE-QUEUE REQUIRED — white screen on Play Again (TypeError in transition-screen/index.js:297) |

### Batch 16 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | hide-unhide | #461 | **full browser playthrough** 2026-03-23 — 0 P0 + 6 MEDIUM + 2 LOW + 1 CDN | done — no re-queue required; 5/5 rounds + Play Again PASS |

### Batch 15 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | keep-track | #571 | **full browser playthrough** 2026-03-23 — 0 P0 + 2 HIGH + 3 MEDIUM + 2 LOW | done — no re-queue required; GEN-TS-ONEARG confirmed fixed |

### Batch 14 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | true-or-false | #474 | **full browser playthrough** 2026-03-23 — 0 P0 + 0 HIGH + 2 MEDIUM + 2 LOW + 1 CDN | done — no re-queue required |

### Batch 13 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | crazy-maze | #481 | **full browser playthrough** 2026-03-23 — 0 P0 + 2 HIGH + 3 MEDIUM + 2 LOW | done — no re-queue required |

### Batch 12 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | one-digit-doubles | #487 | **full browser playthrough** 2026-03-23 — 0 P0 + 2 HIGH + 2 MEDIUM + 2 LOW | done — no re-queue required |

### Batch 11 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | keep-track | #503 | **full browser playthrough** 2026-03-23 — 2 P0 + 3 HIGH + 3 MEDIUM + 2 LOW | done — re-queued as build #567 (GEN-TS-ONEARG a320a31 deployed) |

### Batch 10 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | two-player-race | #506 | **full browser playthrough** 2026-03-23 — 0 P0 + 2 HIGH + 3 MEDIUM + 2 LOW | done — no re-queue required |
| 2 | memory-flip | #505 | **full browser playthrough** 2026-03-23 — 0 P0 + 3 HIGH + 3 MEDIUM + 2 LOW | done — no re-queue required |

### Batch 9 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | position-maximizer | #507 | **full browser playthrough** 2026-03-23 — 0 P0 + 2 HIGH + 3 MEDIUM + 2 LOW | done — no re-queue required |

### Batch 8 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | light-up | #508 | **full browser playthrough** 2026-03-23 — 0 P0 + 8 findings (3 HIGH, 3 MEDIUM, 2 LOW) | done — no re-queue required |

### Batch 7 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | disappearing-numbers | #509 | **full browser playthrough** 2026-03-23 — 1 P0 + 7 findings | done — re-queue recommended |

### Batch 6 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | truth-tellers-liars | #510 | **full browser playthrough** 2026-03-23 — 0 P0s + 6 findings (3 MEDIUM, 3 LOW) | done — no re-queue required |

### Batch 5 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | expression-completer | #511 | **full browser playthrough** 2026-03-23 — 0 P0s + 7 findings (2 HIGH, 3 MEDIUM, 2 LOW) | done — no re-queue required |

### Batch 4 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | count-and-tap | #551 | **full browser playthrough** 2026-03-23 — 0 P0s + 10 findings (1 retracted) | done |
| 2 | associations | #472 | **full browser playthrough** 2026-03-23 — 1 P0 + 6 findings (5a, 2d) | done — re-queue recommended |
| 3 | quadratic-formula-worked-example | #546 | already done Batch 2 | skip |

### Batch 2 — Completed 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | quadratic-formula-worked-example | #546 | **full browser playthrough** 2026-03-23 | done |
| 2 | soh-cah-toa-worked-example | #544 | **full browser playthrough** 2026-03-23 (upgraded from static) | done |
| 3 | right-triangle-area | #543 | audited (static analysis) 2026-03-23 | done — games/ dir created |
| 4 | word-pairs | #529 | audited (static analysis) 2026-03-23 | done |

### Batch 3 — In Progress 2026-03-23

| Priority | Game | Build ID | ui-ux.md state | Status |
|----------|------|----------|----------------|--------|
| 1 | which-ratio | #561 | **full browser playthrough** 2026-03-23 — 2 P0s + 8 issues | done — re-queue required |
| 2 | find-triangle-side | #549 | **full browser playthrough** 2026-03-23 — 1 P0 + 11 findings | done — re-queue required |
| 3 | real-world-problem | #564 | **full browser playthrough** 2026-03-23 — 0 P0s + 12 findings (3 new active: Play Again 41px, SignalCollector sealed on restart, SVG clip confirmed; UI-RWP-009 RETRACTED — syncDOMState on #app is correct, test harness also uses #app[data-phase]) | done |

**Stub inventory (ui-ux.md exists but unpopulated — pending future batches):**
addition-mcq

---

## Completed Audits

| Date | Game | Build | Issues Found | Actions Taken |
|------|------|-------|-------------|---------------|
| 2026-03-23 | keep-track | #503 | **10 findings (2 P0, 3 HIGH, 3 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 2 P0s** | P0-A: `transitionScreen.show()` two-arg bug (string + config) — CDN component expects single config object, all screens blank including start screen (NEW critical gen rule GEN-TS-ONEARG; 2nd instance after which-ratio #561 victory screen); P0-B: gameContent stays display:none — TransitionScreen.hide() never fires because P0-A prevents valid show() call; HIGH: no aria-live (25th+ ARIA-001); cup divs missing role=button/tabindex=0/aria-label (NEW GEN-INTERACTIVE-DIV-ROLE); results-screen position:static (21st+ GEN-UX-001); MEDIUM: restartGame() state not reset (gameEnded/round/score stale); accuracy shows 0% in results; timer hardcoded #000FFF color (new VISUAL rule); LOW: FeedbackManager subtitle CDN warning (25th+ instance); timer 0:00 conditional on P0-A. PASS: CDN 0 404s, gameState.gameId='game_keep_track', window functions exposed, syncDOMState targets #app, data-phase/round/lives/score all set, cup data-testid option-0..2, game_complete postMessage correct. Re-queue required after GEN-TS-ONEARG rule applied to prompt. |
| 2026-03-23 | memory-flip | #505 | **8 findings (0 P0, 3 HIGH, 3 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. HIGH: window.nextRound not exposed (11th+ GEN-WINDOW-EXPOSE — test harness console error at load); gameState.gameId undefined (23rd+ GEN-GAMEID — SignalCollector templateId=null); results-screen position:static (19th+ GEN-UX-001). MEDIUM: Flips counter cumulative across rounds (shows 6 at start of Round 2, 14 at Round 3 — new gen rule: use roundFlips not totalFlips for display, reset to 0 between rounds); no aria-live regions (23rd+ ARIA-001); card divs (data-testid="option-N") have role=null, tabIndex=-1, aria-label=null — not keyboard accessible (new rule: card elements need role="button", tabindex="0", aria-label="Card N, face down/showing X"). LOW: FeedbackManager subtitle not loaded (CDN warning, non-blocking); double transition-screen click before first round — intro screen + level 1 screen both require "Let's go!" (spec — combine or skip level 1 intro at game start). PASS: all 3 rounds completable (3→4→6 pairs, difficulty escalation correct); ⭐⭐⭐ 3-star results at 100% accuracy; Play Again resets to 0/3; progress bar 0/3→3/3; #mathai-progress-slot + #mathai-transition-slot present; transition button 47px + Play Again 44px; window.endGame/restartGame exposed; data-phase start→playing→results; arithmetic pairs correct (10-2=8, 10-7=3, etc.); 0 CDN 404s; 1 console error (test harness only). No re-queue required. |
| 2026-03-23 | position-maximizer | #507 | **7 findings (0 P0, 2 HIGH, 3 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. HIGH: gameState.gameId undefined (21st+ GEN-GAMEID instance — verify rule enforcement); results-screen position:static (18th GEN-UX-001 — verify rule enforcement). MEDIUM: no aria-live anywhere (21st+ ARIA-001 — verify enforcement); slot cells (.slot-cell.empty) no role/aria-label/tabIndex (new rule needed: slot-picker interactive divs → role=button + aria-label per position name); instructions block (3 paragraphs) persists all 5 rounds consuming ~40% viewport height at 375px (spec addition needed). LOW: audio 403 storm — correct_tap + wrong_tap from cdn.homeworkapp.ai return 403, AudioKit retries 30+ times, 0/2 preload success (CDN constraint); FeedbackManager subtitle/sticker not loaded 5× (CDN component registration, non-blocking). PASS (13): all 5 rounds completable; 3-star victory reached; window.nextRound/endGame/restartGame exposed; #app data-phase/lives/score correct; #mathai-progress-slot + #mathai-transition-slot present; "Let's go!" 47px, "Play Again" 44px; L1→L2 level transition via TransitionScreen "Next Level"; progress counter 0/5→5/5; CDN packages 0 network 404s. No re-queue required. |
| 2026-03-23 | light-up | #508 | **8 findings (0 P0, 3 HIGH, 3 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. HIGH: window.nextRound not exposed (10th+ instance — GEN-WINDOW-EXPOSE must cover single-round puzzle games); results-screen position:static (17th GEN-UX-001 instance — rule shipped, verify enforcement); answer-input data-testid on grid container (new — grid/puzzle games should use data-testid="game-grid" not "answer-input"). MEDIUM: no aria-live (20th ARIA-001 instance — rule shipped); data-phase='playing' during restart TransitionScreen interstitial (syncDOMState timing miss — must set start_screen before showing restart overlay); gameState.gameId='game_light_up' (PASS — noted correctly). LOW: audio 404 storm — success.mp3 missing from test-dynamic-assets CDN path, AudioKit retries 70+ times (CDN constraint); TransitionScreen global not at window.TransitionScreen (CDN observation, no action needed — waitForPackages correctly checks TransitionScreenComponent). PASS: game fully completable; 5×5 puzzle grid renders; cell illumination works; correct solution → ★★★ results; Play Again resets all state (score/lives/round/gameEnded); grid cells 61.4px touch target PASS; syncDOMState writes #app[data-phase]; waitForPackages checks TransitionScreenComponent (correct); TransitionScreen object API; 0 CDN package 404s; lottie-player duplicate registration (known non-blocking). No re-queue required. |
| 2026-03-23 | disappearing-numbers | #509 | **7 findings (1 P0, 2 HIGH, 2 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 1 P0** | P0: white screen — waitForPackages() PART-003 checks `typeof Components`/`typeof Helpers` (never window globals) → always times out 10s → `Init error:{}` → game never renders. HIGH: gameState.gameId missing (GEN-GAMEID #20+); results-screen not position:fixed (GEN-UX-001 #17+). MEDIUM: no aria-live (ARIA-001 #20+); #app missing data-lives/data-round/data-score in static HTML. LOW: .game-btn no min-height:44px; number cards missing data-testid (use [data-index] fallback). PASS (19): CDN loads clean, window.endGame/restartGame/nextRound exposed, data-testid answer-input/btn-check/btn-restart/stars-display/score-display/lives-display, TransitionScreen object API, ProgressBar slotId mathai-progress-slot, syncDOMState targets #app, 5-round escalating content, inputmode=numeric, VisibilityTracker, SignalCollector, Sentry guard. Re-queue recommended. Root cause: PART-003 must check `typeof ScreenLayout`/`typeof ProgressBarComponent` not `typeof Components`/`typeof Helpers`. |
| 2026-03-23 | expression-completer | #511 | **7 findings (2d-HIGH, 3a-MEDIUM, 2c-LOW) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. HIGH: window.nextRound not exposed (2nd instance — game uses roundComplete; test harness fails silently); Step 1 + Step 2 option buttons share data-testid option-0/1/2 (harness querySelector always hits Step 1, can't reach Step 2). MEDIUM: results-screen position:static (GEN-UX-001 #16); no aria-live regions (ARIA-001 #19); gameState.gameId undefined (GEN-GAMEID #7). LOW: FeedbackManager subtitle not initialized 5× (CDN warning); SignalCollector sealed race on endGame() (CDN, 4th instance). PASS: all 6 rounds reachable; results screen shows 6/6 + accuracy + stars; Play Again resets (phase/round/lives/score/gameEnded); 2nd playthrough starts; 44px touch targets (48px); ProgressBar slotId mathai-progress-slot; TransitionScreen object API; syncDOMState #app transitions start_screen→playing→results; window.endGame + restartGame exposed; progress bar header updates; two question types (fill-blank + select-grouping) both work; wrong answer life deduction (3→2); 0 PAGEERRORs. No re-queue required. |
| 2026-03-23 | face-memory | #512 | **6 findings (3a, 0b, 1a-low, 2c-low) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. MEDIUM: results-screen position:static (15th GEN-UX-001 instance); no aria-live anywhere (18th ARIA-001 instance); gameState.gameId undefined (6th browser GEN-GAMEID instance). LOW: .feature-option divs not button elements (role=null, tabIndex=-1 — accessibility gap, backlog); no Enter key on start screen; FeedbackManager subtitle not loaded 6× (CDN warning). PASS: CSS intact; "I'm ready!" 47px; Play Again 44px; Continue 47px; feature-option 72px; TransitionScreen object API; ProgressBar slotId='mathai-progress-slot' + totalLives=3; syncDOMState targets #app; window.endGame/restartGame/nextRound exposed; data-testid option-0..3 + btn-restart + timer-display present; game_complete postMessage with metrics; Play Again resets all state (phase/currentRound/lives/score/gameEnded); all 3 rounds functional with difficulty scaling (3 features → 4 features rounds 2–3); wrong answer life deduction confirmed (3→2→1); results screen reachable; 0 console errors across 190 messages. No re-queue required (systemic issues only). |
| 2026-03-23 | match-the-cards | #514 | **6 findings (3a, 0b, 2c, 1a-low) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. MEDIUM: results-screen position:static (14th GEN-UX-001 instance); no aria-live anywhere (17th ARIA-001 instance); gameState.gameId undefined (5th browser GEN-GAMEID instance — SignalCollector templateId=null). LOW: no Enter key binding; FeedbackManager subtitle not loaded 20× (CDN warning); SignalCollector sealed warning 1× after endGame() — FeedbackManager.playDynamicFeedback() async callback fires after seal() (3rd instance). PASS: CSS intact; cards 52px; Let's go! 47px; Play Again 44px; TransitionScreen object API; ProgressBar slotId='mathai-progress-slot' + totalLives=3; window.endGame/restartGame/nextRound exposed; game_complete postMessage with metrics; Play Again resets lives/round/score/wrongAttempts/gameEnded; all 5 rounds + level transition (L1→L2 at round 3) functional. No re-queue required (systemic issues only). |
| 2026-03-23 | identify-pairs-list | #515 | **8 findings (4a, 0b, 2c, 2d) — FULL BROWSER PLAYTHROUGH — 0 P0s** | 0 P0 flow blockers. MEDIUM: results-screen position:static (13th GEN-UX-001 instance); no aria-live anywhere (16th ARIA-001 instance); no CDN ProgressBar (slots:{progressBar:false}) — custom #points-display used — test harness must use custom selector; data-lives never set on #app (game uses points not lives — test assertions on data-lives will fail). LOW: .number-item min-width:36px (<44px width axis, height 64.8px PASS); no Enter key binding; FeedbackManager subtitle not mounted (CDN warning 16x); FeedbackManager sticker not mounted (CDN warning on end). PASS: CSS intact; Let's go! 47px; Play Again 44px; gameState.gameId='game_identify_pairs_list'; TransitionScreen object API; syncDOMState targets #app; Play Again state reset (points/listIndex/wrongAttempts/gameEnded all clear); game_complete postMessage; window.nextRound exposed; 5 rounds functional; wrong pair detection. No re-queue required (systemic). |
| 2026-03-23 | word-pairs | #529 | **7 browser findings (3 HIGH, 2 MEDIUM, 2 LOW) — FULL BROWSER PLAYTHROUGH — 0 console errors** | Results screen reachable (all 3 rounds completable). No P0 flow blockers. HIGH: buttons 21.5px (CSS strip root cause, UI-WP-B-001); restartGame() leaves stale data-round=3/data-score=11 on #app after Play Again (UI-WP-B-002, test-impact); results-screen element missing data-phase="results" + data-testid (UI-WP-B-003); position:static confirmed (UI-WP-B-004, 8th confirmed instance). MEDIUM: SignalCollector "No problem state" 3× warnings (UI-WP-B-005); waitForPackages 120s not 180s (UI-WP-B-006). CDN: FeedbackManager subtitle skipped 16× (UI-WP-B-007). PASS: endGame() gameEnded-only guard (no isActive block), score=11/12=92% correct, progress bar 0/3→3/3, restartGame() visual reset correct. No re-queue required. |
| 2026-03-23 | associations | #472 | **7 findings (5a, 0b, 0c, 2d) — FULL BROWSER PLAYTHROUGH** | P0: restartGame() no state reset — currentRound=3, score=5 retained after Play Again (3rd confirmed instance). MEDIUM: syncDOMState only sets data-phase on #app (body=null, LP-4 pattern confirmed, 3rd instance); ProgressBar missing slotId (8th GEN-UX-003 instance); no aria-live (13th ARIA-001 instance); results-screen position:static top:64px (10th GEN-UX-001 instance). LOW: gameState.gameId absent (4th live-build GEN-GAMEID instance); timer.getTime repeating error ~20x/game (test gap); waitForPackages 10s timeout (GEN-CDN-TIMEOUT gap). choice-btn 51px PASSES. Play Again 47.5px PASSES. TransitionScreen object API PASS. All 3 rounds complete. Re-queue recommended to verify GEN-RESTART-RESET. |
| 2026-03-23 | count-and-tap | #551 | **10 findings (6a, 1b, 1 retracted, 2d) — FULL BROWSER PLAYTHROUGH** | 0 P0s. CONFIRMED: CSS stripped (UI-CAT-001), buttons 21.5px height (UI-CAT-002), no aria-live (UI-CAT-003), isActive guard anti-pattern (UI-CAT-004). RETRACTED: UI-CAT-006 (CDN TransitionScreen used correctly — no custom #results-screen needed). NEW HIGH: syncDOMState targets #app not body (2nd confirmed instance after real-world-problem — data-phase/lives/round set on #app, body has null); NEW MEDIUM: ProgressBar off-by-one — renderRound(4) shows "4/5" at victory (endGame() never calls final progressBar.update(5, lives)); NEW LOW: wrong-answer CSS feedback invisible due to CSS strip. restartGame() state reset PASS (lives:3, round:0, score:0). All 5 rounds functional. Victory + out-of-lives + Try Again all functional. |
| 2026-03-23 | stats-mode | spec-only | 3 issues (0 P0, 3 low) | No P0 blockers; all 12 critical gen rules PASS; GEN-WINDOW-EXPOSE (PASS); GEN-GAMEID (PASS); GEN-PHASE-001 (PASS); ARIA-001 (PASS); GEN-MOBILE-RESULTS (PASS); GEN-TOUCH-TARGET 52px (PASS); GEN-UX-003 slotId (PASS); FeedbackManager.init() absent (PASS); game_complete both paths (PASS); timer.destroy()+recreate (PASS); progressBar.setRound() (PASS); dual display mode toggle (PASS); F1: Sentry three-script absent (11th warehouse-gap, low); F2: window.gameState double-assign ambiguity (3rd instance of same low-risk pattern); F3: SignalCollector not in spec (GEN-UX-005 shipped, gen prompt handles it). Ready for first build. |
| 2026-03-23 | stats-median | spec-only | 3 issues (1a-low, 0b, 0c, 2d-low) | No P0 blockers; FeedbackManager.init() absent (PASS); gameState.gameId first field (PASS); syncDOMState() full 4-phase machine (PASS); window.endGame/restartGame/loadQuestion assigned (PASS); ARIA aria-live="polite" + role="status" on answer-feedback (PASS); ProgressBar slotId 'mathai-progress-slot' (PASS); game_complete on both paths (PASS); results-screen position:fixed z-index:100 (PASS); option-btn min-height:52px (PASS); timer destroy+recreate in restartGame() (PASS); F1: SignalCollector not instantiated (low — GEN-UX-005 already shipped, gen prompt handles it); F2: Sentry three-script absent (10th instance, warehouse gap, low); F3: window.gameState double-assignment ambiguity (same as stats-mean-direct, low risk). Pre-build checklist: all PASS. |
| 2026-03-23 | stats-mean-direct | spec-only | 2 issues (0a, 0b, 0c, 2d-low) | No P0 blockers; FeedbackManager.init() absent (PASS); gameState.gameId first field (PASS); syncDOMState() full 4-phase machine (PASS); window.endGame/restartGame/loadQuestion assigned (PASS); ARIA live region correct (PASS); ProgressBar slotId correct (PASS); game_complete on both paths (PASS); results-screen position:fixed z-index:100 (PASS); option-btn min-height:52px (PASS); timer destroy+recreate in restartGame() (PASS); F1: window.gameState double-assignment (module scope + DOMContentLoaded end — contradicts Anti-Pattern #2, spec clarification needed, low risk); F2: Sentry v10 three-script absent (9th instance, warehouse gap, low priority) |
| 2026-03-23 | stats-identify-class | spec-only | 6 issues (0a-HIGH, 2b, 3a-low/med, 1d) | No P0; FeedbackManager.init() absent (PASS); window.endGame assigned (PASS); data-phase/syncDOMState full (PASS); gameState.gameId first field (PASS); ProgressBar slotId correct (PASS); ARIA live region correct (PASS); CRITICAL: postMessage type casing conflict Section 13 GAME_COMPLETE vs Section 6.8 game_complete (spec-b fix before build); restartGame() body missing (spec-b addition); SignalCollector not instantiated (7th — GEN-UX-005 shipped, add to spec); got-it-btn/skip-btn min-height absent (12th — GEN-UX-002 shipped); Sentry v10 three-script absent (8th — warehouse template gap); ScreenLayout wait/auto-mount ambiguity (new — test gap) |
|------|------|-------|-------------|---------------|
| 2026-03-23 | addition-mcq | spec-only | 10 issues (7a, 2b, 0c, 1d) | No P0 flow bugs; FeedbackManager.init() absent (PASS); no alert() (PASS); window.endGame unassigned (7th — GEN-WINDOW-EXPOSE shipped); data-phase/syncDOMState absent (6th MCQ spec — ROADMAP); ARIA-001 absent (16th instance — shipped); gameState.gameId absent (7th — GEN-GAMEID shipped); ProgressBar slotId absent (10th — GEN-UX-003 shipped); SignalCollector no args (6th — GEN-UX-005 shipped); results-screen not position:fixed (7th — GEN-UX-001 shipped); game_complete type wrong (spec says game_end — new type-name mismatch finding, spec addition); restartGame() timer not recreated after endGame() destroys it (4th timer game — spec addition); .option-btn min-height absent (11th — GEN-UX-002 shipped, verify .option-btn selector) |
| 2026-03-23 | mcq-addition-blitz | spec-only | 9 issues (6a, 2b, 0c, 1d) | No P0 flow bugs; FeedbackManager.init() absent (PASS); no alert() (PASS); results via TransitionScreen CDN overlay (PASS); window.endGame unassigned (6th instance — GEN-WINDOW-EXPOSE shipped); data-phase/syncDOMState absent (5th MCQ spec instance — ROADMAP line 237); ARIA-001 absent (15th instance — shipped); gameState.gameId absent (6th instance — GEN-GAMEID shipped); ProgressBar slotId absent (9th instance — GEN-UX-003 shipped); SignalCollector no args (5th instance — GEN-UX-005 shipped); game_complete dual-path not explicit (3rd instance — spec addition needed); restartGame() timer destroy unspecified (3rd timer game instance — spec addition needed); .option-btn min-height absent (10th instance — GEN-UX-002 coverage for .option-btn needs verification) |
| 2026-03-23 | math-mcq-quiz | spec-only | 9 issues (6a, 2b, 0c, 1d) | No P0 flow bugs; FeedbackManager.init() absent (PASS); timer pause/resume during audio correctly specified; window.endGame unassigned (5th instance — T1 W3 shipped); data-phase/syncDOMState absent (4th MCQ instance — ROADMAP line 237); ARIA-001 absent (14th instance — shipped); gameState.gameId absent (5th instance — GEN-GAMEID shipped); results screen fixed absent (10th instance — GEN-UX-001 shipped); ProgressBar slotId absent (8th instance — GEN-UX-003 shipped); SignalCollector no args (4th instance — GEN-UX-005 shipped); game_complete dual-path implicit (spec addition — new ROADMAP entry); restartGame() timer destroy unspecified (2nd timer game instance — new ROADMAP entry); Sentry v10 not pinned (low — pending) |
| 2026-03-23 | math-cross-grid | spec-only | 8 issues (5a, 1b, 0c, 2d) | No P0 flow bugs; both end conditions route through endGame(); FeedbackManager.init() called (FAIL — pre-build must fix); results-screen not position:fixed (10th GEN-UX-001 instance); ARIA live region absent (13th ARIA-001 instance); data-phase/syncDOMState absent (4th non-MCQ instance); window.endGame not assigned (4th instance); gameState.gameId absent (4th instance — ship rule now); data-lives not on DOM (3rd instance — test gap); TimerComponent wait unnecessary for no-timer game (low) |
| 2026-03-23 | associations | #513 (approved) | 5 issues (4a, 0b, 0c, 1d) | No P0 flow bugs; CSS intact; ProgressBarComponent no slotId (7th GEN-UX-003 instance); ARIA-001 absent (12th instance — rule shipped); results screen not fixed (9th GEN-UX-001 instance — rule shipped); gameState.gameId absent (3rd instance — escalate to ship); choice-btn no min-height (9th GEN-UX-002 instance — extend rule to non-.game-btn buttons); test gap: no Playwright assertion for choice-btn min-height |
| 2026-03-23 | adjustment-strategy | #385 (approved) | 7 issues (5a, 0b, 0c, 2d) | No P0 flow bugs; all phases reachable; adj-btn 36px (8th GEN-UX-002 gap); ARIA-001 absent (11th instance); results static (8th GEN-UX-001); gameState.gameId absent (2nd); no Enter key on answer-input (2nd — ship now); window.nextRound missing (test gap); reset-btn 30.5px (secondary button gap, overlaps F1) |
| 2026-03-23 | addition-mcq | spec-only | 9 issues (6a, 2b, 1d) | No P0 blockers; ProgressBar slotId missing (6th instance); data-phase/syncDOMState absent (3rd MCQ spec); ARIA-001 (10th instance); window.endGame unassigned; data-lives not on DOM (2nd MCQ spec test gap); gameState.gameId missing; SignalCollector no constructor args (3rd); timer destroy/recreate ambiguity; initSentry absent from spec |
| 2026-03-23 | addition-mcq-lives | spec-only | 6 issues (4a, 2b, 1d; F4 downgraded) | No P0 blockers; data-phase/syncDOMState absent (9th pattern, 2nd MCQ spec); ProgressBar slotId missing (5th); ARIA-001 MCQ (9th); endGame branching implicit; restartGame() unspecified; data-lives not on DOM (test gap) |
| 2026-03-23 | addition-mcq-blitz | spec-only | 8 issues (6a, 2b) | FeedbackManager.init() in spec (URGENT — fix before first build); results not fixed (8th instance); ARIA-001 (8th instance); timer.start() race in setupGame(); recordViewEvent after seal() data loss; window.endGame unassigned; no syncDOMState/data-phase; gameState.gameId undeclared |
| 2026-03-23 | real-world-problem | #564 | **12 issues (7a, 2b, 1c, 2d) — FULL BROWSER PLAYTHROUGH** | 0 P0s. CONFIRMED: buttons 41px, results-screen position:static rectTop:80 coversViewport:false, ProgressBar slotId 'mathai-progress-bar-slot' (console WARNING), SignalCollector sealed on restart (signal loss), Enter key unbound (onkeydown=null), SVG "wall height(?)" at x=360 clips. NEW: syncDOMState() targets #app not body (HIGH test gap — Playwright body[data-phase] assertions all fail); Play Again button 41px; Sentry 404 (12th instance). All 4 rounds functional. All 3 steps per round functional. restartGame() correctly resets lives/score/round/wrongOnStep3. |
| 2026-03-23 | name-the-sides | #557 | 10 issues (5a, 3b, 2 low) | 5 gen prompt rules proposed; 3 spec additions documented; rebuild needed |
| 2026-03-23 | which-ratio | #560 | 8 issues (4a, 2b, 2c) | 4 gen prompt rules proposed; 2 spec additions documented; 2 CDN constraints noted |
| 2026-03-23 | which-ratio | #561 | **10 issues (5a, 2b, 1c, 2 NEW P0) — FULL BROWSER PLAYTHROUGH** | P0-A: `transitionScreen.show('victory',...)` not supported by CDN — victory screen blank, no Play Again. P0-B: SVG markup in `icons[]` HTML-escaped, start screen shows raw code. NEW medium: `totalLives:0` → ProgressBar RangeError ×5. Confirmed: we-btn 40.5px (<44px FAIL), aria-live absent, correct-feedback 1200ms. Re-queue required after gen prompt rule fixes. |
| 2026-03-23 | which-ratio | #561 | 7 issues (4a, 2b, 1c) | CSS stripping resolved; 4 gen prompt rules confirmed pending in ROADMAP.md; 2 spec additions proposed; 1 CDN constraint unchanged |
| 2026-03-23 | count-and-tap | #551 | 7 issues (4a, 1b, 2 low) | CSS strip CRITICAL confirmed; ARIA-001 extension proposed; 44px gap confirmed 3rd instance; dead-code guard new rule proposed; dot-warning spec addition; all handoffs routed |
| 2026-03-23 | find-triangle-side | #549 | **12 issues (8a, 0b, 2 retracted) — FULL BROWSER PLAYTHROUGH** | P0 (NEW): restartGame() does not reset gameState — lives=2, round=5, score=50 retained after Play Again (2nd confirmed instance of UI-QF-NEW-001 pattern). NEW medium: Enter key not bound on numeric input. UI-FTS-005 (local asset) browser-confirmed: broken SVG icon text overlays restart start screen. All 7 static-analysis UI-FTS-001–007 confirmed. UI-FTS-008 RETRACTED (formula overflow not observed on 480px). UI-FTS-009 PARTIALLY RETRACTED (heading shows "Great Job!" not always "Congratulations!"). Results: position:static, rectTop:45px, coversViewport:false. aria-live:[]. Buttons 39px. Re-queue required. |
| 2026-03-23 | quadratic-formula-worked-example | #546 | P0+5 findings (1P0, 1P1, 3 confirmed-from-static) | **P0 UI-QF-001: results screen off-screen** — body flex-row layout pushes #results-screen out of viewport; computed width 208px, position:static, z-index:auto. GEN-UX-001 already shipped. **P1 UI-QF-NEW-001: restartGame() doesn't reset full gameState** — lives/currentRound/score/attempts not reset; second session starts wrong. New gen rule added to ROADMAP. 3 browser-confirmed: ARIA-001 absent (#faded-feedback + #practice-feedback ariaLive:null), ProgressBar wrong slotId ('mathai-progress-bar-slot'), .btn-option min-height:auto. 8/12 critical rules PASS: data-phase transitions, data-lives deduction, data-round increment, game flow, CDN load, zero PAGEERRORs. Full browser playthrough complete: 3 rounds × 3 sub-phases, wrong answers tested in both phases, results + restart tested. |
| 2026-03-23 | quadratic-formula-worked-example | #546 | **11 issues (6a, 0b, 1c, 4 low) — FULL BROWSER PLAYTHROUGH** | 4 FAIL / 8 PASS on gen rules. P0 (browser-confirmed): results-screen renders off-screen as body flex-sibling (~209px wide) — ScreenLayout sets body flex-row, position:static is broken; GEN-UX-001 4th+ instance. ARIA-001 confirmed (both feedback divs ariaLive:null). Slot ID wrong ('mathai-progress-bar-slot'). min-height:auto on .btn-option (45px computed only). NEW: restartGame() doesn't reset lives/round/score (data-lives=2, data-round=3 after restart). All handoffs routed to Gen Quality + Test Engineering. |
| 2026-03-23 | soh-cah-toa-worked-example | #544 | 7 issues (5a, 1b, 1 low) | CSS intact — cleanest build in batch; results not fixed (4th); ARIA-001 (5th); slot ID options missing key; min-height 44px (5th); hide()/show() string selector bug found; formula accessibility spec addition |
| 2026-03-23 | right-triangle-area | #543 | 9 issues (7a, 1b, 1c) | CSS STRIPPED (4th instance); canvas 500px > 480px new rule; undefined CSS vars for feedback color; ProgressBar hash-prefix slot ID (4th); ARIA-001 (6th); results not fixed (5th); FeedbackManager.sound.play non-standard API; Google Fonts dependency |
| 2026-03-23 | word-pairs | #529 | 8 issues (5a, 1b, 1d, 1 low) | CSS STRIPPED (5th instance); ARIA-001 (7th); results not fixed (6th); data-testid/id mismatch; data-lives hardcoded 0; Sentry SDK v7 vs v10 inconsistency; no learn-phase countdown spec addition |

---

## stats-mode Audit (2026-03-23)

See [games/stats-mode/ui-ux.md](../../games/stats-mode/ui-ux.md)

**Spec-only audit — no build in DB.** 3 findings (0 P0, 0 high, 3 low). Cleanest spec audited. All 12 critical gen rules correctly pre-applied. Dual display mode (ungrouped number list vs grouped frequency table) handled explicitly in Section 5 HTML, Section 7.2 loadQuestion(), and TC-016/TC-017. No pre-build fixes required. F1: Sentry three-script absent (11th warehouse-gap instance, low). F2: window.gameState double-assignment ambiguity (3rd instance of same low-risk pattern seen in stats-mean-direct + stats-median). F3: SignalCollector not in spec (GEN-UX-005 shipped, gen prompt covers it).

---

## stats-median Audit (2026-03-23)

See [games/stats-median/ui-ux.md](../../games/stats-median/ui-ux.md)

**Spec-only audit — no build in DB.** 3 findings (1a-low, 0b, 0c, 2d-low). Tied with stats-mean-direct as cleanest spec audited to date. All 12 critical gen rules correctly pre-applied. No P0 blockers. Ready for first build without pre-build fixes. F1: SignalCollector not instantiated (GEN-UX-005 already shipped, gen prompt handles it — low risk). F2: Sentry three-script absent (10th warehouse-gap instance, low). F3: window.gameState double-assignment ambiguity (same low-risk pattern as stats-mean-direct).

---

## name-the-sides Audit (2026-03-23)

See [warehouse/templates/name-the-sides/ui-ux.md](../../warehouse/templates/name-the-sides/ui-ux.md)

---

## which-ratio Audit #560 (2026-03-23)

See [games/which-ratio/ui-ux.md](../../games/which-ratio/ui-ux.md) — Build #560 section

## which-ratio Audit #561 (2026-03-23)

See [games/which-ratio/ui-ux.md](../../games/which-ratio/ui-ux.md) — Build #561 section (latest)

**CSS stripping resolved.** 7 remaining issues: 4 gen prompt rules (all already in ROADMAP.md R&D backlog), 2 spec additions, 1 CDN constraint. No re-queue needed.

## count-and-tap Audit #551 (2026-03-23)

See [games/count-and-tap/ui-ux.md](../../games/count-and-tap/ui-ux.md)

**CSS fully stripped — CRITICAL.** Build approved with entire stylesheet stripped to a single comment. FIX-001 + PART-028 T1 check (dc03155) is the intended prevention. 7 total issues: 4 gen prompt rules (CSS strip, ARIA-001 extension, 44px buttons, dead-code guard), 1 spec addition (dot warning), 2 low. All handoffs routed to ROADMAP.md.

## find-triangle-side Audit #549 (2026-03-23)

See [games/find-triangle-side/ui-ux.md](../../games/find-triangle-side/ui-ux.md)

**Results screen static-position — CRITICAL.** CSS present and intact. 10 total issues: 6 gen prompt rules (results fixed, wrong slot ID, no ARIA, 44px buttons, local asset path, SignalCollector args), 2 spec additions (formula formatting, mobile overflow), 2 low. 4 new ROADMAP R&D entries added.

## quadratic-formula-worked-example Audit #546 (2026-03-23)

See [games/quadratic-formula-worked-example/ui-ux.md](../../games/quadratic-formula-worked-example/ui-ux.md)

**CSS intact.** 8 issues: 5 gen prompt rules (results not fixed — 3rd instance, ARIA-001 — 4th instance, ProgressBar slot string wrong — 3rd instance, min-height 44px — 4th instance, postMessage path inconsistency), 1 CDN constraint (layout via ScreenLayout), 2 low. Results screen rule and ARIA-001 now at 3-4 confirmed instances — ship both immediately.

## soh-cah-toa-worked-example Audit #544 (2026-03-23)

See [games/soh-cah-toa-worked-example/ui-ux.md](../../games/soh-cah-toa-worked-example/ui-ux.md)

**CSS intact — cleanest build in batch.** 7 issues: 5 gen prompt rules (results not fixed — 4th instance, ARIA-001 — 5th instance, ProgressBar options missing slotId key, min-height 44px — 5th instance, hide()/show() string selector bug), 1 spec addition (formula accessibility), 1 low. ARIA-001 and results screen rule both at 4-5 confirmed instances — must ship.

## right-triangle-area Audit #543 (2026-03-23)

See [games/right-triangle-area/ui-ux.md](../../games/right-triangle-area/ui-ux.md)

**CSS STRIPPED — CRITICAL (4th confirmed instance).** 9 issues: 7 gen prompt rules (CSS strip — FIX-001 pre-dates PART-028, canvas 500px > 480px new rule, undefined CSS vars for feedback color, ProgressBar hash-prefix slot ID — 4th instance, ARIA-001 — 6th instance, results not fixed — 5th instance, FeedbackManager.sound.play non-standard API), 1 spec addition (Google Fonts dependency), 1 CDN constraint. New rules: canvas max-width and CSS variable consistency.

## word-pairs Audit #529 (2026-03-23)

See [games/word-pairs/ui-ux.md](../../games/word-pairs/ui-ux.md)

**CSS STRIPPED — CRITICAL (5th confirmed instance, 2 style blocks both stripped).** 8 issues: 5 gen prompt rules (CSS strip — pre-PART-028, ARIA-001 — 7th instance, results not fixed — 6th instance, data-testid/id mismatch new rule, Sentry v7 vs v10 standardisation), 1 spec addition (learn-phase countdown), 1 test gap (data-lives hardcoded 0), 1 low. ARIA-001 now at 7 confirmed instances — immediate ship required.

## real-world-problem Audit #564 (2026-03-23)

See [games/real-world-problem/ui-ux.md](../../games/real-world-problem/ui-ux.md)

**CSS intact. No P0 flow bugs. All three steps reachable. End screen reachable.** 8 issues: 6 gen prompt rules (44px min-height — 7th instance; results not fixed — 7th instance; ProgressBar `-bar-` slotId — 4th instance; SignalCollector no args — 2nd instance; alert() for validation — new; no Enter key on numeric input — new), 2 education/test handoffs (accuracy metric scope, SVG label overflow). 44px and results-screen rules now at 7 confirmed instances each — ship both immediately.

## adjustment-strategy Audit #385 (2026-03-23)

See [games/adjustment-strategy/ui-ux.md](../../games/adjustment-strategy/ui-ux.md)

**CSS intact. No P0 flow bugs. All phases reachable end-to-end.** 7 issues: 5 gen prompt rules (adj-btn/reset-btn secondary button 44px gap — 8th GEN-UX-002 instance; ARIA-001 — 11th instance, already shipped; results static — 8th GEN-UX-001 instance, already shipped; gameState.gameId absent — 2nd instance; no Enter key on answer-input — 2nd instance, ship now), 2 test gaps (window.nextRound missing; secondary button min-height not caught by test assertions). ProgressBar slotId correct, FeedbackManager.init() absent, CSS intact, all data-phase transitions working.

---

## mcq-addition-blitz Audit (2026-03-23)

See [games/mcq-addition-blitz/ui-ux.md](../../games/mcq-addition-blitz/ui-ux.md)

**Spec-only audit — no approved build exists (0 builds in DB).** 9 actionable issues (6a, 2b, 0c, 1d). No P0 blockers: FeedbackManager.init() absent (PASS); no alert(); both end states use TransitionScreen CDN overlay — no custom static results div. Key issues: (1) F1 — window.endGame not assigned (6th instance — GEN-WINDOW-EXPOSE shipped); (2) F2 — no data-phase/syncDOMState at phase transitions (5th MCQ spec instance — ROADMAP line 237); (3) F3 — no ARIA live region (15th instance — ARIA-001 shipped); (4) F4 — gameState.gameId absent (6th instance — GEN-GAMEID shipped); (5) F5 — ProgressBar slotId absent (9th instance — GEN-UX-003 shipped); (6) F6 — SignalCollector no constructor args (5th instance — GEN-UX-005 shipped); (7) F7 — game_complete dual-path not explicit (3rd instance — spec addition needed before first build); (8) F8 — restartGame() timer destroy unspecified (3rd timer game instance — spec addition needed); (9) F9 — .option-btn min-height absent (10th instance — verify GEN-UX-002 selector covers .option-btn). Pre-build checklist added to ui-ux.md.

---

## math-mcq-quiz Audit (2026-03-23)

See [games/math-mcq-quiz/ui-ux.md](../../games/math-mcq-quiz/ui-ux.md)

**Spec-only audit — no approved build exists (0 builds in DB).** 9 actionable issues (6a, 2b, 0c, 1d). No P0 flow bugs: no FeedbackManager.init(), no alert()/confirm(), timer behaviour correctly specified (pause during audio, destroy in endGame), VisibilityTracker correctly specified. Key issues: (1) F1 — window.endGame not assigned (5th instance — T1 W3 shipped); (2) F2 — no data-phase/syncDOMState at any phase transition (4th MCQ spec instance — ROADMAP line 237); (3) F3 — no ARIA live region for option feedback (14th ARIA-001 instance — shipped c826ec1); (4) F4 — gameState.gameId absent from initial declaration (5th instance — GEN-GAMEID shipped); (5) F5 — results screen position:fixed not specified (10th GEN-UX-001 instance — shipped); (6) F6 — ProgressBar slotId not specified (8th instance — GEN-UX-003 shipped); (7) F7 — SignalCollector no constructor args (4th instance — GEN-UX-005 shipped); (8) F8 — game_complete dual-path (victory + game-over) not explicit in spec (new ROADMAP entry — spec addition before first build); (9) F9 — restartGame() timer destroy+recreate not specified (2nd timer game instance — new ROADMAP entry); (10) F10 — Sentry v10 not pinned (low — pending). All 6 gen prompt findings already have shipped rules (no new ROADMAP entries needed for type-a). Two spec additions added to ROADMAP.

---

## math-cross-grid Audit (2026-03-23)

See [games/math-cross-grid/ui-ux.md](../../games/math-cross-grid/ui-ux.md)

**Spec-only audit — no approved build exists (0 builds in DB).** 8 actionable issues (5a, 1b, 0c, 2d). No P0 flow bugs: both end conditions route through `endGame()` which sends `game_complete`; drag-and-drop interaction well-specified; touch targets adequate (64px tiles, 58px cells). Key issues: (1) F1 — FeedbackManager.init() explicitly called in init sequence (banned API — must be removed before first build; T1 should catch); (2) F2 — results-screen not position:fixed (10th GEN-UX-001 instance — rule shipped 2026-03-23); (3) F3 — no aria-live region for drag-and-drop feedback (13th ARIA-001 instance — rule shipped); (4) F4 — no data-phase / syncDOMState at phase transitions (4th non-MCQ instance); (5) F5 — window.endGame not assigned (4th instance); (6) F6 — gameState.gameId absent from initial declaration (4th instance — ship rule now); (7) F7 — data-lives not on DOM for lives=2 game (3rd test gap instance); (8) F8 — TimerComponent wait in waitForPackages for no-timer game (low). ProgressBar slotId correct. SignalCollector constructor args correct.

---

## associations Audit #513 (2026-03-23)

See [games/associations/ui-ux.md](../../games/associations/ui-ux.md)

**CSS intact. No P0 flow bugs. All phases reachable.** 5 issues: 4 gen prompt rules (ProgressBarComponent no slotId — 7th instance; ARIA-001 no text feedback element — 12th instance; gameState.gameId absent — 3rd live-build instance, ship rule now; results screen not position:fixed — 9th instance), 1 test gap (no Playwright assertion for choice-btn computed min-height). All rules (GEN-UX-001/002/003, ARIA-001) already shipped — this build predates them. gameState.gameId rule at 3 instances — escalate to ship immediately.

---

## addition-mcq Audit (2026-03-23)

See [games/addition-mcq/ui-ux.md](../../games/addition-mcq/ui-ux.md)

**Spec-only audit — no build exists.** 9 actionable issues (6a, 2b, 1d). No P0 blockers: no FeedbackManager.init(), no alert(), endGame() called on both win and game-over paths, restartGame() defined, results screen uses PART-019. Key issues: (1) F1 — ProgressBar slotId missing (6th confirmed instance — GEN-UX-003 shipped but spec still lacks it; add before first build); (2) F2 — no data-phase / syncDOMState (3rd confirmed MCQ spec instance); (3) F3 — no ARIA live region on option feedback (10th instance — ARIA-001 shipped); (4) F4 — window.endGame unassigned; (5) F5 — data-lives not on DOM (2nd MCQ spec test gap); (6) F6 — gameState.gameId absent; (7) F7 — SignalCollector no constructor args (3rd instance — GEN-UX-005 shipped); (8) F8 — timer destroy/recreate ambiguity on restartGame(); (9) F9 — initSentry() absent from spec. Pre-build checklist added to ui-ux.md.

## addition-mcq-lives Audit (2026-03-23)

See [games/addition-mcq-lives/ui-ux.md](../../games/addition-mcq-lives/ui-ux.md)

**Spec-only audit — no build exists.** 6 actionable issues (4a, 2b, 1d; F4 initialization order downgraded). No P0 blockers: no FeedbackManager.init(), no results-screen static position violation, window.endGame assigned per spec Section 8, CSS well-formed. Key issues: (1) F1 — no data-phase / syncDOMState at any transition (2nd confirmed MCQ spec instance; already in ROADMAP line 237); (2) F2 — ProgressBar slotId missing (5th confirmed instance — escalate to ship now); (3) F3 — no ARIA live region on MCQ feedback (9th instance — ARIA-001 shipped, T1 will catch it on first build); (4) F5 — endGame dual-path not explicit (spec addition needed before queuing); (5) F6 — restartGame() unspecified for timer game (spec addition needed); (6) F7 — data-lives not on DOM element (test gap). Pre-build checklist added to ui-ux.md. ProgressBar slotId pattern at 5 confirmed instances — ship rule immediately.

---

## Known Visual Issue Patterns

| Pattern | First seen | Also seen in | Classification | Status |
|---------|-----------|-------------|---------------|--------|
| CSS stylesheet stripped during JS-only surgical fix | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | (a) gen prompt rule + T1 check | FIX-001 shipped 2026-03-23; PART-028 T1 deployed 2026-03-22; 5 confirmed instances |
| Dynamic feedback elements missing aria-live | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513, math-mcq-quiz spec, mcq-addition-blitz spec, keep-track #503 | (a) gen prompt rule | **ARIA-001 expanded SHIPPED 2026-03-23 (c826ec1)** — rule covers ALL dynamic feedback elements (not just #feedback): #feedback-panel, #faded-feedback, #practice-feedback, #feedback-area, #answer-feedback, #result-feedback, #hint-text; requires role="status"; T1 W5 regex broadened; 4 new tests; **16 confirmed instances** |
| Option buttons missing explicit 44px touch targets | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, real-world-problem #564, associations #513, mcq-addition-blitz spec | (a) gen prompt rule | **SHIPPED — GEN-UX-002 / GEN-TOUCH-TARGET (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 121 + rule 32**; GEN-UX-002 targets .game-btn — NOTE: associations choice-btn (.choice-btn) and mcq-addition-blitz .option-btn are not covered by this class selector — rule needs extension to cover all interactive button classes; **10 confirmed instances** |
| SVG muted lines using low-contrast colour (#64748b) | which-ratio #560 | find-triangle-side #549 | (a) gen prompt rule | Pending — 2 confirmed instances |
| Results screen is static-position (not overlay) | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, associations #513, math-mcq-quiz spec, keep-track #503 | (a) gen prompt rule | **SHIPPED — GEN-UX-001 / GEN-MOBILE-RESULTS (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 120 + rule 31**; **11 confirmed instances** |
| progressBar.update() emits Invalid count value error | name-the-sides #557 | — | (a) gen prompt rule | Proposed |
| CSS-trick triangle (border-based) breaks without CSS | name-the-sides #557 | — | (a) gen prompt rule | Proposed — prefer SVG |
| Two-triangle layout on mobile causes excessive scroll | name-the-sides #557 | — | (b) spec addition | Proposed |
| Wrong ProgressBarComponent slot ID (positional string, hash-prefix, or missing slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513, math-mcq-quiz spec, mcq-addition-blitz spec | (a) gen prompt rule | SHIPPED — GEN-UX-003 (25bdad0 2026-03-23) — **9 confirmed instances** |
| Local asset path in TransitionScreen icons | find-triangle-side #549 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| SignalCollector instantiated without constructor args | find-triangle-side #549 | real-world-problem #564, addition-mcq spec, math-mcq-quiz spec, mcq-addition-blitz spec | (a) gen prompt rule | SHIPPED — GEN-UX-005 (25bdad0 2026-03-23) — **5 confirmed instances** |
| Dead-code guard: isActive set false then immediately true | count-and-tap #551 | — | (a) gen prompt rule | New — added to ROADMAP 2026-03-23 |
| Canvas element wider than 480px mobile viewport | right-triangle-area #543 | — | (a) gen prompt rule | New — canvas must use max-width: 100% |
| Undefined CSS variable tokens used for feedback color | right-triangle-area #543 | — | (a) gen prompt rule | New — only use --mathai-success, --mathai-error, --mathai-warning |
| FeedbackManager.sound.play() non-standard API path | right-triangle-area #543 | — | (a) gen prompt rule | New — verify PART-011-SOUND covers this; ban if not |
| data-testid does not match element id | word-pairs #529 | — | (a) gen prompt rule | New — testid must match id; no divergence |
| Sentry SDK version inconsistency (v7 vs v10) | word-pairs #529 | — | (a) gen prompt rule | New — standardise to v10.23.0 three-script pattern |
| hide()/show() helpers called with CSS selector strings instead of DOM elements | soh-cah-toa #544 | — | (a) gen prompt rule | New — helpers must receive element objects only |
| alert() used for inline input validation | real-world-problem #564 | — | (a) gen prompt rule | SHIPPED — GEN-UX-004 (25bdad0 2026-03-23) — 1 confirmed instance (new) |
| Typed numeric input has no Enter-key submission handler | real-world-problem #564 | — | (a) gen prompt rule | New — input fields must bind keydown Enter → submit handler |
| data-lives hardcoded to 0 for non-lives games | word-pairs #529 | — | (d) test gap | New — test assertions on data-lives must handle games with totalLives: 0 |
| Custom widget buttons (adj-btn, reset-btn) bypass min-height: 44px rule | adjustment-strategy #385 | — | (a) gen prompt rule | New — GEN-UX-002 only covers .game-btn; secondary/custom buttons need min-height: 44px too; adj-btn=36px, reset-btn=30.5px |
| gameState.gameId absent from gameState object | adjustment-strategy #385 | addition-mcq spec, associations #513, math-cross-grid spec, math-mcq-quiz spec, mcq-addition-blitz spec | (a) gen prompt rule | **6th confirmed instance (mcq-addition-blitz spec)** — mandatory gameId field not in initial gameState declaration; set only conditionally via postMessage; GEN-GAMEID shipped |
| Typed numeric input has no Enter key submission | adjustment-strategy #385 | real-world-problem #564 | (a) gen prompt rule | 2nd confirmed instance — ship now per ROADMAP line 430 |
| window.nextRound not exposed; harness warns MISSING | adjustment-strategy #385 | — | (d) test gap | Game uses loadRound() internally; window.nextRound alias never assigned; harness fallback may cover via window.loadRound |
| Lives games missing data-lives attribute on DOM element | addition-mcq-lives spec | addition-mcq spec, math-cross-grid spec | (d) test gap | 3 confirmed instances — lives games must sync data-lives via syncDOMState(); getLives() harness helper needs a DOM attribute to read |
| No syncDOMState() / data-phase state machine in MCQ spec | addition-mcq-blitz spec | addition-mcq-lives spec, addition-mcq spec, math-mcq-quiz spec, mcq-addition-blitz spec | (a) gen prompt rule | **5 confirmed MCQ spec instances** — already in ROADMAP (line 237); 5th instance confirmed 2026-03-23 |
| No data-phase / syncDOMState in drag-and-drop spec | math-cross-grid spec | — | (a) gen prompt rule | 1st confirmed non-MCQ drag-and-drop instance — game has two phases (gameplay → results) with no data-phase or syncDOMState; pattern extends beyond MCQ games |
| endGame() dual-path not specified: game-over vs victory TransitionScreen calls differ | addition-mcq-lives spec | math-mcq-quiz spec, mcq-addition-blitz spec | (b) spec addition | **3rd confirmed instance (mcq-addition-blitz spec)** — lives games need explicit if/else branching in endGame() for two different TransitionScreen templates; game_complete postMessage must fire on both paths; ROADMAP entry added |
| restartGame() unspecified for timer games — destroy+recreate required | addition-mcq-lives spec | math-mcq-quiz spec, mcq-addition-blitz spec | (b) spec addition | **3rd confirmed timer game instance (mcq-addition-blitz spec)** — timer games must destroy and recreate TimerComponent in restartGame() to clear stale onEnd callbacks; ROADMAP entry added |
| waitForPackages() awaits packages not used by the game | math-cross-grid spec | — | (a) gen prompt rule | Low — waitForPackages polls for TimerComponent but spec says Timer: None; unnecessary CDN wait that could cause timeout if component is unavailable |
| window.endGame not assigned to window | math-cross-grid spec | math-mcq-quiz spec, mcq-addition-blitz spec | (a) gen prompt rule | **6th confirmed instance (mcq-addition-blitz spec)** — endGame() defined as local function never exposed on window; harness calls window.endGame() to force end-game in tests; T1 W3 shipped; GEN-WINDOW-EXPOSE rule 36 shipped |
| `transitionScreen.show()` called with two args (string + config object) — all screens blank | which-ratio #561 (victory only) | keep-track #503 (ALL screens) | (a) gen prompt rule | GEN-TS-ONEARG / GEN-TRANSITION-API-001 — T1 ERROR shipped (validate-static.js §5h2, commit 2dee3b8 2026-03-23). `show()` takes one arg only: the config object. Passing a string as first arg gives title/buttons/icons all undefined → blank screen, no buttons. keep-track #503 broke every `show()` call (start, between-round, game-over, victory, restart). **2 confirmed instances** |
| Interactive game elements rendered as `<div>` without role/tabindex/aria-label | keep-track #503 | — | (a) gen prompt rule | GEN-INTERACTIVE-DIV-ROLE (NEW) — cup containers are `<div class="cup-container">` with no `role="button"`, no `tabindex="0"`, no `aria-label`. Keyboard users cannot tab to or activate game targets. Rule: any clickable/tappable element that is not `<button>` must have `role="button"` + `tabindex="0"` + descriptive `aria-label`. Preferred: use `<button>` elements. **1 confirmed instance** |
| Timer display hardcoded non-brand color (#000FFF) | keep-track #503 | — | (a) gen prompt rule | GEN-TIMER-COLOR (NEW) — `#timer-container { color: #000FFF }` cascades to CDN TimerComponent `.timer-display` → computed `rgb(0, 15, 255)` (near-pure blue). Should use CSS variable `var(--mathai-black)` or `#333333`. Likely typo for `#000000`. **1 confirmed instance** |

---

## Gen Prompt Rules Added via UI/UX Slot

*(Track which CDN_CONSTRAINTS_BLOCK rules originated from UI/UX audits)*

| Rule | Source audit | Confirmed also in | Date | Status |
|------|-------------|------------------|------|--------|
| Never strip CSS stylesheet | which-ratio #560 | name-the-sides #557, count-and-tap #551, right-triangle-area #543, word-pairs #529 | 2026-03-23 | FIX-001 shipped (dc03155) + PART-028 T1 check — 5 instances confirmed |
| Explicit 44px touch targets on all buttons | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, real-world-problem #564, mcq-addition-blitz spec | 2026-03-23 | **SHIPPED — GEN-UX-002 / GEN-TOUCH-TARGET (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 121 + rule 32**; selector covers .game-btn only — PENDING extension to .choice-btn, .option-btn, .adj-btn; **10 confirmed instances** |
| ARIA live regions on dynamic feedback | which-ratio #560 | name-the-sides #557, count-and-tap #551, find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564, addition-mcq-lives spec, addition-mcq spec, associations #513 | 2026-03-23 | **ARIA-001 expanded SHIPPED (c826ec1 2026-03-23)** — **12 confirmed instances**; rule now covers ALL dynamic feedback variants + role="status"; T1 W5 regex broadened; 4 new tests; temp-file race in test helper fixed |
| SVG diagram contrast + fallback dimensions | which-ratio #560 | find-triangle-side #549 | 2026-03-23 | Pending — 2 confirmed instances |
| Results screen must be position:fixed full-screen overlay | name-the-sides #557 | find-triangle-side #549, quadratic-formula #546, soh-cah-toa #544, right-triangle-area #543, word-pairs #529, real-world-problem #564 | 2026-03-23 | **SHIPPED — GEN-UX-001 / GEN-MOBILE-RESULTS (2026-03-23) — CDN_CONSTRAINTS_BLOCK line 120 + rule 31** |
| progressBar.update() completed arg must be >= 0 | name-the-sides #557 | — | 2026-03-23 | Proposed — not yet in prompts.js |
| ProgressBarComponent slot ID must be 'mathai-progress-slot' (options object with slotId key) | find-triangle-side #549 | quadratic-formula #546, right-triangle-area #543, real-world-problem #564, addition-mcq-lives spec | 2026-03-23 | SHIPPED — GEN-UX-003 (25bdad0 2026-03-23) — 5 confirmed instances |
| Never use local asset paths in TransitionScreen icons | find-triangle-side #549 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Always pass constructor args to SignalCollector | find-triangle-side #549 | real-world-problem #564, addition-mcq spec, math-mcq-quiz spec, mcq-addition-blitz spec | 2026-03-23 | SHIPPED — GEN-UX-005 (25bdad0 2026-03-23) — **5 confirmed instances** |
| Never negate isActive guard immediately (dead code) | count-and-tap #551 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Canvas elements must use max-width: 100%; height: auto for responsive layout | right-triangle-area #543 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Only use defined CSS variable tokens for feedback colors | right-triangle-area #543 | — | 2026-03-23 | New — ban --color-orange, --mathai-green; use --mathai-success/error/warning |
| data-testid must match element id exactly | word-pairs #529 | — | 2026-03-23 | New — added to ROADMAP 2026-03-23 |
| Standardise Sentry SDK to v10.23.0 three-script pattern | word-pairs #529 | — | 2026-03-23 | New — word-pairs uses v7; CDN_CONSTRAINTS_BLOCK must enforce v10 |
| hide()/show() helpers must receive DOM element objects, not CSS selector strings | soh-cah-toa #544 | — | 2026-03-23 | New — runtime TypeError if string passed to classList |
| Never use alert()/confirm() in game code; use inline aria-live feedback div | real-world-problem #564 | — | 2026-03-23 | SHIPPED — GEN-UX-004 (25bdad0 2026-03-23) — 1 confirmed instance (new) |
| Typed numeric input fields must support Enter key as submit equivalent | real-world-problem #564 | adjustment-strategy #385 | 2026-03-23 | **2nd confirmed instance — SHIP NOW** — keyboard/mobile UX gap; answer-input in adjustment-strategy also has no Enter listener |
| gameState must declare gameId field | adjustment-strategy #385 | addition-mcq spec | 2026-03-23 | 2nd confirmed instance — `window.gameState.gameId` undefined in both; add to CDN_CONSTRAINTS_BLOCK and spec Section 3 |
| Secondary/custom widget buttons (adj-btn, reset-btn) exempt from min-height: 44px | adjustment-strategy #385 | — | 2026-03-23 | New — GEN-UX-002 only covers .game-btn; adj-btn=36px, reset-btn=30.5px; extend rule to all interactive buttons |
| `transitionScreen.show()` MUST be called with one arg (config object only) | which-ratio #561 | keep-track #503 | 2026-03-23 | SHIPPED — GEN-TRANSITION-API-001 T1 check (validate-static.js §5h2, commit 2dee3b8). String-mode breaks all screens. **2 confirmed instances** |
| Clickable game elements (cups, cards, tiles) must be `<button>` or have role=button+tabindex+aria-label | keep-track #503 | — | 2026-03-23 | New — GEN-INTERACTIVE-DIV-ROLE. Cup containers are `<div>` with no keyboard accessibility. Add to CDN_CONSTRAINTS_BLOCK. **1 confirmed instance** |
| Timer display color must use CSS variable, not hardcoded hex like #000FFF | keep-track #503 | — | 2026-03-23 | New — GEN-TIMER-COLOR. `#timer-container { color: #000FFF }` cascades to CDN TimerComponent → blue display. Use `var(--mathai-black)`. **1 confirmed instance** |
