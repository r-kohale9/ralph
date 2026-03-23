# truth-tellers-liars — UI/UX Audit

**Build:** #510
**Date:** 2026-03-23
**Method:** Full browser playthrough — Playwright MCP, default viewport (~375px wide)
**Auditor:** UI/UX Slot (automated)

---

## Summary

| Severity | Count |
|----------|-------|
| P0 | 0 |
| HIGH | 0 |
| MEDIUM | 3 |
| LOW | 3 |
| PASS | 13 |

**Verdict:** No re-queue required. MEDIUM issues should be routed to Gen Quality and Test Engineering.

---

## Flow Observations

**Intro screen:** Title "Truth Tellers & Liars", emoji icon, subtitle, "I'm ready!" button. Progress bar shows 0/3, 3 lives. Clean layout.

**Gameplay (Round 1 — 2 characters):** Two character cards with name + badge ("?") + speech bubble. Instruction text with color-coded Truth-Teller/Liar labels. Submit button disabled until all characters assigned. Tap to toggle: unassigned → Truth → Liar → unassigned cycle. Green card highlight for Truth, red for Liar. Card labels uppercase ("TRUTH"/"LIAR"). Submit enabled when all assigned.

**After wrong answer (Round 1):** Audio feedback "oh no, that's not quite right!" plays. Life lost (❤️❤️🤍). Transition screen appears immediately with "Round 2 / 3 characters this time..." — no explicit in-game wrong-answer explanation shown on the cards before transitioning.

**Gameplay (Round 2 — 3 characters):** Same pattern, 3 character cards. Correct answer: audio "great deduction!" — no life lost.

**Gameplay (Round 3 — 4 characters):** 4 character cards. Difficulty scales correctly (2 → 3 → 4 characters).

**End screen:** "Game Complete!" with star rating (1/3 → 1 star), score (1/3), time (0:00), lives remaining (1), accuracy (33%), "Play Again" button. Screen fills viewport.

**Restart:** "Play Again" resets to intro screen, 0/3 rounds, 3 lives. SignalCollector re-initialized. Full state reset confirmed.

---

## Issues

### MEDIUM-1 — Timer always shows 00:00 (Gen Quality)
**Element:** `#timer-container` / `TimerComponent`
**Observed:** Timer displayed `00:00` throughout all rounds including at end screen where `Time: 0:00` is shown. Timer component logs confirm `resume()` and `pause()` are called correctly, but the visible display never increments.
**Impact:** Time metric on results screen always shows 0:00 — misleading. Tests that assert `timer > 0` will fail.
**Root cause:** Likely `TimerComponent` with `format: 'min'` starts from 0 and the game completes too quickly, or there is a rendering issue with `#timer-container` height/visibility. May be a CDN TimerComponent behavior.
**Routing:** Gen Quality — investigate whether `TimerComponent` requires explicit container sizing. Low priority unless tests rely on timer value.

### MEDIUM-2 — No `aria-live` regions (Gen Quality)
**Observed:** Zero `aria-live` attributes in the entire HTML. Correct/wrong feedback is audio-only + visual card color. Screen readers receive no announcement.
**Instance:** 19th observed instance of ARIA-001 pattern across audited games.
**Routing:** Gen Quality — reinforce `aria-live="polite"` gen rule (GEN-120).

### MEDIUM-3 — Missing `data-testid` on `result-time` and `result-accuracy` elements (Test Engineering)
**Elements:** `<span id="result-time">`, `<span id="result-accuracy">`
**Observed:** `score-display`, `lives-display`, `stars-display`, `btn-restart` all have `data-testid`. But `result-time` and `result-accuracy` only have `id` attributes — no `data-testid`.
**Impact:** Tests targeting time/accuracy metrics cannot use the standard `[data-testid=...]` selector pattern used by the test harness.
**Routing:** Test Engineering — add to gen rule or T1 check: all results-screen metrics must have `data-testid`.

### LOW-1 — Lottie loading animation 404 (CDN constraint)
**Network:** `https://cdn.homeworkapp.ai/.../loading.json` → `ERR_ABORTED` (4 failures across transition screens)
**Observed:** Loading spinner on transition screens silently fails. Does not block gameplay or UI.
**Routing:** CDN — known external asset dependency failure. Document only.

### LOW-2 — No explanatory wrong-answer feedback on cards (Education / Gen Quality)
**Observed:** When a wrong answer is submitted, the game immediately plays audio and shows a "Round N" transition screen. The character cards with `result-correct`/`result-wrong` CSS classes exist in the stylesheet, but the transition to the next round happens so quickly (1500ms delay per code) that the card result coloring may not be visible before the transition screen appears.
**Impact:** Student sees no explanation of why their answer was wrong — no "Alice was actually a Liar because..." breakdown shown.
**Routing:** Education — consider spec addition requiring a brief "reveal" phase showing correct assignments before advancing. Medium pedagogical concern for a deduction game.

### LOW-3 — FeedbackManager subtitle component missing (CDN warning)
**Console:** `[WARNING] [FeedbackManager] Subtitle component not found` — fires on each round submission.
**Observed:** 4 warnings total across 3 rounds.
**Impact:** Audio feedback plays correctly but subtitle text overlay does not render. Accessibility concern for hearing-impaired users.
**Routing:** CDN constraint — `SubtitleComponent` slot not wired up. Gen Quality — ensure subtitle slot is present per gen rules.

---

## Passes

| Check | Result |
|-------|--------|
| No console errors | PASS — 0 errors, 4 warnings (all CDN-level) |
| `#app[data-phase]` updated via `syncDOMState()` | PASS — phase, lives, score, round all set |
| `window.endGame` exposed | PASS — line 816 |
| `window.restartGame` exposed | PASS — line 919 |
| `window.nextRound` exposed | PASS — line 709 |
| `data-testid="option-0"` through `option-N` (dynamic) | PASS — set on each card via `card.setAttribute` |
| `data-testid="btn-check"` on Submit button | PASS |
| `data-testid="btn-restart"` on Play Again button | PASS |
| `data-testid="score-display"`, `lives-display`, `stars-display` | PASS |
| Submit disabled until all assigned | PASS — guards enforced |
| Toggle cycle (unassigned → Truth → Liar → unassigned) | PASS |
| Progress bar advances correctly (0/3 → 1/3 → 2/3 → 3/3) | PASS |
| Difficulty scaling (2 → 3 → 4 characters per round) | PASS |
| End screen reachable, "Play Again" resets state | PASS — full restart confirmed |

---

## Routing Summary

| Issue | Destination | Priority |
|-------|------------|---------|
| MEDIUM-1: Timer 00:00 | Gen Quality (CDN TimerComponent sizing) | LOW |
| MEDIUM-2: No aria-live | Gen Quality (reinforce GEN-120) | MEDIUM |
| MEDIUM-3: Missing data-testid on result-time/result-accuracy | Test Engineering (gen rule or T1 check) | MEDIUM |
| LOW-1: Lottie 404 | CDN — document only | LOW |
| LOW-2: No wrong-answer card reveal | Education (spec improvement) | LOW |
| LOW-3: FeedbackManager subtitle missing | CDN constraint / Gen Quality | LOW |
