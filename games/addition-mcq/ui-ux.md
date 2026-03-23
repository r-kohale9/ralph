# Addition MCQ — UI/UX Audit
**Build:** #579
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, 375×812px (mobile)
**URL:** https://storage.googleapis.com/mathai-temp-assets/games/addition-mcq/builds/579/index.html

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| P0 | 3 | Results screen always visible, Option buttons 22px (below 44px minimum), `.hidden` CSS class has no definition |
| HIGH | 2 | No `data-testid="btn-start"` on start button, No `aria-live` on feedback element |
| MEDIUM | 1 | No `data-testid="lives"` display element |
| LOW | 1 | Questions set is static — same 5 questions in same order every restart |

**Verdict: RE-QUEUE REQUIRED.** Three P0 issues make this build unplayable on mobile. The results screen ("Great Job! / Final Score / Play Again") is visible throughout gameplay — it overlaps the game screen from the first click through end of game. Option buttons render at 22px tall (requirement: 44px minimum). The `.hidden` CSS class applied to the game screen during results phase has no stylesheet definition and has no effect.

---

## P0 Issues

### P0-1 — Results screen always visible during playing phase
**What:** `#results-screen` has `style="display: flex"` hardcoded inline at all times, even during the `playing` phase. Both `#game-screen` and `#results-screen` are simultaneously visible and stacked vertically on screen throughout gameplay. The results content ("Great Job!", "Final Score: 0", "Play Again") renders immediately below the question and options from the first round onward.

**Evidence:**
- On transition to `playing` phase: `resultsScreenDisplay = "flex"`, `gameScreenDisplay = "block"`, both visible
- Screenshot at round 1: question + tiny option buttons visible above "Great Job! Final Score: 0 / Play Again"
- Screenshot at results phase (win): last question + options still visible alongside "Great Job! Final Score: 5 ⭐⭐⭐ / Play Again"
- `#results-screen` inline style: `display: flex` — never removed or toggled off during playing phase

**Root cause:** The results screen is initialized with an inline `display: flex` that is never removed when starting gameplay. The game relies on a `.hidden` class on `#game-screen` to hide it during results, but that class has no CSS definition (P0-3). Neither screen uses phase-based CSS (`#app[data-phase="playing"] #results-screen { display: none }`) or explicit show/hide calls.

**Route:** Gen Quality — add `.hidden { display: none !important; }` to stylesheet AND add `resultsScreen.style.display = 'none'` on game init / phase transition to playing.

---

### P0-2 — Option buttons far below 44px touch target minimum
**What:** All 4 option buttons render at **31px wide × 22px tall** on a 375px mobile viewport. The minimum tap target per WCAG 2.5.5 and Apple HIG is 44×44px. These buttons are effectively un-tappable on a real physical device.

**Evidence:**
- option-0 through option-3: width=31px, height=22px, minHeight=0px, padding=1px 6px, fontSize=13.3px
- Options grid: `display: block`, buttons laid out in a single cramped row
- No `min-height`, `min-width`, or adequate `padding` rule applied to option buttons

**Root cause:** The options grid uses `display: block` with no sizing rules on the buttons. Default browser button styling yields minimal padding. No gen rule enforced `min-height: 44px` on the rendered buttons.

**Route:** Gen Quality — option buttons must have `min-height: 44px; padding: 12px 16px; width: 100%;` — verify GEN-UX-002 / GEN-TOUCH-TARGET covers `.option-btn` or the generated class name for MCQ options.

---

### P0-3 — `.hidden` CSS class applied but never defined in stylesheet
**What:** When the game transitions to the results phase, the code adds class `"hidden"` to `#game-screen`. However, inspection of all loaded stylesheets reveals **zero CSS rules** defining `.hidden { display: none }` or any equivalent. The game screen element has `class="hidden"` set, but it is still `display: block; visibility: visible`.

**Evidence:**
- `#game-screen.className = "hidden"` during results phase
- `gameScreenDisplay = "block"` despite `.hidden` class being applied
- `phaseRules = []` — no `[data-phase]`-based CSS rules exist in any stylesheet
- Zero stylesheet rules containing `.hidden` found via full stylesheet scan
- Results screenshot confirms: old question still visible alongside final score

**Root cause:** A class-based visibility pattern was generated without the corresponding CSS definition. `.hidden` does nothing without a `display: none` rule.

**Route:** Gen Quality — add `.hidden { display: none !important; }` to the game stylesheet. Alternatively use inline style toggles or `data-phase`-based CSS.

---

## HIGH Issues

### HIGH-1 — Start button missing `data-testid="btn-start"`
**What:** The start screen "Let's Go!" button has no `data-testid` attribute. The button is rendered via TransitionScreen's `buttons` config. Tests that use `[data-testid="btn-start"]` to click the start button will fail to find it.

**Evidence:**
- `document.querySelector('[data-testid="btn-start"]')` returns null
- Full `data-testid` inventory: `app, game-screen, timer-container, question-container, question-text, options-grid, option-0..3, results-screen, score-display, stars-display, btn-restart` — `btn-start` absent
- TransitionScreen renders the button, but testid is not injected into the generated HTML

**Route:** Gen Quality — the TransitionScreen start button must receive `data-testid="btn-start"` via the CDN `#mathai-transition-slot button` pattern or inline script post-injection.

---

### HIGH-2 — No `aria-live` region for answer feedback
**What:** No element with `aria-live` attribute exists anywhere in the DOM. There is no accessible announcement when a correct or wrong answer is selected, making the game non-functional for screen reader users and violating GEN-120.

**Evidence:**
- `ariaLiveCount = 0`
- `ariaLiveElements = []`
- No feedback container (`[class*="feedback"]`, `[id*="feedback"]`) found either
- No visual feedback animation/color change observed on option buttons during answer selection

**Route:** Gen Quality — GEN-120 violation. Add `<div id="answer-feedback" aria-live="polite" role="status"></div>` and populate it on correct/wrong answer.

---

## MEDIUM Issues

### MEDIUM-1 — No `data-testid="lives"` display element
**What:** The lives display shows ❤️❤️❤️ correctly in the progress bar slot, but no element with `data-testid="lives"` exists in the DOM. Tests that read the life count via testid will find nothing.

**Evidence:**
- `document.querySelector('[data-testid="lives"]')` returns null
- Lives tracked correctly in `window.gameState.lives` and `#app[data-lives]`
- The progress bar renders hearts visually but exposes no lives testid

**Route:** Gen Quality — add `data-testid="lives"` to the hearts/lives display container.

---

## LOW Issues

### LOW-1 — Static question set (same 5 questions every restart)
**What:** All playthroughs during this audit presented the same identical 5 questions in the same order: "What is 1+1?", "What is 2+3?", "What is 5+4?", "What is 8+7?", "What is 10+9?". No randomization of question order or question pool selection.

**Evidence:** 3 game sessions across 2 restarts all presented same 5 questions in same sequence.

**Route:** Education — if spec intends a larger question bank with random sampling, add that to spec; if static is intentional for this difficulty level, document it.

---

## Passing Checks

| Check | Result |
|-------|--------|
| Start screen renders: title, button, 3 lives | PASS — "Addition Blitz!", "Let's Go!", ❤️❤️❤️ all visible |
| `window.gameState.gameId = 'addition-mcq'` | PASS |
| `#app[data-phase]` starts as `"start"` | PASS |
| `#app[data-lives]` starts as `"3"` | PASS |
| Option buttons are `<button>` elements | PASS — all 4 are BUTTON tags |
| `data-testid` on options (option-0..option-3) | PASS |
| `#results-screen` element present in DOM | PASS |
| `data-testid="btn-restart"` on Play Again button | PASS — `<button data-testid="btn-restart">Play Again</button>` |
| Life deduction on wrong answer | PASS — `data-lives` and `gameState.lives` both decrement on wrong answer |
| Score increment on correct answer | PASS — `gameState.score` increments correctly per correct click |
| After 3 wrong answers → `data-phase = 'gameover'` | PASS — gameover phase transitions correctly |
| `data-phase` transitions: start → playing | PASS |
| `data-phase` transitions: playing → results (win path) | PASS — score=5, ⭐⭐⭐ shown |
| `data-phase` transitions: playing → gameover (loss path) | PASS |
| Gameover → Try Again → full restart | PASS — lives/score/round all reset correctly |
| JS console errors | PASS — 0 errors across full session (84 log messages, 0 errors) |
| `gameState.questions[n].correctIndex` accuracy | PASS — indices match actual option positions |
| Timer countdown visible per question | PASS — countdown number visible above question |
| Timer resets on each new question | PASS — timer restarts at 30s each round |
| `data-testid="score-display"` present | PASS |
| `data-testid="stars-display"` present | PASS |
| CDN packages all loaded successfully | PASS — all 12 packages loaded without error |

---

## Flow Observations

1. Start screen loads cleanly via TransitionScreen component. Title "Addition Blitz!", lives display (❤️❤️❤️), and "Let's Go!" button all render. CDN packages load without error.
2. On "Let's Go!" click: `data-phase` transitions to `"playing"`. However, the results screen ("Great Job! Final Score: 0 / Play Again") is immediately visible below the question — P0-1 and P0-3.
3. Option buttons render as a single cramped horizontal row of tiny (31×22px) buttons — P0-2. They can be clicked with a precise mouse cursor but would be consistently mis-tapped on a physical mobile screen.
4. Correct answers: `gameState.score` increments, `currentRound` advances, progress bar updates ("1/5 rounds completed"). Lives are unaffected. No visual feedback on the option button (no color change, no checkmark animation).
5. Wrong answers: `gameState.lives` decrements, `#app[data-lives]` updates, hearts display updates in real-time (❤️❤️🤍 → ❤️🤍🤍 → etc.). Progress bar also advances — wrong answers count toward round completion.
6. After 3 wrong answers (lives reach 0): `data-phase` transitions to `"gameover"`. TransitionScreen shows "Game Over! You scored X out of 5" with "Try Again" button. This path works correctly.
7. "Try Again" (btn-restart) fully resets: `gameState.lives=3`, `gameState.score=0`, `gameState.currentRound=0`, returns to question 1. Game-over → restart flow works correctly.
8. Win path (5 correct answers): `data-phase` transitions to `"results"`. `gameState.score=5`, `score-display` shows "5", `stars-display` shows "⭐⭐⭐". But the last question and option buttons remain visible alongside the results — P0-1 / P0-3 confirmed on win path too.
9. No `aria-live` announcement at any point during answer selection — HIGH-2.
10. Timer counts down from 30 per question. On each answer click, TIMER pause() fires. Timer correctly resets to 30 on each new question.

---

## Routing Summary

| Finding | Severity | Route To | Action |
|---------|----------|----------|--------|
| Results screen always visible — `display:flex` never cleared | P0 | Gen Quality | Add `resultsScreen.style.display = 'none'` on game start; add `.hidden { display: none !important; }` to stylesheet |
| Option buttons 22px tall — below 44px minimum | P0 | Gen Quality | Add `min-height: 44px; padding: 12px 16px; width: 100%` to option button CSS; verify GEN-UX-002 covers generated selector |
| `.hidden` class has no CSS definition | P0 | Gen Quality | Add `.hidden { display: none !important; }` to stylesheet |
| Missing `data-testid="btn-start"` on start button | HIGH | Gen Quality | TransitionScreen `#mathai-transition-slot button` must receive btn-start testid |
| No `aria-live` on feedback element | HIGH | Gen Quality | GEN-120 violation — add `aria-live="polite"` feedback div, populate on answer |
| Missing `data-testid="lives"` | MEDIUM | Gen Quality | Add testid to lives/hearts display container |
| Static question set (no randomization) | LOW | Education | Clarify if static bank is intentional per spec |
