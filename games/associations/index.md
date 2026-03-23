# Associations

**Game ID:** `associations`
**Session:** Standalone
**Bloom Level:** TBD
**Interaction Type:** unlimited-lives accuracy game (emoji/name pairs)

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ✅ APPROVED — Build #472 (2026-03-21) |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | iter=2, ~29 min |
| **GCP URL** | TBD |

### Action Required

> No action — game approved. UI/UX audit pending.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| multiple (pre-446) | — | ❌ | — | — | — | Failed repeatedly | Lives assertions on no-lives game + wrong fallbackContent |
| #447 | 2026-03-21 | ❌ | 0 | ~0 | ~5 min | Failed | Audio 404 false positive (pre-Lesson 95 pipeline bug) |
| #462 | 2026-03-21 | ❌ | 2 | ~24 | ~29 min | Failed | hasTwoPhases contract test gen bug (Lesson 111) + global fix loop trigger bug (Lesson 112) |
| #472 | 2026-03-21 | ✅ | 2 | ~24 | ~29 min | Approved | Lessons 111+112 deployed; smoke-regen fired (3rd R&D data point) |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #472 — Final Approved Build)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ✅ Pass | LLM | — | — | PART-018=NO note + correct fallbackContent in spec |
| 2 — Static (T1) | ✅ Pass | validate-static | — | — | — |
| 3 — Contract | ✅ Pass | validate-contract | — | — | Contract triage-deleted → Lesson 112 validated |
| 3b — Playwright Tests | game-flow 1f→fixed, edge-cases 1p/1f | Playwright | various | Lives assertions eliminated; correct fallbackContent | Spec fix + detectCorruptFallbackContent() |
| 4 — Review | ✅ Approved | LLM Review | — | Rejected once then fixed | — |

---

## UI/UX Audit

| Date | Critical | High | Medium | Low | Status |
|------|----------|------|--------|-----|--------|
| — | — | — | — | — | ❌ Not audited |

**Top open issues:** Audit not yet performed.

→ Full audit details: [`ui-ux.md`](ui-ux.md)

---

## Log Paths

| Artifact | Path |
|----------|------|
| Spec | [`spec.md`](spec.md) |
| RCA | [`rca.md`](rca.md) |
| UI/UX Audit | [`ui-ux.md`](ui-ux.md) |
| Build History | [`build-log.md`](build-log.md) |
| Pipeline HTML (local) | `warehouse/templates/associations/game/index.html` (if exists) |
| GCP HTML | TBD |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #472 | 2026-03-21 | LLM Review | Approved iter=2; smoke-regen fired |

---

## Design Rationale

Associations is an unlimited-lives accuracy game (emoji/name pairs). The spec was previously broken because PART-018=YES incorrectly tagged it as a lives game, causing test LLMs to generate lives-decrement assertions that always failed. The fix was a spec-level correction: PART-018=NO, no-lives note added, correct fallbackContent structure (`{emoji, name}` pairs). This game validated pipeline fix detectCorruptFallbackContent() (Lesson 112).
