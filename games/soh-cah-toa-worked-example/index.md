# SOH-CAH-TOA: Worked Example

**Game ID:** `soh-cah-toa-worked-example`
**Session:** SOH-CAH-TOA Trigonometry · **Position:** Game 3 of 5
**Bloom Level:** L2 Understand
**Interaction Type:** worked-example-mcq

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ✅ APPROVED — Build #544 (2026-03-22) |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | iter=1 (approved on first iteration, contract 0/2 timing mismatch noted) |
| **GCP URL** | `https://storage.googleapis.com/mathai-temp-assets/games/soh-cah-toa-worked-example/builds/544/index.html` |

### Action Required

> No action — game approved and deployed. UI/UX audit pending.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| #531 | 2026-03-22 | ❌ | 3 | ~36 | ~35 min | Failed | startGame() uses setTimeout(0) — TransitionScreen never dismisses |
| #535 | 2026-03-22 | ❌ | 0 | ~0 | ~5 min | Rejected | LLM used transitionScreen.show() for end-game results; T1 sentry order violation |
| #537 | 2026-03-22 | ❌ | 0 | ~0 | ~5 min | Failed | SentryHelper not a CDN global → waitForPackages() infinite loop → blank page |
| #539 | 2026-03-22 | ❌ | — | — | — | Orphaned | Worker restarted mid-build |
| #544 | 2026-03-22 | ✅ | 1 | ~12 | ~28 min | Approved | waitForPackages + faded MCQ fixed; contract timing mismatch noted but not blocking |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #544 — Final Approved Build)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ✅ Pass | LLM | — | — | SentryHelper ban + setTimeout(0) ban applied |
| 2 — Static (T1) | ✅ Pass | validate-static | — | — | — |
| 3 — Contract | ✅ Pass | validate-contract | — | — | — |
| 3b — Playwright Tests | 2/4 game-flow, 0/2 contract (timing mismatch) | Playwright | contract | postMessage timing | Timing mismatch noted; not blocking approval |
| 4 — Review | ✅ Approved | LLM Review | — | — | — |

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
| Pipeline HTML (local) | `warehouse/templates/soh-cah-toa-worked-example/game/index.html` |
| GCP HTML | `https://storage.googleapis.com/mathai-temp-assets/games/soh-cah-toa-worked-example/builds/544/index.html` |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #544 | 2026-03-22 | LLM Review | Approved on iter 1 |

---

## Design Rationale

This game implements the Worked Example → Faded Example → Independent Practice progression (Sweller & Cooper, 1985) across 3 rounds (sin, cos, tan). Each round has 3 sub-phases: full worked example (read-only), faded problem (one step blanked, MCQ), and independent practice (MCQ, lives at stake). This cognitive load gradient — full scaffolding → partial → independent — is the pedagogical core. Lives are deducted only in the practice phase, not in example or faded phases.
