# UI/UX Audit — mcq-addition-blitz

**Audit date:** 2026-03-23
**Auditor:** UI/UX Slot (mandatory active slot — CLAUDE.md Rule 16)
**Audit type:** Spec-only — no approved build exists (0 builds in DB)
**Spec:** games/mcq-addition-blitz/spec.md (168 lines, v1)

---

## Summary

Spec-only audit. No HTML available for browser playthrough — static spec analysis only.

Game profile: MCQ addition, 3 lives, 30s countdown timer per question, 4-option buttons (`.option-btn`). Uses TransitionScreen for both start/end states, TimerComponent (PART-006), ProgressBarComponent (PART-023), SignalCollector (PART-010), VisibilityTracker (PART-005), Sentry (PART-030). Victory and game-over both route through `transitionScreen.show()`.

**No P0 blockers:** FeedbackManager.init() absent (PASS). No alert()/confirm()/prompt() mentioned (PASS). TransitionScreen used for end states — no custom position:static results div expected (PASS for results screen overlay).

**9 actionable findings (6a, 2b, 1d).** Key gaps: gameState.gameId absent (6th instance), window.endGame unassigned (6th instance), data-phase/syncDOMState absent (5th MCQ spec instance), ARIA live region absent (15th instance), ProgressBar slotId unspecified (9th instance), SignalCollector no-args (5th instance), game_complete dual-path not explicit (3rd instance), restartGame() timer destroy unspecified (3rd timer game instance), option-btn min-height absent (10th instance).

---

## Mandatory Checklist

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | CSS stylesheet intact | N/A | Spec-only — no HTML |
| 2 | FeedbackManager.init() ABSENT | PASS | Not mentioned anywhere in spec |
| 3 | alert()/confirm()/prompt() absent | PASS | Not mentioned in spec |
| 4 | window.endGame assigned at DOMContentLoaded end | FAIL | No mention of window.endGame assignment in spec — 6th confirmed instance |
| 5 | data-phase transitions + syncDOMState() at EVERY phase change | FAIL | Screen Flow (Section 5) defines 3 states but no data-phase, syncDOMState(), or gameState.phase — 5th confirmed MCQ spec instance |
| 6 | Enter key handler (text input games only) | N/A | MCQ tap game — no text input |
| 7 | ProgressBar: options object with slotId: 'mathai-progress-slot' | FAIL | PART-023 listed but no instantiation pattern shown; GEN-UX-003 shipped but spec still doesn't codify it — 9th confirmed instance |
| 8 | aria-live="polite" role="status" on ALL dynamic feedback elements | FAIL | Section 6 shows option buttons but no feedback div with aria-live/role="status" — 15th confirmed instance |
| 9 | SignalCollector constructor args: sessionId, studentId, templateId | FAIL | PART-010 listed; no instantiation with {sessionId, studentId, templateId} shown — 5th confirmed instance |
| 10 | gameState.gameId field as FIRST field | FAIL | Section 3 gameState declaration missing gameId — 6th confirmed instance |
| 11 | Results screen position:fixed with z-index≥100 | PASS | Both end states use transitionScreen.show() (CDN overlay component, not custom div) — no custom results div needed |
| 12 | ALL interactive buttons min-height:44px (incl. .option-btn) | FAIL | Section 6 HTML shows 4× .option-btn; no min-height:44px in spec CSS or constraints — 10th confirmed instance |
| 13 | Sentry SDK v10.23.0 three-script pattern | FAIL (low) | PART-030 listed; no version pinning or three-script pattern specified — same gap as all prior specs |
| 14 | game_complete postMessage on BOTH victory AND game-over paths | FAIL | Section 5 shows both paths call transitionScreen.show() but no postMessage({type:'game_complete'}) shown on either path — 3rd confirmed instance (spec addition needed) |
| 15 | restartGame() resets ALL gameState fields; timer games destroy+recreate TimerComponent | FAIL | restartGame() is referenced in game-over button action but not specified; this is a timer game (30s countdown) — must destroy+recreate TimerComponent — 3rd confirmed timer game instance |
| 16 | waitForPackages() only awaits packages the game actually instantiates | PASS | Spec uses TimerComponent + VisibilityTracker (PART-006 + PART-005); both are legitimately awaited |

---

## Findings

### F1 — window.endGame not assigned to window [type-a] [HIGH]

**Pattern:** window.endGame not assigned in DOMContentLoaded
**Instance count:** 6th confirmed (math-mcq-quiz, math-cross-grid, word-pairs, associations, adjustment-strategy, mcq-addition-blitz)
**Description:** Spec has no mention of `window.endGame = endGame`. The harness calls `window.endGame()` to force end-of-game in contract tests. If endGame() is a local function only, the harness call silently fails, causing contract test timeouts.
**Action:** T1 W3 check already shipped (`window.endGame` assignment). Gen rule GEN-WINDOW-EXPOSE (rule 36) already shipped — both should catch this at build time. No new ROADMAP entry needed. Add explicit `window.endGame = endGame` assignment to spec Section 7 (or DOMContentLoaded summary) before first build.

---

### F2 — No data-phase / syncDOMState() state machine [type-a] [HIGH]

**Pattern:** data-phase + syncDOMState() absent from MCQ spec
**Instance count:** 5th confirmed MCQ spec (addition-mcq-blitz, addition-mcq-lives, addition-mcq, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 5 (Screen Flow) defines three states — start screen, question screen, end screen — but does not specify `gameState.phase` values, `data-phase` attribute, or `syncDOMState()` calls at any transition. Without explicit phase transitions, the LLM omits syncDOMState() calls, causing game-flow test timeouts (22% of game-flow iter-1 failures).
**Required phase mapping:**
- `showStartScreen()` → `gameState.phase = 'start_screen'` → `syncDOMState()`
- `startGame()` / `setupGame()` → `gameState.phase = 'playing'` → `syncDOMState()`
- `endGame()` victory path → `gameState.phase = 'results'` → `syncDOMState()`
- `endGame()` game-over path → `gameState.phase = 'game_over'` → `syncDOMState()`
**Action:** Add to spec Section 5 before first build. Already tracked in ROADMAP line 237.

---

### F3 — No ARIA live region on option feedback [type-a] [HIGH]

**Pattern:** Dynamic feedback elements missing aria-live="polite" role="status"
**Instance count:** 15th confirmed (which-ratio, name-the-sides, count-and-tap, find-triangle-side, quadratic-formula, soh-cah-toa, right-triangle-area, word-pairs, real-world-problem, addition-mcq-lives, addition-mcq, associations, math-mcq-quiz, math-cross-grid, mcq-addition-blitz)
**Description:** Section 6 shows the play area HTML with `#question-text` and `.option-btn` elements. No feedback div with `aria-live="polite"` and `role="status"` is specified. After an option is selected (correct/incorrect/timeout), visual feedback is shown but screen reader users receive no announcement.
**Action:** ARIA-001 gen rule already shipped (c826ec1). T1 W5 check fires. No new ROADMAP entry needed. Add explicit feedback div to Section 6 HTML: `<div id="answer-feedback" aria-live="polite" role="status"></div>`.

---

### F4 — gameState.gameId absent from initial declaration [type-a] [HIGH]

**Pattern:** gameState missing gameId field
**Instance count:** 6th confirmed (adjustment-strategy, addition-mcq, associations, math-cross-grid, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 3 gameState declaration includes isGameStarted, isGameEnded, currentRound, totalRounds, content, lives, totalLives, correctAnswers, currentQuestion, selectedOption, isAnswered — but NOT `gameId`. The `gameId` field is required as the FIRST field per GEN-GAMEID rule (shipped). Without it, `window.gameState.gameId` is undefined — postMessage payload is incomplete.
**Action:** GEN-GAMEID rule already shipped. No new ROADMAP entry needed. Add `gameId: 'mcq-addition-blitz'` as FIRST field to Section 3 gameState before first build.

---

### F5 — ProgressBar slotId not specified [type-a] [HIGH]

**Pattern:** ProgressBarComponent instantiation missing slotId options object
**Instance count:** 9th confirmed (find-triangle-side, quadratic-formula, right-triangle-area, real-world-problem, addition-mcq-lives, addition-mcq, associations, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 2 lists PART-023 ProgressBar but no instantiation pattern is shown anywhere in the spec. GEN-UX-003 rule (shipped) requires `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: N, totalLives: 3 })`. Without explicit spec guidance, LLM may use positional string arg, hash-prefix, or missing slotId key — none of which render in the correct CDN slot.
**Action:** GEN-UX-003 rule already shipped (25bdad0). No new ROADMAP entry needed. Add correct instantiation to spec (Section 7 or play area setup section) before first build: `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: questions.length, totalLives: 3 })`.

---

### F6 — SignalCollector instantiated without constructor args [type-a] [MEDIUM]

**Pattern:** SignalCollector no constructor args
**Instance count:** 5th confirmed (find-triangle-side, real-world-problem, addition-mcq, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 2 lists PART-010 (Event Tracking & SignalCollector) but no instantiation snippet is shown. GEN-UX-005 rule (shipped) requires `new SignalCollector({ sessionId, studentId, templateId })`. Without the spec showing correct usage, LLM may generate `new SignalCollector()` with no args — losing all signal context.
**Action:** GEN-UX-005 rule already shipped (25bdad0). No new ROADMAP entry needed. Add correct instantiation to spec before first build.

---

### F7 — game_complete postMessage not specified on both end paths [type-b] [HIGH]

**Pattern:** game_complete dual-path not explicit in spec
**Instance count:** 3rd confirmed (addition-mcq-lives, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 5 shows two end states — Victory Screen (lives remaining) and Game Over Screen (lives exhausted) — but neither explicitly calls `window.parent.postMessage({ type: 'game_complete', ... })`. The PART-008 PostMessage Protocol is listed but the spec does not specify that game_complete must fire on BOTH paths. Risk: LLM may emit game_complete only on victory, or only via endGame(), missing the game-over path.
**Action:** Spec addition needed before first build. Add to Section 5 (both end screens) and Section 7 (endGame): explicit `window.parent.postMessage({ type: 'game_complete', gameId: 'mcq-addition-blitz', score: correctAnswers, stars: starsEarned || 0, totalRounds: totalRounds }, '*')` on BOTH victory and game-over paths. Already in ROADMAP as "game_complete dual-path not specified".

---

### F8 — restartGame() timer destroy+recreate not specified [type-b] [MEDIUM]

**Pattern:** Timer game restartGame() must destroy+recreate TimerComponent
**Instance count:** 3rd confirmed timer game (addition-mcq-lives, math-mcq-quiz, mcq-addition-blitz)
**Description:** Section 5 game-over screen button calls `restartGame()` but the spec does not define restartGame() behavior. This is a 30-second countdown timer game (PART-006 TimerComponent). Without explicit destroy+recreate, LLM may call `timer.start()` on a stale instance — carrying over the previous onEnd callback and triggering double game-over.
**Action:** Spec addition needed before first build. Add restartGame() definition to spec: `timer.destroy(); timer = new TimerComponent(...); /* reset all gameState fields */; setupGame();`. Already in ROADMAP as "restartGame() unspecified for timer games".

---

### F9 — .option-btn buttons missing explicit min-height:44px [type-a] [MEDIUM]

**Pattern:** Interactive buttons missing 44px touch targets
**Instance count:** 10th confirmed (.option-btn variant)
**Description:** Section 6 shows four `.option-btn` elements (data-index 0–3). No min-height:44px or min-width:44px is specified in the play area HTML or any CSS guidance in the spec. On mobile, undersized option buttons cause mis-taps. GEN-UX-002 / GEN-TOUCH-TARGET rule (shipped) covers `.game-btn` and `.choice-btn` — `.option-btn` must be explicitly included.
**Action:** GEN-UX-002 rule shipped. Verify `.option-btn` is covered by the rule's CSS selector (may need to extend rule to include `.option-btn`). This is the 10th instance and the first `.option-btn`-class variant — confirm selector coverage in prompts.js before first build.

---

## Routing Table

| Finding | Classification | Destination | Action |
|---------|---------------|-------------|--------|
| F1 — window.endGame unassigned | (a) gen prompt rule | Gen Quality | Already shipped (GEN-WINDOW-EXPOSE). Add to spec before build. |
| F2 — data-phase/syncDOMState absent | (a) gen prompt rule | Gen Quality | Already tracked (ROADMAP line 237). Add to spec before build. |
| F3 — ARIA live region absent | (a) gen prompt rule | Gen Quality | Already shipped (ARIA-001, c826ec1). Add feedback div to spec before build. |
| F4 — gameState.gameId absent | (a) gen prompt rule | Gen Quality | Already shipped (GEN-GAMEID). Add to spec Section 3 before build. |
| F5 — ProgressBar slotId missing | (a) gen prompt rule | Gen Quality | Already shipped (GEN-UX-003). Add to spec before build. |
| F6 — SignalCollector no args | (a) gen prompt rule | Gen Quality | Already shipped (GEN-UX-005). Add to spec before build. |
| F7 — game_complete dual-path | (b) spec addition | Education | Add postMessage to both Section 5 end screens before first build. |
| F8 — restartGame() unspecified | (b) spec addition | Education | Add restartGame() definition to spec before first build. |
| F9 — .option-btn min-height | (a) gen prompt rule | Gen Quality + Test Engineering | Verify GEN-UX-002 selector covers .option-btn; add test assertion for computed min-height on .option-btn. |

---

## Positive Observations

- FeedbackManager.init() correctly absent — no audio popup risk.
- No alert()/confirm()/prompt() in any interaction.
- Both end states (victory + game-over) correctly use TransitionScreen CDN component — no custom position:static results div needed.
- Fallback content (Section 4) is complete: 5 questions with all 4 options and correct answer specified.
- Star logic (Section 5) is explicit: 3/2/1 stars by lives remaining, 0 lives = game-over (no stars) — no ambiguity.
- InputSchema (Section 4) is well-formed: array of objects with question/answer/options, minItems:1, required fields correct.
- isAnswered flag correctly specified as lock-after-selection-or-timeout — prevents double-scoring on timer expiry.
- PART-026 Anti-Patterns listed — LLM will check against known banned patterns.
- waitForPackages() is justified: TimerComponent (PART-006) and VisibilityTracker (PART-005) both actually used.

---

## Pre-Build Checklist (before queuing first build)

Before queueing mcq-addition-blitz for the first time, add the following to spec.md:

- [ ] Section 3: Add `gameId: 'mcq-addition-blitz'` as FIRST field in gameState
- [ ] Section 5: Add data-phase state machine (start_screen → playing → results/game_over) with syncDOMState() at each transition
- [ ] Section 5: Add explicit `window.parent.postMessage({ type: 'game_complete', ... })` on BOTH victory and game-over paths
- [ ] Section 6: Add `<div id="answer-feedback" aria-live="polite" role="status"></div>` to play area HTML
- [ ] New section (7 or 8): Add `window.endGame = endGame` assignment
- [ ] New section: Add restartGame() definition: destroy timer → reset all gameState fields → recreate timer → setupGame()
- [ ] New section: Add ProgressBar instantiation: `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: ..., totalLives: 3 })`
- [ ] New section: Add SignalCollector instantiation with args: `new SignalCollector({ sessionId, studentId, templateId })`
