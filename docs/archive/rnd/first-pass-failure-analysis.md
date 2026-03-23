# R&D: First-Pass (Iteration-1) Failure Analysis

**Date:** 2026-03-20
**Analyst:** R&D sub-agent
**Hypothesis under test:** Test-gen produces tests with wrong selectors or data-shape assumptions — NOT HTML init bugs — is the dominant cause of iteration-1 failures. If true, injecting `window.gameState` shape more aggressively should cut avg iterations from ~3 to ~1.5.

---

## 1. Sample Size

- **Triage messages analyzed:** 65 (from journal logs spanning 2026-03-20 00:00–11:30 UTC, ~40 games)
- **Builds with iteration data in DB:** 20 builds (19 with parseable iter1 results)
- **Build status breakdown** (builds that ran at least 1 iteration):
  - failed: 17 (avg 3.18 iterations)
  - rejected: 2 (avg 1.0 iterations)
  - approved: 1 (avg 1.0 iterations)
- **Iteration count distribution:**
  - 1 iteration: 8 builds (47%)
  - 2 iterations: 1 build (6%)
  - 3 iterations: 4 builds (24%)
  - 5 iterations: 7 builds (41%)

Note: The vast majority of recent builds (IDs 241–297, spanning ~50 games) have `iterations=0` and `status=failed`, meaning they failed before test-gen even ran (likely validation or early-review failure). This analysis focuses only on builds that completed at least one test iteration.

---

## 2. Triage Verdict Breakdown (N=65 triage events)

| Category | Triage Verdict | Count | % |
|----------|----------------|-------|---|
| **C: HTML init bug** | `fix_html` — game never initializes, `#mathai-transition-slot button` never appears | 38 | 58% |
| **C: HTML logic bug** | `fix_html` — game initializes but phase transitions broken, data-phase never set | 14 | 22% |
| **B: Data shape wrong** | `skip_tests` / `mixed` — test accesses `.validSolution`, `.gridNumbers`, `.faceFeatures`, `.eyes` that don't exist in gameState/fallbackContent | 6 | 9% |
| **F: Contract bug** | `fix_html` — postMessage payload missing fields (`duration_data`, `metrics`, `events`) | 4 | 6% |
| **E: Timing** | Mixed timing (visibility API, timing races) | 2 | 3% |
| **A: Test selector wrong** | Selector incorrect (pure wrong-ID issue, not data-shape) | 1 | 2% |

**Total:** 65 triage events across ~40 game-build iterations.

---

## 3. Detailed Category Analysis

### Category C — HTML Init / Logic Bugs (80% combined)

The single dominant failure mode is **the generated HTML game failing to initialize or failing to execute phase transitions**. This shows up as:

1. **Fatal init failure (58%):** The game page loads but `#mathai-transition-slot button` never becomes visible within 30s. Triage consistently labels this `fix_html` with the message "fundamental JavaScript initialization failure." These are NOT test problems — the game is broken before any test logic runs.

2. **Phase transition missing (22%):** The game initializes (start screen visible) but `data-phase` is never set to `'playing'`, `'gameover'`, or `'results'`. Specific sub-patterns observed:
   - `gameState.phase` updated but `syncDOMState()` not writing `data-phase` to `#app`
   - `endGame()` not updating `gameState.phase` before `syncDOMState()` fires
   - Game using CSS class toggling (`.hidden`) instead of inline `display:none` — causing `display: ''` vs `'none'` confusion in tests

### Category B — Data Shape Wrong (9%)

A secondary failure class: tests assume gameState properties that do not exist. Observed examples:
- `round.validSolution` — test gen assumed an array of solution indices; game uses a different interaction model (grid clicks without pre-computed solutions)
- `round.gridNumbers` — assumed from gameState snapshot but property not present in `fallbackContent` rounds used at test runtime
- `window.gameState.faceFeatures.eyes` — assumed nested object structure that was never initialized (JS init failure causing cascading undefined)

**Key finding for B:** The DOM snapshot succeeds for ~60% of builds (5 of 9 snapshot attempts today succeeded). When it succeeds, the `WINDOW.GAMESTATE SHAPE` section IS injected into the test-gen prompt with actual property names. Despite this, data-shape errors still appear because: (a) `fallbackContent` comes from spec-derived rounds (not runtime), and (b) nested sub-properties inside gameState objects are not fully described.

### Category A — Wrong Selectors (2%)

Only 1 triage event was attributable to a pure selector mismatch (wrong CSS class name). The DOM snapshot injection appears to be effectively preventing test-gen from inventing bad selectors — this was a historical problem that is now largely solved.

---

## 4. DOM Snapshot Success Rate

From today's 9 DOM snapshot attempts:
- **Success:** 5 (56%) — full snapshot with gameState keys captured
- **Failed → fallback:** 4 (44%) — timed out on `#mathai-transition-slot button`

**Critical observation:** When DOM snapshot fails (because the game itself is broken at Step 2.5), the test-gen still runs — but it generates tests for a game that is provably already broken. This is wasted LLM compute. The game's first-ever init failure is detected at Step 2.5 (DOM snapshot), but the pipeline does not abort — it continues to generate tests and then discover the failure again at iteration 1.

---

## 5. The #1 Dominant Failure Type

**C: HTML Init Bug** — the LLM-generated HTML game fails to execute JavaScript initialization, so `#mathai-transition-slot` never becomes visible.

This accounts for **~58% of triage events** (38/65) and is the single highest-leverage failure mode. It is NOT a test quality problem. Injecting better `window.gameState` shape into test-gen prompts would not reduce these failures because the tests aren't even reaching game logic — they time out in `beforeEach`.

---

## 6. Hypothesis Verdict

**The original hypothesis is FALSE.**

> "Test-gen produces tests with wrong selectors or data-shape assumptions rather than the HTML having init bugs."

The data shows the opposite: **~80% of iteration-1 failures are HTML bugs (categories C + contract), not test-gen bugs.** Wrong selectors are near-zero (1 instance). Data-shape errors are real but secondary (9%).

The proposed fix (injecting `window.gameState` shape more aggressively) would address only ~9% of failures — not enough to move avg iterations from 3 → 1.5.

---

## 7. Revised Hypothesis

**New hypothesis:** If we detect HTML init failure at Step 2.5 (DOM snapshot) and **abort the build immediately** rather than proceeding to test-gen, we eliminate 44% of wasted pipeline runs (4 out of 9 today). Combined with a strengthened generation prompt that catches the most common init patterns (`syncDOMState()` absent, `DOMContentLoaded` scope bug, missing `window.gameState = gameState`), we could reduce the % of builds failing at iteration 1 from ~80% to ~30%.

**Sub-hypothesis 2:** The phase-transition bug (22%) is caused by LLMs consistently implementing `gameState.phase` updates without wiring them to `syncDOMState()`. A single mandatory rule added to the generation prompt — "after every `gameState.phase =` assignment, immediately call `syncDOMState()`" — would prevent this class entirely.

---

## 8. Recommended Next Actions

**Priority 1 (highest leverage): Abort on DOM snapshot failure.**
When `captureGameDomSnapshot()` fails (timeout on `#mathai-transition-slot`), mark the build as failed and trigger a `fix_html` pass immediately — do NOT generate tests. This eliminates a full LLM test-gen call + iteration-1 wasted run for the 44% of games with fatal init failures. Expected impact: reduce wasted pipeline time by ~30 minutes per failed game.

**Priority 2: Add mandatory gen-prompt rule for syncDOMState.**
Add to `buildGenerationPrompt()`: "After EVERY assignment to `gameState.phase`, you MUST call `syncDOMState()` on the next line. No exceptions." This addresses the 22% phase-transition failure class.

**Priority 3 (secondary): Inject fallbackContent shape into test-gen.**
When fallbackContent rounds are spec-derived (not from DOM snapshot), inject the actual round object schema into the test-gen prompt so tests don't assume non-existent properties like `validSolution`.

---

## 9. Data Sources

- Server DB: `builds` table, builds 1–51 (all builds with `iterations >= 1`)
- Worker logs: `journalctl -u ralph-worker` from 2026-03-20 00:00–11:30 UTC
- `failure_patterns` table: 20 patterns (all `adjustment-strategy` game, rendering category)
- `lib/prompts.js`: `buildTestGenCategoryPrompt` — confirms DOM snapshot IS injected when available; `buildTestCasesPrompt` — confirms warnings about `window.gameState` presence
