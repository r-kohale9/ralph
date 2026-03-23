# Quadratic Formula: Worked Example

**Game ID:** `quadratic-formula-worked-example`
**Session:** Standalone
**Bloom Level:** L2 Understand (worked-example scaffold)
**Interaction Type:** worked-example-mcq (3 rounds × 3 sub-phases)

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ✅ APPROVED — Build #546 (2026-03-22) |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | 7/12 → 9/12 → Approved ~38 min |
| **GCP URL** | TBD |

### Action Required

> No action — game approved. UI/UX audit pending.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| #545 | 2026-03-22 | ❌ | 3 | ~36 | ~35 min | Failed | CDN cold-start in final retest (10/12 → 5/12 same HTML); secondary: postMessage field mismatch |
| #546 | 2026-03-22 | ✅ | 2 | ~24 | ~38 min | Approved | CDN warm; review fixed MCQ shuffle + trackEvent wrong points; approved iter 2 |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #546 — Final Approved Build)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ✅ Pass | LLM | — | — | — |
| 2 — Static (T1) | ✅ Pass | validate-static | — | — | — |
| 3 — Contract | ✅ Pass | validate-contract | — | — | Contract tests triage-deleted (0/2 evidence) |
| 3b — Playwright Tests | 7/12 iter 1; 9/12 global-fix-1 | Playwright | various | CDN timing stall at iter 1; MCQ shuffle + trackEvent bugs | Review fix resolved MCQ shuffle and trackEvent in one pass |
| 4 — Review | ✅ Approved (attempt 2) | LLM Review | — | Attempt 1 rejected: MCQ shuffle + trackEvent wrong points | review-fix-1 resolved both in 160s |

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
| Pipeline HTML (local) | `warehouse/templates/quadratic-formula-worked-example/game/index.html` (if exists) |
| GCP HTML | TBD |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #546 | 2026-03-22 | LLM Review | Approved iter=2 (~37.7 min); review rejected once then fixed |

---

## Design Rationale

This game applies the Sweller & Cooper worked-example progression to quadratic formula: full worked example → faded example → independent practice, covering 3 rounds × 3 sub-phases. The algebra MCQ structure (52,259 bytes, large game) demonstrated that CDN cold-start is a real risk for complex games: same HTML scored 10/12 in warm conditions but 5/12 in final retest on a cold server. CDN warming between builds is essential for reliable test results.
