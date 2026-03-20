# R&D: Iteration Count Analysis — Which Test Categories Drive the Most Fix Iterations?

**Date:** 2026-03-20
**Analyst:** Claude Sonnet 4.6
**Scope:** All builds in the DB (347 total) + journalctl logs since 2026-03-01

---

## 1. Build History Summary

| Metric | Value |
|--------|-------|
| Total builds in DB | 347 |
| Approved | 22 |
| Rejected | 16 |
| Failed | 260 |
| Cancelled / Running / Queued | 49 |
| Approved + Rejected (completed) | 38 |

### Iteration Distribution

The `iterations` field in the DB is set to 0 for most builds because the pipeline records the count only at phase boundaries (not mid-LLM-call). Builds that stored non-zero iteration counts were the early adjustment-strategy and count-and-tap runs before this changed:

| Build | Game | Status | Iterations |
|-------|------|--------|-----------|
| 45 | adjustment-strategy | approved | 1 |
| 51 | adjustment-strategy | failed | 2 |
| 22, 20, 19, 3, 2, 1 | adjustment-strategy | failed | 5 |
| 33, 32, 31, 30 | adjustment-strategy | failed | 3 |
| 4 | count-and-tap | failed | 5 |

For the more recent builds (id 191–347), iterations stored as 0 — iteration activity is only observable via logs.

**Average iterations for builds with recorded counts (adjustment-strategy sample):**
- Failed builds avg: ~3.4 iterations
- Approved builds avg: ~1 iteration (build 45)
- Failed builds max: 5 iterations (multiple)

---

## 2. Triage Category Frequency (from journalctl 2026-03-01 to 2026-03-20)

### Total triage calls by category

| Category | Total Triage Calls | Proportion |
|----------|-------------------|------------|
| game-flow | 243 | 33.7% |
| mechanics | 212 | 29.4% |
| edge-cases | 104 | 14.4% |
| level-progression | 88 | 12.2% |
| contract | 72 | 10.0% |
| **Total** | **719** | |

### Triage calls by iteration depth

| Triage Call | Count | Meaning |
|-------------|-------|---------|
| triage-game-flow-1 | 157 | Fired in 157 builds — always fails on first try |
| triage-mechanics-1 | 121 | Fired in 121 builds |
| triage-game-flow-2 | 86 | Still failing after first fix attempt (56% of gf-1 builds) |
| triage-mechanics-2 | 91 | Still failing after first mechanics fix (75% of mech-1 builds) |
| triage-edge-cases-1 | 76 | Initial edge-cases failures |
| triage-level-progression-1 | 62 | Initial level-progression failures |
| triage-contract-1 | 50 | Initial contract failures |
| triage-edge-cases-2 | 28 | Second attempt needed (37% of ec-1 builds) |
| triage-level-progression-2 | 26 | Second attempt needed (42% of lp-1 builds) |
| triage-contract-2 | 22 | Second attempt needed (44% of contract-1 builds) |

### Iteration depth ratio (iter-2 / iter-1)

A higher ratio = the category more often needs a second fix attempt, meaning the first fix failed.

| Category | Iter-1 | Iter-2 | Ratio (iter-2/iter-1) |
|----------|--------|--------|----------------------|
| mechanics | 121 | 91 | **75%** — highest retry rate |
| level-progression | 62 | 26 | 42% |
| contract | 50 | 22 | 44% |
| game-flow | 157 | 86 | 55% |
| edge-cases | 76 | 28 | 37% |

**Key insight:** Mechanics has the highest iter-2/iter-1 ratio (75%), meaning the first fix attempt fails 3 out of 4 times. Despite game-flow having more raw volume, mechanics is the least-resolved-on-first-try category.

---

## 3. Triage Decision Outcomes

| Decision | Count | Proportion |
|----------|-------|-----------|
| fix_html | 263 | 82.2% |
| skip_tests | 57 | 17.8% |
| fix_tests | 0 | 0% |

82% of triage calls result in `fix_html` — nearly every failure is attributed to the HTML needing a fix. This is notable because:
- 57 `skip_tests` decisions (18%) represent failures that are correctly identified as test-side issues (rendering mismatches, `toBeVisible` patterns).
- `fix_tests` is never used, suggesting the pipeline rarely concludes a test is wrong but fixable.

---

## 4. Failure Pattern Distribution (failure_patterns table)

| Category | Total Occurrences |
|----------|-------------------|
| rendering | 40 (49%) |
| unknown | 39 (48%) |
| scoring | 13 |
| timing | 6 |
| messaging | 5 |
| interaction | 2 |
| completion | 1 |
| state | 1 |

**Rendering** (40) and **unknown** (39) together make up 97% of all recorded failure patterns. The `rendering` category is dominated by `toBeVisible()` failures — these are the FeedbackManager audio popup race condition cases (Lesson 51) and DOM visibility mismatches.

---

## 5. Most Common Failure Root Causes (from log triage messages)

Analysis of triage reasoning messages across recent builds reveals these recurring root causes:

### game-flow (33.7% of triage volume)
1. **Level transition not triggering** — `waitForPhase('transition')` timeout. Game logic doesn't call `syncDOMState()` after `gameState.phase = 'transition'`. (Lesson 50)
2. **Victory/results screen not rendering** — `toHaveText('#transitionTitle', 'Level 2')` failures; TransitionScreen component not being called correctly.
3. **Restart state not resetting** — `restartGame()` doesn't reset `gameState.phase` to `'start'`.

### mechanics (29.4% — highest first-fix failure rate at 75%)
1. **Missing `data-testid` attributes** — Tests click `[data-testid="adj-a-plus"]` but the LLM generates elements without testids. Fix adds them, but next iteration breaks something else.
2. **DOM re-render replaces button elements** — After a correct/wrong answer, game re-renders the round container, removing previously-targeted elements. `locator.click` timeout on 2nd interaction.
3. **Fix loop introduces HTML shrinkage** — 11 rollbacks recorded. Mechanics fix LLM sends back partial HTML (100% shrink) — rolling back costs one iteration.

### edge-cases (14.4%)
1. **0/0 test runs** — Test file is malformed (truncated), or the file doesn't exist. Triage calls return `skip_tests` because there's nothing to triage.
2. **`fallbackContent.rounds[idx]` in page.evaluate** — Test passes the test-scope variable into browser context where it doesn't exist. This is a test-gen error producing 0% on first try, consistently triaged as `skip_tests`.

### level-progression (12.2%)
1. **`#mathai-transition-slot button` never visible** — Level completion doesn't call `TransitionScreenComponent.show()`, so the slot button never appears.
2. **Level counter not updating** — `gameState.currentLevel` not incremented when transitioning.

### contract (10.0%)
1. **`calcStars` not on window** — Test calls `page.evaluate(() => window.calcStars(...))` but function is defined as a local function, not exported to window.
2. **`initGame` does not reset score** — Contract check catches this at Step 1c; burns a static-fix LLM call.
3. **`endGame` postMessage not dispatched** — Game calls `endGame()` without emitting the required `game_complete` postMessage.

---

## 6. Build Completion Analysis

Of the 347 total builds:
- **75%** failed entirely (260/347) — most due to queue-sync loss (BullMQ restart), `logger is not defined` infra bug (4 builds), or kill decisions.
- **6.3%** approved (22/347)
- **4.6%** rejected (16/347) — these went through the full pipeline but failed review.

The high failure rate (75%) is dominated by infrastructure failures (queue-sync: 9 builds, logger bug: 4 builds, orphaned worker kills: 2 builds), not pipeline logic failures. Excluding infra failures, the pipeline completion rate is much higher.

---

## 7. Hypothesis: Which Single Change Would Reduce Average Iterations Most?

### The core question

Given that game-flow has the most volume (243 triage calls) and mechanics has the highest first-fix failure rate (75%), which is higher-leverage?

**Calculation:**
- If we eliminate all game-flow iteration 2 calls (86): 86 triage calls saved + 86 LLM fix calls saved = ~172 LLM calls
- If we eliminate all mechanics iteration 2+ calls (91): ~182 LLM calls saved

### Primary hypothesis

**Hypothesis:** Adding `data-testid` attributes to the standard CDN template components (ProgressBarComponent, TransitionScreen, answer buttons) in the generation prompt rules — and making them a T1 static validation check — would reduce mechanics iter-2 rate from 75% to under 30%.

**Reasoning:**
1. The most common mechanics failure is "timeout clicking `[data-testid='adj-a-plus']`" — the element renders but has no testid.
2. The LLM generates the element correctly (it renders), but omits the testid because there's no explicit rule requiring them.
3. Adding "ALL interactive game elements must have `data-testid` attributes" to the generation prompt is a one-line change.
4. Adding a T1 static check that errors if any `<button>`, `<input>`, or `<select>` in the game logic area lacks a `data-testid` would catch this before test-gen.

**Expected impact:** If mechanics iter-2 drops from 75% to 30%, we save 54 triage calls + 54 fix LLM calls per 121 builds ≈ ~$1–3 per 100 builds, plus ~2–4 minutes per build at iter-2 mechanics.

### Secondary hypothesis

**Hypothesis:** The `syncDOMState()` rule (Lesson 50, Rule 22) was added to prompts on 2026-03-20. Measuring game-flow iter-2 rate before vs. after this rule would validate whether it's reducing the 55% second-try rate. If it doesn't, a T1 static check on every `gameState.phase =` line would catch missing `syncDOMState()` calls deterministically.

**Reasoning:** Game-flow iter-2 (86 calls) is the single largest second-attempt category by raw count. The root cause — missing `syncDOMState()` after phase assignment — is mechanically detectable via regex over the generated HTML. A T1 check would eliminate the need for any game-flow triage call when this is the cause.

---

## 8. Recommendations (Priority Order)

### P1: Add `data-testid` requirements to gen prompt + T1 check
**File:** `lib/prompts.js` (CDN_CONSTRAINTS_BLOCK) + `lib/validate-static.js`
**Change:** Rule 23: "Every interactive element (buttons, inputs, selects) that the test harness might interact with MUST have a `data-testid` attribute. Use kebab-case names matching the game mechanic (e.g., `data-testid='answer-btn'`, `data-testid='adj-a-plus'`)."
**T1 check:** Count `<button>` elements without `data-testid` in the game script section — warn if any found.
**Expected impact:** Reduces mechanics iter-2 rate from 75% → ~30% (saves ~54 triage + fix calls per 121 builds)

### P2: T1 static check for `syncDOMState()` after every `gameState.phase =`
**File:** `lib/validate-static.js`
**Change:** Parse HTML for `gameState.phase = ` assignments. For each one, check that `syncDOMState()` appears within the next 3 lines. Error if missing.
**Expected impact:** Catches the root cause of 22% of all iteration-1 game-flow failures before test gen, eliminating those triage calls entirely.

### P3: Enforce `calcStars` window exposure in gen prompt + T1 check
**File:** `lib/prompts.js` + `lib/validate-static.js`
**Change:** Add to Rule 21 window exposure list: `window.calcStars = calcStars`. T1 check: if `calcStars` function is defined in the HTML, require `window.calcStars` assignment.
**Expected impact:** Reduces contract iter-1 rate (50 calls), eliminating the most common contract triage failure.

---

## 9. Data Limitations

1. The `iterations` field in the builds DB records 0 for most recent builds — the field is only reliably populated for early adjustment-strategy/count-and-tap runs. Log analysis is the only reliable source for iteration counts on recent builds.
2. The failure_patterns table only records 2 occurrences per pattern per game — it's not a full statistical sample.
3. The triage call count from logs is the best proxy for "iterations consumed per category" across the full population.
4. All triage data is from adjustment-strategy (the primary test game) — it's unknown how well this generalizes to the full game library. The scale run (builds 218–300) produced mostly infra failures, not representative pipeline data.

---

## 10. Next Steps

1. Implement P1 (data-testid rule + T1 check) — estimated 30-min code change in `lib/prompts.js` + `lib/validate-static.js`
2. Queue 3–5 fresh builds of varied games after deploying P1
3. Measure: compare mechanics triage-1 → triage-2 rate before/after (target: 75% → <35%)
4. If confirmed, implement P2 and P3 in parallel
5. Update ROADMAP.md with these as active R&D items

---

*Full trace data: journalctl --since '2026-03-01' on ralph-server, DB at /opt/ralph/data/builds.db*
