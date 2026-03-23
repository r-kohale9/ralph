# Real-World Trig Problems

**Game ID:** `real-world-problem`
**Session:** SOH-CAH-TOA Trigonometry · **Position:** Game 5 of 5
**Bloom Level:** L4 Analyze
**Interaction Type:** word-problem-three-step

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | 📋 Spec ready — no build yet |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | TBD |
| **GCP URL** | N/A |

### Action Required

> Spec ready — queue first build after which-ratio re-queue completes.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| — | — | — | — | — | — | No builds yet | Spec at `games/real-world-problem/spec.md` (draft from docs/education/) |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Latest Build)

*No builds yet.*

---

## UI/UX Audit

| Date | Critical | High | Medium | Low | Status |
|------|----------|------|--------|-----|--------|
| — | — | — | — | — | ❌ Not audited |

**Top open issues:** No build yet — audit pending after first approved build.

→ Full audit details: [`ui-ux.md`](ui-ux.md)

---

## Log Paths

| Artifact | Path |
|----------|------|
| Spec | [`spec.md`](spec.md) |
| RCA | [`rca.md`](rca.md) |
| UI/UX Audit | [`ui-ux.md`](ui-ux.md) |
| Build History | [`build-log.md`](build-log.md) |
| Pipeline HTML (local) | `warehouse/templates/real-world-problem/game/index.html` (after first build) |
| GCP HTML | TBD |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| — | — | — | No approved build yet |

---

## Design Rationale

This is the L4 Analyze capstone of the trig session. The three-step decomposition (diagram labeling → ratio selection → typed computation) forces learners to construct a mental model of the embedded triangle from a word description — not pattern-match to a formula. This targets the highest-frequency failure in applied trig: learners who can compute `sin(30°) × 10` correctly but cannot set up the triangle from a real-world scenario (ladder, ramp, flagpole, cable). Prerequisites: name-the-sides, soh-cah-toa-worked-example, find-triangle-side, which-ratio.
