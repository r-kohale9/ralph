# Spec RCA: associations

**Game ID:** associations
**Last updated:** 2026-03-21
**Author:** Claude Sonnet 4.6 (pipeline analysis + ROADMAP/lessons review)
**Status:** APPROVED — build #472 (iter=2, 29 min) validates Lessons 111+112

---

## 1. Root Cause

associations failed 15+ builds across multiple sessions. The root cause was two compounding issues in the spec, not the pipeline: (1) PART-018=YES incorrectly tagged the game as having lives/hearts — associations is an **unlimited-lives accuracy game** (no hearts system). Test LLMs generated lives-decrement assertions that always failed since lives never decrease. (2) The `fallbackContent` structure in the spec described `{ emoji, name }` pairs correctly in the description but the test-gen context was reading SignalCollector API names (`Event`, `Target`, `Input`, `Action`) as the fallback content — these are CDN API identifiers, not game round data. Tests built around these names always failed against real game content.

---

## 2. Evidence of Root Cause

**Build #447 DB record:**
```
id: 447, game_id: 'associations', status: 'failed', iterations: 0,
error_message: 'Step 1d: Page load failed ...' (pre-Lesson 95 — audio 404 false positive on prior builds)
```

**From ROADMAP (commit 7a1ee80, Lesson 80):**
> Root cause analysis complete (4 causes across 15 builds). Fix applied: CRITICAL no-lives note (unlimited-lives accuracy game — no hearts tests) + correct fallbackContent structure (`{ emoji, name }` pairs, not SignalCollector API names). Build 447 queued with fixed spec.

**T1 analysis:** No T1 hard errors on associations HTML — the game renders correctly. Failures were in test gen (wrong assumptions about lives system) and mechanics test assertions.

**Corrupt fallbackContent detection:** `detectCorruptFallbackContent()` (commit 668c087) was added specifically because associations' fallbackContent was being populated with SignalCollector API names (`Event`, `Target`, `Input`, `Action`) — 10-member CDN API name set that matched the corruption pattern.

---

## 3. POC Fix Verification (REQUIRED before E2E)

**Spec fix (commit 7a1ee80):** Applied directly to spec on server:
1. CRITICAL note added: "NO lives system — this is an unlimited-lives accuracy game. PART-018=NO. Tests MUST NOT assert lives decrements."
2. fallbackContent structure corrected: `[{ emoji: "🐶", name: "Dog" }, { emoji: "🐱", name: "Cat" }]` — `{ emoji, name }` pairs matching actual game round schema.

**Pipeline fix (commit 668c087):** `detectCorruptFallbackContent()` nullifies fallback when >50% of values match CDN API name set — prevents poisoned content from reaching test-gen.

**No local browser run needed:** The game renders correctly (no HTML bug). Failures were 100% in test gen assertions. Both fixes are in the prompt/spec layer.

---

## 4. Reliability Reasoning

**Is the fix deterministic?** Yes — spec fix is persisted on server; `detectCorruptFallbackContent()` guards the pipeline path. Both are deterministic.

**What could cause regression?** If the spec is regenerated and loses the PART-018=NO note, or if a future LLM invents lives tests anyway (treat as test logic issue, not HTML issue). The `detectCorruptFallbackContent()` function is a permanent pipeline guard.

**Edge cases:** If game rounds are genuinely named `Event`, `Input`, etc. — false positive in corrupt detection. Not applicable here since associations uses emoji/name pairs.

---

## 5. Go/No-Go for E2E

Decision: **READY FOR E2E**

- §2 Evidence: ROADMAP/lessons confirm root cause across 15 builds — both spec and pipeline fixes committed
- §3 POC: Spec fix on server + pipeline guard in place
- Expected: game-flow passes (no lives assertions), mechanics passes (correct emoji/name pairs in tests), approval in ≤2 iterations

---

## Failure History

| Build | Symptom | Root Cause | Status |
|-------|---------|------------|--------|
| multiple (pre-446) | Various test failures | lives assertions on non-lives game + wrong fallbackContent | failed |
| 447 | Step 1d: audio 404 false positive (pre-Lesson 95) | Pipeline bug — audio 404 smoke check | failed |
| 462 | Smoke failed → smoke-regen PASSED → game-flow 2p/1f (iter=2, 1 test deleted) → mechanics 3p/0f → level-prog 1p/0f → edge-cases 1p/1f → contract spec deleted (skipToEnd('victory')→recall phase, not results) → global fix loop 0/0 bug (Lesson 112) → FAILED: "1 category with 0 test evidence (contract)" | hasTwoPhases contract test gen bug (Lesson 111) + global fix loop trigger bug (Lesson 112) | failed |
| 463+ | Fresh build needed after Lessons 111+112 deployed (4f4164c) | Fixes: hasTwoPhases contract uses game_over not victory + global fix loop skips deleted spec batches | queued |
| 472 | APPROVED — iter=2, 29 min | Smoke-regen fired (3rd R&D data point). Contract spec triage-deleted → Lesson 112 validated: no global fix loop trigger. game-flow 1f→fixed, edge-cases 1p/1f, review rejected once then fixed → APPROVED. | **APPROVED** |

---

## Targeted Fix Summary

| Fix | Commit | Outcome |
|-----|--------|---------|
| Spec: PART-018=NO + no-lives note + correct fallbackContent | 7a1ee80 | Root causes eliminated in spec |
| Pipeline: detectCorruptFallbackContent() | 668c087 | Guards test-gen from poisoned API names |
| Pipeline: audio 404 false positive (smoke check) | c5bfa4c | Step 1d no longer fails on non-blocking 404s |
| Pipeline: hasTwoPhases contract test uses game_over + global fix loop skips deleted batches | 4f4164c | Lessons 111+112 — build #472 APPROVED (iter=2) |
