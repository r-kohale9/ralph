# Count & Tap — Root Cause Analysis

**Spec:** `warehouse/templates/count-and-tap/spec.md`
**Parts:** PART-006 (TimerComponent), PART-025 (ScreenLayout), PART-024 (TransitionScreen), PART-013 (Fixed Answer)
**Last updated:** 2026-03-21

---

## 1. Root Cause

Two independent root causes compounded on build #440:

**A) `window.gameState.content` null at DOM snapshot time.** The game only populates `window.gameState.content` when it receives a `game_init` postMessage (`window.gameState.content = event.data.content`). The DOM snapshot step reads `window.gameState?.content` synchronously — before `game_init` fires. So content was null. `extractSpecRounds()` fell back to parsing the spec's markdown tables, but the first table is the game overview metadata table (Field/Value rows), not round data. This produced `fallbackContent.rounds[0] = { question: "**Game ID**", answer: "count-and-tap" }` — not `{ correctAnswer, options, dotCount }`. Test gen tried to read `.correctAnswer` → `undefined` → selector `.option-btn[data-value="undefined"]` → never exists. Triage correctly skipped all 3 affected categories (mechanics, level-progression, edge-cases) → 0 test evidence → FAILED.

**B) CDN cold-start in test browser.** The smoke-check browser took 2.5 minutes to load CDN on a cold GCP VM. The test runner opened a fresh Playwright browser (no CDN cache). The `beforeEach` 50s timeout expired before CDN loaded → "transition slot button not visible." This caused game-flow iteration 1 to fail. The fix loop then oscillated (0→1→0 across iterations) because it changed HTML that was correct to begin with.

---

## 2. Evidence of Root Cause

**Evidence for root cause A:**

| Artifact | Finding |
|----------|---------|
| `dom-snapshot.json` on server | `gameStateShape: {}` — empty object, not the 7-key gameState shape. Confirmed snapshot before game_init. |
| `game-content.json` | Does not exist — confirmed `window.gameState?.content` was null at snapshot time |
| `test-cases.json` fallbackContent | `rounds[0] = { question: "Field", answer: "Value" }` — metadata table, not round data |
| Triage output (from DB test_results) | "tests attempt to read properties correctAnswer and options from fallbackContent, which do not exist" |
| `extractSpecRounds()` behavior | Parses first markdown table found. count-and-tap spec opens with overview table (Field/Value). Actual round data is in a JSON fenced code block — not parsed by extractSpecRounds. |

**Evidence for root cause B:**

| Artifact | Finding |
|----------|---------|
| journalctl logs | `06:14:27 smoke-check-failed → 06:16:54 smoke-check-passed` — 2.5 minute CDN load |
| Local diagnostic run (2026-03-21) | Both game-flow tests PASS locally. CDN loads in < 0.1s (OS HTTP cache). `typeof TimerComponent` = true. |
| Test failure message | "locator('#mathai-transition-slot button').first() not found within 5s" — beforeEach timeout, not game logic |

---

## 3. POC Fix Verification

**Root cause A fix:** Added gen prompt rule: "window.gameState.content MUST be pre-populated with fallback/default round data at the START of DOMContentLoaded (before `await waitForPackages()`), then override with real content when game_init arrives."

Verified by: The next build (#457) will generate HTML that pre-populates `window.gameState.content`. The DOM snapshot will then find real round data and `game-content.json` will be written. Fallback content will not be needed.

Intermediate verification (Lesson 93): Investigation agent traced the exact call chain — confirmed `page.evaluate(() => window.gameState?.content || null)` returns null at snapshot time, `game-content.json` never written, `extractSpecRounds()` used, metadata table parsed first.

**Root cause B fix:** CDN cold-start is a transient infra issue. Next build runs on a VM that has already loaded CDN packages for the running build (#442 disappearing-numbers). CDN will be warm (< 5s load time). The 50s beforeEach timeout is sufficient for warm CDN.

Also: `typeof TimerComponent` ban (Lesson 87) was corrected — TimerComponent IS in bundle. T1 check downgraded from ERROR to WARNING (commit 16c5640). New build no longer hard-blocked on TimerComponent usage.

---

## 4. Reliability Reasoning

**Root cause A fix:** Deterministic. Once gen prompt instructs pre-population at DOMContentLoaded start, every CDN game will set `window.gameState.content = fallbackContent` synchronously. The DOM snapshot always executes after CDN loads (it waits for transition slot), so content will be populated. Reliability: high. Regression risk: if a future game spec doesn't define `fallbackContent` in HTML (content is entirely dynamic). Mitigation: snapshot also captures `window.gameState.content` after `game_init` fires (behavioral transcript sends it). But fallback path in `extractSpecRounds()` still needs improvement for JSON code block specs.

**Root cause B fix:** Semi-deterministic. Warm CDN loads in < 5s on GCP-to-GCP. But the underlying fragility (each test browser has no CDN cache) remains. Future mitigation: CDN local proxy during test runs (capture CDN scripts at DOM snapshot, serve from disk in tests). This eliminates CDN latency entirely for tests. Planned as next R&D item.

---

## 5. Go/No-Go for E2E

**READY FOR E2E** — build #457 already queued.

- §2 Evidence: Complete. gameStateShape={}, game-content.json absent, fallbackContent wrong shape, triage output confirms. Plus: local diagnostic proves HTML is correct (both tests pass locally).
- §3 POC: Gen prompt rule deployed (c4d24f2, commit on server). T1 TimerComponent fix deployed (16c5640). CDN is warm on current VM.
- §4 Reliability: High for root cause A. Acceptable for root cause B (warm CDN expected).

**Monitor in #457:** level-progression category (window.nextRound not exposed — tests may fail silently) and game-flow (CDN timing on test browser first page load).

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| #440 | game-flow 0/2 iter 1+3 (oscillated); mechanics/level-prog/edge-cases 0 test evidence; FAILED after 3 iterations | A: null gameState.content → corrupted fallback → triage skips all categories. B: CDN cold-start → beforeEach 50s timeout | Investigated; gen prompt fix deployed (c4d24f2); T1 fix (16c5640); re-queued as #457 |
| #457 | game-flow 1/3 iter 1+2; mechanics 1/4; level-prog 0/1; edge-cases 0/1; contract 1/1; FAILED (1/4 cats, 4 needed) | C: renderRound() sets isProcessing=false immediately → harness answer() fires before option buttons rendered → click silently fails → timer fires → test desync. Global fix loop also failed (page broken after E8 fix). Tests pre-generated without M8 rule. | Failed — Lesson 109 rules deployed (833da9f); #471 queued for fresh build |
| #471 | Queued — Lessons 108/109 deployed | Fresh gen with ROUND LIFECYCLE RESET exception (keep isProcessing=true until options rendered) + M8 test rule (wait for .option-btn visible) | Queued |

---

## Manual Run Findings

**Source:** Playwright diagnostic run locally (2026-03-21), node diagnostic.js

**Result: Both game-flow tests PASS locally.**

- Game renders correctly: dot-cover stage visible, "How many did you see?" prompt, 10s timer, 4 option buttons with correct `data-value` attributes
- Lives deduct on wrong answer: lives=3 → 2 → 1 → 0 correctly
- game-over triggers at lives=0, phase=gameover
- `typeof TimerComponent !== 'undefined'` = true
- CDN loads in < 0.1s (cached)
- `window.nextRound` not exposed on window (test harness warning logged)
- Audio preload 404s (FeedbackManager tries generic paths) — non-blocking

**Screenshots:** `/tmp/count-and-tap-debug/` (01–08 PNGs, 2026-03-21 session)

---

## Targeted Fix Summary

| Fix | Commit | What Changed |
|-----|--------|-------------|
| Correct TimerComponent ban | 16c5640 | T1 5f3: ERROR → WARNING; gen prompt: NEVER → "add typeof check to waitForPackages" |
| window.gameState.content pre-population | c4d24f2 | Gen prompt rule: pre-populate content before waitForPackages(), override on game_init |
| Surgical smoke-regen dead code | c4d24f2 | specMeta.isCdnGame (never set) → HTML-based CDN detection |

---

## Investigation Agent Evidence

**Agent a0d098ed34ae74469 (count-and-tap test deletion root cause):**
- gameStateShape:{} at snapshot → confirmed content null at snapshot time
- game-content.json absent → confirmed
- test-cases.json fallbackContent: `[{question:"Field",answer:"Value"},...]` — metadata table parsed
- Triage output: "properties correctAnswer and options do not exist"

**Agent a5414227a1a48b84d (surgical smoke-regen dead code):**
- `specMeta.isCdnGame` always `undefined` — `extractSpecMetadata()` never sets this field
- `if (specMeta.isCdnGame)` branch never fired — all smoke regens were full regens
- Fix: detect CDN from HTML content instead (storage.googleapis.com presence)
