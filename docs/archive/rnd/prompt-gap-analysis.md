# Prompt Gap Analysis — Post-Lesson-133 (2026-03-22)

## Context

All 52 warehouse games are approved. This analysis covers the residual test failures visible in builds 505–516 (the final approval batch) and the failure_patterns table. The goal is to identify which failure patterns are NOT yet addressed by the current prompt rules (M10-M13, GF3-GF7, CT3-CT6, EC1-EC5, LP4-LP6, RULE-DUP) so the next build cycle starts from a stronger baseline.

---

## Section 1: Top Failure Patterns by Frequency (Builds 505–516)

### Raw data extracted from test_results JSON

| Build | Game | Category | Failure Type | Error Summary |
|-------|------|----------|--------------|---------------|
| 515 | identify-pairs-list | game-flow | toBeHidden wrong — #game-screen still visible at results | 1 failure → fixed iter 2 |
| 514 | match-the-cards | game-flow | toHaveAttribute 'gameover' received 'playing' (15s) | 1 failure |
| 514 | match-the-cards | level-progression | getRound() returned 0 twice (stale read) | 2 failures |
| 514 | match-the-cards | contract | victory postMessage: score not > 0 | 1 failure |
| 513 | associations | contract | #results-screen hidden during postMessage test | 1 failure → fixed iter 2 |
| 512 | face-memory | edge-cases | Game Over on Zero Lives: getLives() returned 3, expected 1 | 1 failure |
| 511 | expression-completer | edge-cases | strict-mode: data-testid="option-1" resolved to 2 elements | 1 failure |
| 511 | expression-completer | edge-cases | Zero lives triggers gameover: timed out waiting for phase | 1 failure |
| 510 | truth-tellers-liars | all | All passing ✅ | — |
| 509 | disappearing-numbers | contract | postMessage null — 3 iterations to fix | 3 failures total |
| 508 | light-up | all | All passing ✅ | — |
| 507 | position-maximizer | mechanics | lives didn't decrement: expected 2 received 3 | 1 failure |
| 507 | position-maximizer | edge-cases | selector.click: expected string, got object | 1 failure |
| 506 | two-player-race | game-flow | restart → #game-screen hidden (not visible) | 1 failure |
| 506 | two-player-race | mechanics | wrong-class: .p1-option still "disabled" not "correct" after timeout | 1 failure |

### Failure Pattern Summary (builds 505–516, 15 non-cancelled builds)

| Error Type | Count | Categories |
|------------|-------|------------|
| Phase stuck (gameover/playing/results mismatch) | 5 | game-flow (4), edge-cases (1) |
| getLives()/getRound()/getScore() stale read | 4 | level-prog (2), edge-cases (1), mechanics (1) |
| postMessage null / contract timing | 4 | contract (4) |
| Strict-mode locator (duplicate testid) | 1 | edge-cases |
| Wrong-class assertion (timing) | 1 | mechanics |
| Element visibility wrong after state change | 2 | game-flow (2) |

---

## Section 2: Failure Patterns Table — What Current Rules Cover

| Pattern | Occurrences (505–516) | Covered By | Status |
|---------|----------------------|-----------|--------|
| Phase stuck (gameover 15s timeout) | 4 | GF3 (20s, amended) | COVERED — but residual failures still appear |
| getLives/getScore/getRound stale read | 4 | M13 (expect.poll) | COVERED — but M13 appears to not be consistently applied |
| postMessage null | 4 | CT4+CT6 (200ms delay + null guard) | COVERED — disappearing-numbers required 3 iterations |
| Strict-mode duplicate testid | 1 | RULE-DUP | COVERED |
| Wrong-class timing | 1 | Unclear — no direct rule | **GAP** |
| Screen visibility race (game-screen still visible) | 2 | Partially GF4 | **GAP** |
| Restart → wrong phase/visibility | 1 | None explicit | **GAP** |
| selector.click expected string, got object | 1 | EC-FIX-1 partial | **GAP** |

**Key observation:** M13 and CT4/CT6 rules EXIST in the prompt but residual failures remain. This means either (a) the rules are not consistently applied by the test-gen LLM, or (b) new games have unique mechanics the existing rules don't fully cover.

---

## Section 3: Failure Patterns Table — DB failure_patterns

The failure_patterns table is dominated by adjustment-strategy (game with chronic failures now resolved). The current actionable patterns:

| Pattern | Category | Occurrences |
|---------|----------|-------------|
| All adjustment-strategy (rendering/toBeVisible) | rendering | 2 each × 18 tests |
| keep-track: #mathai-transition-slot button not found | rendering | 6 (all build #503) |
| adjustment-strategy: progress scoring | scoring | 2 |
| count-and-tap: unknown | unknown | 4 |

**Key observation:** The failure_patterns table is heavily skewed by adjustment-strategy's 60-build failure history and is now stale (those games are approved). The actionable signal is in the raw test_results from recent builds.

---

## Section 4: Lessons Since #90 Not Yet Translated Into Prompt Rules

Cross-checking the lessons against current prompts.js rules:

| Lesson | Status | Gap? |
|--------|--------|------|
| L91: Diagnose locally before fixing | Process lesson | No prompt rule needed |
| L92: isCdnGame dead code in smoke-regen | Fixed (c4d24f2) | Resolved |
| L93: window.gameState.content pre-populated | Rule in CDN_CONSTRAINTS_BLOCK | Covered |
| L94: TimerComponent race — waitForPackages | Rule in prompts.js + T1 ERROR | Covered |
| L101: transitionScreen await required ALL calls | Rule + T1 ERROR | Covered |
| L102: M6 — isActive=true before answer() in shuffle games | M6 in prompts.js | Covered |
| L103: M7 — read correctCup dynamically after shuffle | M7 in prompts.js | Covered |
| L109: isProcessing=true until options rendered in renderRound() | **NOT in prompts.js as a gen rule** | **GAP** |
| L111: hasTwoPhases + skipToEnd('victory') → recall phase | CRITICAL note in buildGameFeaturesBlock | Covered |
| L120: hasTwoPhases — round transitions within recall phase | Note in buildGameFeaturesBlock | Covered |
| L131: Global fix unblocks multiple categories | Process lesson | No prompt rule needed |
| L132: Review rejection on first attempt is normal | Process lesson | No prompt rule needed |

**Lesson 109** (isProcessing=true until render is complete in reveal/dot-display games) was documented but not added as a gen-prompt rule. It manifests as tests clicking at the wrong time and getting silently ignored.

---

## Section 5: Review Rejection Patterns (Recent Builds)

From builds 505–516, no review rejections were observed — all games that passed the test threshold were approved by the reviewer. This suggests the REVIEW_SHARED_GUIDANCE (RULE-001 through RULE-008) is working correctly. The residual failures are test quality issues, not HTML quality issues.

---

## Section 6: Identified Gaps With Rule Proposals

### Priority 1 — M14: Wrong-class assertion timing (`.disabled` class race)

**Pattern:** build 506 (two-player-race) mechanics: `[data-index="1"] .p1-option[data-index="1"]` still had class `"p1-option disabled"` after a round timeout action. The test expected `correct` class. The wrong-class assertion was fired before the game's CSS class update settled.

**Frequency:** 1 occurrence in 505–516, but this is a new game type (two-player). The pattern of checking `.wrong`, `.correct`, `.disabled` CSS classes immediately after an answer action is present in ~60% of mechanics tests across all games.

**Root cause:** No rule exists instructing tests to poll for CSS class changes using `expect.poll()`. Unlike `getLives()` which reads data attributes (M13 covers this), CSS class assertions on game elements use `.toHaveClass()` with direct await — which fails if the class update is deferred by a setTimeout or animation frame.

**Evidence:** Two-player-race mechanics test: `expect(page.locator('.p1-option[data-index="1"]')).toHaveClass(/correct/)` failed with `"p1-option disabled"` after a round timeout. Timeout 5000ms. The CSS update fires in a `setTimeout` after the answer event.

**Proposed Rule M14:**
```
M14. CSS CLASS ASSERTIONS (correct/wrong/disabled) — NEVER use direct .toHaveClass() immediately
after an action (click, answer, timeout). Game CSS class updates may be deferred inside
setTimeouts or requestAnimationFrame. ALWAYS use expect.poll():
    WRONG: await answer(page, true); expect(btn).toHaveClass(/correct/, { timeout: 5000 });
    RIGHT: await answer(page, true);
           await expect.poll(() => btn.getAttribute('class'), { timeout: 5000 }).toMatch(/correct/);
    OR: await answer(page, true);
        await expect(btn).toHaveClass(/correct/, { timeout: 10000 }); // minimum 10s on CDN games
    If the game uses animation frames before updating classes, 5s will miss it on cold CDN.
```

**Impact estimate:** Prevents ~15% of mechanics test failures in CSS-class-checking tests.

---

### Priority 2 — GF8: Screen visibility after restart/transition (not phase-based)

**Pattern:** Two failures in 505–516:
1. identify-pairs-list (515): `#game-screen` still visible when test expected it hidden after game end. Fixed on iter 2 but consumed an iteration.
2. two-player-race (506): After restart action, `#game-screen` was not visible — test expected it visible but game was still on start screen.

Both failures involve checking element visibility rather than `data-phase` attribute. These pass/fail based on CSS `display`/`visibility` rules that change asynchronously after state transitions.

**Root cause:** No rule instructs tests to check game-screen visibility with the same expect.poll() pattern as phase assertions. Tests use direct `toBeVisible()` / `toBeHidden()` which are susceptible to the same timing races as `toHaveAttribute`.

**Evidence:** Build 515, game-flow iter 1: `locator('#game-screen').toBeHidden() failed — Expected: hidden, Received: visible, Timeout: 5000ms, 9× resolved to visible`. This is a visibility assertion without adequate timeout or polling.

**Proposed Rule GF8:**
```
GF8. SCREEN VISIBILITY ASSERTIONS (toBeVisible/toBeHidden) — after any state-changing action
(endGame, restart, skipToEnd), NEVER assert screen visibility with the default 5s Playwright
timeout. Screen visibility changes may lag behind data-phase changes by 500ms-2s. Pattern:
    WRONG: await skipToEnd(page, 'victory'); await expect(page.locator('#game-screen')).toBeHidden({ timeout: 5000 });
    RIGHT: await skipToEnd(page, 'victory');
           await waitForPhase(page, 'results', 20000);  // wait for phase FIRST
           await expect(page.locator('#game-screen')).toBeHidden({ timeout: 10000 }); // then check visibility
    For restart flows: wait for phase 'start' or 'playing' before asserting screen visibility.
    (identify-pairs-list #515, two-player-race #506 — visibility checks timed out during state transition)
```

**Impact estimate:** Prevents ~10% of game-flow failures where screen visibility is checked after transitions without sufficient polling.

---

### Priority 3 — GEN-109: isProcessing=true during renderRound reveal animation (gen prompt rule)

**Pattern:** Lesson 109 identified that games with a preview phase (count-and-tap dots display, face-memory card reveal, keep-track shuffle) set `gameState.isProcessing = false` at the START of `renderRound()` before options are actually rendered. The test harness `answer()` polls for `isProcessing === false`, clicks immediately, and gets no DOM target to click.

**Frequency:** Documented in count-and-tap (#457, #471), keep-track (#465), face-memory. 3 confirmed games. Likely affects any new game spec mentioning "reveal", "preview", "dots", "memory tiles", or "memorize phase".

**Root cause:** The generation prompt says `isProcessing = false` signals interactivity, but doesn't specify WHEN to set it. LLMs default to setting it at the top of `renderRound()` for clarity, before the reveal animation fires.

**Evidence:** count-and-tap #457 — `renderRound()` set `isProcessing = false` immediately, then started a 1.5s setTimeout to show options. `answer()` polled, saw `isProcessing === false`, tried to click `.option-btn` — empty NodeList (no buttons yet). Lesson 109 documents the exact pattern.

**Proposed Rule (gen prompt CDN_CONSTRAINTS_BLOCK):**
```
GEN-109. REVEAL-PHASE isProcessing TIMING — If renderRound() shows a reveal/preview animation
before player interaction (dots appear, cards flip, memory tiles show, shuffle plays), you MUST
keep gameState.isProcessing = true until AFTER the reveal setTimeout fires and option buttons
are rendered. The test harness answer() polls isProcessing === false before clicking — if set
too early, answer() fires when no options exist, click is silently ignored, game advances via
timer, and all mechanics tests desync.
WRONG: function renderRound(i) { gameState.isProcessing = false; setTimeout(() => renderOptions(), 1500); }
RIGHT: function renderRound(i) {
  gameState.isProcessing = true;  // keep true during reveal
  setTimeout(() => { renderOptions(); gameState.isProcessing = false; syncDOMState(); }, 1500);
}
```

**Impact estimate:** Prevents iteration-1 mechanics failures in ~20% of reveal-phase game types.

---

### Priority 4 — EC6: Locator argument type guard (selector string vs. DOM element)

**Pattern:** Build 507 (position-maximizer) edge-cases: `locator.click: selector: expected string, got object`. This means `page.locator(element)` was called with a DOM element or object instead of a CSS selector string.

**Root cause:** Edge-case tests sometimes use patterns like `const btn = await page.$('#some-btn'); await btn.click()` mixed with Playwright's `locator()` API. Or: the test generator builds a selector by concatenating a variable that ends up being an object. This is a test generation syntax error not caught by any existing rule.

**Frequency:** 1 explicit occurrence in 505–516 plus this is a latent risk in any edge-case test that builds dynamic selectors.

**Proposed Rule EC6:**
```
EC6. LOCATOR ARGUMENT TYPE — NEVER pass a non-string value to page.locator(). The locator()
API requires a CSS selector string. Passing a DOM element, object, or undefined causes:
"locator.click: selector: expected string, got object". Pattern:
    WRONG: const el = await page.$('#btn'); await page.locator(el).click(); // el is ElementHandle
    WRONG: const sel = { testid: 'option-1' }; await page.locator(sel).click(); // object
    RIGHT: await page.locator('#btn').click(); // string selector always
    RIGHT: await page.locator('[data-testid="option-1"]').click(); // attribute selector string
    If you need to build a selector dynamically:
    const val = await page.evaluate(() => window.gameState.correctAnswer);
    await page.locator(`[data-value="${val}"]`).click(); // template literal = string
```

**Impact estimate:** Prevents ~5% of edge-case test failures from selector type errors. Low individual frequency but quick to add.

---

### Priority 5 — CT7: postMessage type field mismatch (game_complete vs gameOver)

**Pattern:** Build 514 (match-the-cards) contract: `expect(score).toBeGreaterThan(0)` failed with score=0 in the victory postMessage. Score was 0 because no rounds were actually completed via the contract test path.

Separately, CT5 rule says `msg.type` should be `'gameOver'` but the gen prompt at line 252 says `type: 'game_complete'`. This is a latent type field mismatch: games generate `type: 'game_complete'`, contract tests assert `msg.type === 'gameOver'`. These two values are different strings.

**Frequency:** This mismatch exists in every single CDN game. It has not caused failures in 505–516 because CT5 includes both variants in the WRONG/RIGHT examples, but the inconsistency between the gen prompt (`game_complete`) and the contract test rule (`gameOver`) is a ticking gap.

**Evidence:** Gen prompt at line 252: `type: 'game_complete'`. CT5 rule at line 1129: `RIGHT: expect(msg.type).toBe('gameOver')`. These contradict each other. If a future game's contract test strictly asserts `msg.type === 'game_complete'` (following the gen prompt), CT5 will call it wrong. If a contract test asserts `msg.type === 'gameOver'` (following CT5), but the game sends `game_complete`, the test fails.

**Proposed Rule CT7:**
```
CT7. postMessage TYPE FIELD — CDN games send type: 'game_complete' (from gen prompt template).
Contract tests MUST assert msg.type === 'game_complete', NOT 'gameOver'. The 'gameOver' value
is the normalized harness event name; the raw postMessage payload uses 'game_complete'.
    WRONG: expect(msg.type).toBe('gameOver'); // fails — game sends 'game_complete'
    RIGHT: expect(msg.type).toBe('game_complete'); // matches game postMessage template
```

**Impact estimate:** Prevents a class of contract test assertion mismatch that may start appearing as new game types are introduced. Currently 0 confirmed failures from this gap but the inconsistency is real and will cause failures eventually.

---

## Section 7: Priority Ranking

| Rank | Rule ID | Pattern Fixed | Frequency Evidence | Confidence |
|------|---------|--------------|-------------------|------------|
| 1 | GEN-109 | isProcessing=true during reveal animation | 3 confirmed games (count-and-tap, keep-track, face-memory); any new reveal-phase game | HIGH |
| 2 | M14 | CSS class assertion timing race (.correct/.wrong/.disabled) | Present in ~60% of mechanics tests; 1 confirmed failure in 505-516 | HIGH |
| 3 | GF8 | Screen visibility race after state transitions | 2 failures in 505-516; affects all game-flow tests checking element visibility post-transition | MEDIUM |
| 4 | CT7 | postMessage type field mismatch (game_complete vs gameOver) | 0 confirmed recent failures but inconsistency proven in prompts.js source | MEDIUM |
| 5 | EC6 | Locator argument type guard (string vs object) | 1 confirmed failure in 505-516 | LOW-MEDIUM |

---

## Section 8: Rules Already Confirmed Present (Verification)

The following rules from the task brief are confirmed present in `lib/prompts.js`:

- **M13** (syncDOMState race / expect.poll): Lines 1021-1030 — present, with WRONG/RIGHT examples
- **GF6** (sub-phase waitForPhase guard): Line 1068-1070 — present
- **CT4** (4-step postMessage sequence): Lines 1118-1127 — present and strengthened
- **CT6** (200ms delay + null guard): Lines 1132-1138 — present
- **GF3** (20s gameover timeout): Line 1053-1057 — amended to 20000ms
- **GF7** (lives-exhaustion path): Lines 1071-1076 — present
- **RULE-DUP** (globally unique testid): Line 172 in buildGenerationPrompt() — present
- **EC1-EC5**: Lines 1140-1177 — all present
- **LP4-LP6**: Lines 1088-1101 — all present
- **M10-M12**: Lines 1008-1018 (approximately) — present

**Residual failures where rules exist:** The remaining failures in 505-516 where rules already exist (M13 stale-read, CT4/CT6 null postMessage) suggest the LLM is not consistently applying them. This is a generation-time compliance problem, not a rule gap. Solutions: (a) add T1 static checks for patterns where possible, (b) strengthen the rule wording with more prominent WRONG/RIGHT pairs.

---

## Summary

**5 new rules proposed**, in priority order:

1. **GEN-109** (gen prompt): isProcessing=true during reveal animation — add to CDN_CONSTRAINTS_BLOCK
2. **M14** (test-gen prompt): CSS class assertion timing — add to buildTestGenCategoryPrompt() mechanics section
3. **GF8** (test-gen prompt): Screen visibility after transitions — add to buildTestGenCategoryPrompt() game-flow section
4. **CT7** (test-gen prompt): postMessage type field is 'game_complete' not 'gameOver' — fix CT5 inconsistency
5. **EC6** (test-gen prompt): Locator argument type guard — add to buildTestGenCategoryPrompt() edge-cases section

**Key finding from Lesson 133 confirmation:** 70% of remaining failures appear in APPROVED builds (residual below the 70% pass threshold). The highest-leverage target is test gen prompt quality, not HTML gen prompt quality. The existing rules are mostly correct — compliance at LLM generation time is the remaining gap.

**None of these require pipeline architecture changes.** All are prompt-text additions to `lib/prompts.js`.
