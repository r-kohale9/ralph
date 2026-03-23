# Games Index

*Human entry point for all Ralph pipeline games. Each row links to the per-game decision dashboard.*

| Game | Session | Bloom | Status | Build # | Iter | Build Time | UI/UX | Next Action |
|------|---------|-------|--------|---------|------|------------|-------|-------------|
| [stats-identify-class](stats-identify-class/index.md) | Stats 1/5 | L1 Remember | 📝 Spec ready | — | — | — | ✅ 6 findings | Spec fixes applied (FIX-1 through FIX-5, commit 6f4bf51) — human approval needed to queue |
| [stats-mean-direct](stats-mean-direct/index.md) | Stats 2/5 | L2-L3 Apply | 📝 Spec ready | — | — | — | ✅ 2 findings | Human review before queuing |
| [stats-median](stats-median/index.md) | Stats 3/5 | L3 Apply | 📝 Spec ready | — | — | — | ✅ 3 findings | Human review before queuing |
| [stats-mode](stats-mode/index.md) | Stats 4/5 | L3 Apply | 📝 Spec ready | — | — | — | ✅ 3 findings | Human review before queuing |
| [stats-which-measure](stats-which-measure/index.md) | Stats 5/5 | L4 Analyze | 📝 Spec ready | — | — | — | ❌ Pending | Human review before queuing |
| [name-the-sides](name-the-sides/index.md) | Trig 1/5 | L2 Understand | ✅ Approved | #562 | 3 | ~35 min | ✅ 10 findings | — |
| [which-ratio](which-ratio/index.md) | Trig 2/5 | L2 Understand | ✅ Approved | #561 | 3 | ~28 min | ⚠️ 3 P0s + 8 issues | Gen rules 45/46/47 shipped (c0d5391). Re-queue to verify P0 fixes (GEN-TRANSITION-API, GEN-TRANSITION-ICONS, GEN-PROGRESSBAR-LIVES) |
| [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | Trig 3/5 | L2 Understand | ✅ Approved | #544 | 1 | ~28 min | ⚠️ P0+5 findings | GEN-UX-001 confirmed (results not fixed), UI-SC-007 retracted |
| [find-triangle-side](find-triangle-side/index.md) | Trig 4/5 | L3 Apply | ✅ Approved | #549 | 1 | ~28 min | ⚠️ 1 P0 + 11 findings (browser playthrough 2026-03-23) | Re-queue: restartGame() not reset (P0); Enter key missing; local asset path |
| [real-world-problem](real-world-problem/index.md) | Trig 5/5 | L4 Analyze | ✅ Approved | #564 | 2 | ~32 min | ⚠️ 12 findings (browser 2026-03-23) | syncDOMState on #app not body (HIGH test gap); Play Again 41px; SignalCollector sealed on restart; SVG clip confirmed |
| [face-memory](face-memory/index.md) | Standalone | TBD | ✅ Approved | #512 | — | — | ⚠️ 6 findings (browser 2026-03-23) | 0 P0s; MEDIUM: results static (GEN-UX-001 15th), no aria-live (ARIA-001 18th), gameId undefined (GEN-GAMEID 6th); LOW: option divs not buttons, no Enter key; no re-queue |
| [match-the-cards](match-the-cards/index.md) | Standalone | TBD | ✅ Approved | #514 | — | — | ⚠️ 6 findings (browser 2026-03-23) | 0 P0s; MEDIUM: results-screen static (GEN-UX-001), no aria-live (ARIA-001), gameId undefined (GEN-GAMEID); no re-queue |
| [identify-pairs-list](identify-pairs-list/index.md) | Standalone | TBD | ✅ Approved | #515 | — | — | ⚠️ 8 findings (browser 2026-03-23) | 0 P0s; MEDIUM: results static (GEN-UX-001), aria-live absent (ARIA-001), no CDN ProgressBar (test gap), data-lives not set (test gap); no re-queue |
| [associations](associations/index.md) | Standalone | TBD | ✅ Approved | #472 | 2 | ~29 min | ⚠️ 1 P0 + 6 findings (browser 2026-03-23) | Re-queue recommended: restartGame() state not reset (P0); timer.getTime error; waitForPackages 10s |
| [count-and-tap](count-and-tap/index.md) | Standalone | L1 Remember | ✅ Approved | #551 | 2 | ~30 min | ⚠️ 10 findings (browser 2026-03-23) | syncDOMState on #app not body (HIGH test gap); ProgressBar off-by-one on final round (MEDIUM); no re-queue (flow complete) |
| [quadratic-formula-worked-example](quadratic-formula-worked-example/index.md) | Standalone | L2 Understand | ✅ Approved | #546 | 2 | ~38 min | ⚠️ P0+5 findings | Re-queue: GEN-UX-001+restartGame() reset |
| visual-memory | Standalone | TBD | ✅ Approved | #528 | — | — | ⚠️ 2 P0s + 5 findings (3a, 1b, 1c) | Re-queue recommended: GEN-ENDGAME-GUARD (rule 53) now deployed — should fix P0-1. P0-2: setupRound() crash on round 6 (separate fix needed in spec) |
| [addition-mcq](addition-mcq/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-blitz](addition-mcq-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [addition-mcq-lives](addition-mcq-lives/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [word-pairs](word-pairs/index.md) | Standalone | TBD | ✅ Approved | #529 | — | — | ⚠️ 1 P0 + 6 findings (browser 2026-03-23) | No re-queue; P0: CSS strip causes buttons 21.5px; HIGH: stale data-round/data-score after restart; results-screen position:static (GEN-RESULTS-FIXED now deployed); 2 MEDIUM (SignalCollector, waitForPackages 120s) |
| [right-triangle-area](right-triangle-area/index.md) | Standalone | TBD | ✅ Approved | #543 | — | — | ⚠️ 1 P0 + 8 findings (browser 2026-03-23) | P0: restartGame() crashes — progressBar.destroy() setTimeout + null-trap; HIGH: canvas overflow (GEN-CANVAS-001 first live confirmation); buttons 21.5px; results screen static |
| [rapid-challenge](rapid-challenge/index.md) | Standalone | TBD | ✅ Approved | #526 | 3 | — | ⚠️ [10 findings] (browser 2026-03-23) | 2 P0: results screen static (GEN-UX-001), CSS stripped (buttons 21.5px, .visually-hidden visible); HIGH: progressBar destroy race in endGame(); window.nextRound missing; MEDIUM: aria-live absent, waitForPackages 120s stale error msg; Play Again state reset PASS; no re-queue (systemic) |
| [sequence-builder](sequence-builder/index.md) | Standalone | TBD | ✅ Approved | #525 | ? | — | ⚠️ 8 findings (browser 2026-03-23) | P0: CSS stripped (buttons 21.5px), results-screen position:static; HIGH: progressBar destroy race (3rd instance), window.nextRound missing; MEDIUM: syncDOMState #app only (LP-4), no aria-live; all 5 rounds + Play Again PASS; no re-queue |
| [adjustment-strategy](adjustment-strategy/index.md) | Standalone | TBD | ✅ Approved | #385 | 0 | ~30 min | ⚠️ 7 findings (5a, 2d) | No P0s; adj-btn 36px; no Enter key; gameState.gameId absent; window.nextRound missing; CDN timeout+await gen rule gaps confirmed |
| [math-cross-grid](math-cross-grid/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [math-mcq-quiz](math-mcq-quiz/index.md) | Standalone | TBD | TBD | — | — | — | ❌ Pending | Check DB |
| [mcq-addition-blitz](mcq-addition-blitz/index.md) | Standalone | TBD | TBD | — | — | — | ⚠️ 9 issues | Audited 2026-03-23 (6a 2b 1d) |

*Updated: 2026-03-23 — face-memory #512 browser playthrough: 0 P0 flow blockers, 6 findings (3 MEDIUM systemic, 3 LOW); all 3 rounds functional; difficulty scaling confirmed (3→4 features); wrong answer life deduction PASS; Play Again state reset PASS; 0 console errors; no re-queue required. Next UI/UX target: expression-completer #511. word-pairs #529 browser playthrough: 0 P0 flow blockers, 7 findings (1 pseudo-P0 CSS strip, 2 HIGH, 2 MEDIUM, 2 PASS groups); results reachable; no re-queue. GEN-RESULTS-FIXED (rule 54) deployed covers results-screen position:static. Stats Session 2 all 5 specs ready (stats-which-measure spec added L4 Analyze, 0985fad+924f8bb). Gen Quality: rules 53 GEN-ENDGAME-GUARD, 53b GEN-DATA-LIVES-GUARD, 54 GEN-RESULTS-FIXED, 55 GEN-TRANSITION-ICONS (pending commit) shipped. CR-044/CR-045 pipeline-fix-loop.js fixes deployed. right-triangle-area #543 browser playthrough in progress.*

*Original note: associations #472 full browser playthrough: 1 P0 + 6 findings (5a, 2d); P0: restartGame() no state reset (currentRound=3 retained after Play Again, 3rd confirmed instance); syncDOMState on #app not body confirmed (LP-4 pattern, 3rd instance); timer.getTime repeating error; waitForPackages 10s. choice-btn 51px PASS. Play Again 47.5px PASS. Re-queue recommended. count-and-tap #551 full browser playthrough: 10 findings (1 retracted), 0 P0s, no re-queue; syncDOMState on #app not body (2nd instance, HIGH test gap); ProgressBar off-by-one on final round (MEDIUM). adjustment-strategy RCA written: approved #385 (8.8% rate, CDN timeout+await gen rule failures); soh-cah-toa-worked-example browser playthrough complete: P0 results screen not position:fixed confirmed; UI-SC-007 (hide/show TypeError) retracted — hide() takes selector strings (correct). Statistics Session 2 all 4 specs written; real-world-problem #564 APPROVED; name-the-sides re-approved #562; which-ratio APPROVED #561. which-ratio #561 browser audit: 3 P0s found (BROWSER-P0-001 string-mode transitionScreen, BROWSER-P0-002 SVG icons, BROWSER-NEW-001 totalLives=0); gen rules GEN-TRANSITION-API/GEN-TRANSITION-ICONS/GEN-PROGRESSBAR-LIVES (rules 45/46/47) shipped commit c0d5391.*

---

## Sessions

### Statistics (5 games, Bloom L1→L4) — 📝 Specs written (2026-03-23)

*Session goal: learner progresses from identifying measures of central tendency (L1) through computing mean (L2-L3) → median (L3) → mode for grouped data (L3) → choosing the appropriate measure by analyzing data context (L4).*
*All 5 specs written with research citations. Awaiting human review before first builds.*

| # | Game | Bloom | Status | Notes |
|---|------|-------|--------|-------|
| 1 | [stats-identify-class](stats-identify-class/index.md) | L1 Remember | 📝 Spec ready | MCQ: identify mean/median/mode from description; GAME_COMPLETE fixed pre-build |
| 2 | [stats-mean-direct](stats-mean-direct/index.md) | L2-L3 Apply | 📝 Spec ready | Compute mean of small dataset; 4 misconception distractors; timer 45s |
| 3 | [stats-median](stats-median/index.md) | L3 Apply | 📝 Spec ready | Find median (odd/even n, sort-first); M-no-sort primary distractor |
| 4 | [stats-mode](stats-mode/index.md) | L3 Apply | 📝 Spec ready | Ungrouped single/bimodal + grouped NCERT formula; dual display mode |
| 5 | [stats-which-measure](stats-which-measure/index.md) | L4 Analyze | 📝 Spec ready | MCQ: 3 options each with justification; 6 rounds, 60s timer; salary/shoe/scores/house/colours/rainfall scenarios; 4 misconception tags |

---

### SOH-CAH-TOA Trigonometry (5 games, Bloom L2→L4) — ✅ COMPLETE (2026-03-23)

*Session goal: learner progresses from side-labeling (L2) through definition recall (L2) → scaffolded worked example (L2) → application (L3) → real-world analysis (L4).*
*All 5 games approved. First complete Bloom L2→L4 session in Ralph pipeline.*

| # | Game | Bloom | Status | Notes |
|---|------|-------|--------|-------|
| 1 | [name-the-sides](name-the-sides/index.md) | L2 Understand | ✅ Approved | label-assignment; prerequisite for all others; re-approved #562 |
| 2 | [which-ratio](which-ratio/index.md) | L2 Understand | ✅ Approved | APPROVED #561 (iter=3, re-queue after CSS fix) |
| 3 | [soh-cah-toa-worked-example](soh-cah-toa-worked-example/index.md) | L2 Understand | ✅ Approved | worked-example→faded→practice scaffold |
| 4 | [find-triangle-side](find-triangle-side/index.md) | L3 Apply | ✅ Approved | two-step: ratio MCQ + typed computation |
| 5 | [real-world-problem](real-world-problem/index.md) | L4 Analyze | ✅ Approved | APPROVED #564 (iter=2); first L4 Bloom game |

---

### Standalone Games

| Game | Bloom | Status | Notes |
|------|-------|--------|-------|
| [face-memory](face-memory/index.md) | TBD | ✅ Approved #512 | Browser audit 2026-03-23: 0 P0s + 6 findings (3a, 3 low); MEDIUM: results static (GEN-UX-001), no aria-live (ARIA-001), gameId undefined; LOW: option divs not buttons, no Enter key, CDN subtitle; no re-queue |
| [identify-pairs-list](identify-pairs-list/index.md) | TBD | ✅ Approved #515 | Browser audit 2026-03-23: 0 P0s + 8 findings (4a, 2c, 2d); MEDIUM: results static, aria-live absent, no CDN ProgressBar (custom points counter, test gap), data-lives not set (test gap); no re-queue |
| [associations](associations/index.md) | TBD | ✅ Approved | Unlimited-lives accuracy; emoji/name pairs; browser audit 2026-03-23: 1 P0 + 6 findings; re-queue recommended |
| [count-and-tap](count-and-tap/index.md) | L1 Remember | ✅ Approved | Subitizing / dot counting with timer; browser audit 2026-03-23: 10 findings (0 P0) |
| [quadratic-formula-worked-example](quadratic-formula-worked-example/index.md) | L2 Understand | ✅ Approved | Worked-example-mcq; algebra |
| [addition-mcq](addition-mcq/index.md) | TBD | TBD | Check DB for build history |
| [addition-mcq-blitz](addition-mcq-blitz/index.md) | TBD | TBD | Check DB for build history |
| [addition-mcq-lives](addition-mcq-lives/index.md) | TBD | TBD | Check DB for build history |
| [adjustment-strategy](adjustment-strategy/index.md) | TBD | ✅ Approved #385 | Browser audit 2026-03-23: 0 P0s + 7 findings (5a, 2d); adj-btn 36px, no Enter key, gameId absent, window.nextRound missing; CDN timeout + await gen rule gaps confirmed |
| [math-cross-grid](math-cross-grid/index.md) | TBD | TBD | Check DB for build history |
| [math-mcq-quiz](math-mcq-quiz/index.md) | TBD | TBD | Check DB for build history |
| [mcq-addition-blitz](mcq-addition-blitz/index.md) | TBD | TBD | Check DB for build history |

---

## Structure

Each game directory contains:

| File | Purpose |
|------|---------|
| `index.md` | Human decision dashboard — status, build history, action required |
| `spec.md` | Canonical spec (pipeline reads via symlink from `warehouse/templates/<game>/spec.md`) |
| `rca.md` | Root cause analysis — failure history, evidence, POC fixes |
| `ui-ux.md` | UI/UX audit — visual issues, gen prompt rules, spec additions |
| `build-log.md` | Build history stub (full data in DB on server) |
