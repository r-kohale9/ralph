# Which Ratio?

**Game ID:** `which-ratio`
**Session:** SOH-CAH-TOA Trigonometry · **Position:** Game 2 of 5
**Bloom Level:** L2 Understand
**Interaction Type:** ratio-identification-mcq

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ⚠️ NEEDS RE-QUEUE — Build #560 approved but CSS stripped (PART-028 check now deployed, pipeline will catch on re-queue) |
| **UI/UX Audit** | ⚠️ 8 open issues (1 critical) — CSS stripped makes visual audit partial |
| **Test Coverage** | 8/10 tests passing (build #559 approved; CSS issue found post-approval) |
| **GCP URL** | `https://storage.googleapis.com/mathai-temp-assets/games/which-ratio/builds/560/index.html` |

### Action Required

> Re-queue immediately — approved HTML has CSS stripped (entire `<style>` block replaced with comment). PART-028 T1 check now deployed to validate CSS presence. New build will catch and fix the stripped CSS before approval.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| #558 | 2026-03-23 | ❌ | 0 | ~0 | ~5 min | Failed | JS SyntaxError in fallbackContent: `}` squashed inline — smoke check caught |
| #559 | 2026-03-23 | ⚠️ | 1 | ~12 | ~28 min | Failed (infra) | Approved 8/10 tests; EACCES post-approval — root-owned warehouse dir (same bug as #555) |
| #560 | 2026-03-23 | ⚠️ | 1 | ~12 | ~28 min | Approved (CSS stripped) | Approved by reviewer; post-approval UI/UX audit found CSS entirely stripped — game visually broken |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #560 — Latest)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ⚠️ Partial | LLM | — | CSS stripped during JS-only targeted fix | T1 PART-028 CSS check now deployed |
| 2 — Static (T1) | ✅ Pass | validate-static | — | CSS check not yet deployed at build time | PART-028 now deployed |
| 3 — Contract | ✅ Pass | validate-contract | — | — | — |
| 3b — Playwright Tests | 8/10 pass (iter 1) | Playwright | ratio-identification-mcq | — | — |
| 4 — Review | ✅ Approved | LLM Review | — | LLM reviewer did not flag stripped CSS | — |

---

## UI/UX Audit

| Date | Critical | High | Medium | Low | Status |
|------|----------|------|--------|-----|--------|
| 2026-03-23 | 1 | 2 | 3 | 2 | ⚠️ 8 open issues |

**Top open issues:**
1. CRITICAL — Entire CSS stylesheet stripped; game visually broken (no layout, no button sizing, no feedback states)
2. HIGH — No explicit min touch target (44px) on option buttons
3. HIGH — No ARIA live regions on dynamic feedback elements

→ Full audit details: [`ui-ux.md`](ui-ux.md)

---

## Log Paths

| Artifact | Path |
|----------|------|
| Spec | [`spec.md`](spec.md) |
| RCA | [`rca.md`](rca.md) |
| UI/UX Audit | [`ui-ux.md`](ui-ux.md) |
| Build History | [`build-log.md`](build-log.md) |
| Pipeline HTML (local) | `warehouse/templates/which-ratio/game/index.html` |
| GCP HTML | `https://storage.googleapis.com/mathai-temp-assets/games/which-ratio/builds/560/index.html` |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #560 | 2026-03-23 | LLM Review | Approved iter 1 — but CSS stripped, needs re-queue |

---

## Design Rationale

This game targets the pure SOH-CAH-TOA definition recall (L2 Understand) — given a labeled triangle, identify which ratio applies. The three-button MCQ (sin/cos/tan) directly tests the mnemonic. On first wrong attempt, a worked-example panel expands to show the full SOH-CAH-TOA reference card. No lives — this is a learning-first game. The design targets two primary misconceptions: (1) confusing sin and cos because both involve the hypotenuse; (2) forgetting that tan uses opposite/adjacent only.
