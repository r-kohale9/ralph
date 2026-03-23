# Name the Sides

**Game ID:** `name-the-sides`
**Session:** SOH-CAH-TOA Trigonometry · **Position:** Game 1 of 5
**Bloom Level:** L2 Understand
**Interaction Type:** label-assignment-dropdown

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ⚠️ NEEDS RE-QUEUE — CSS stripped (triangle invisible), same bug as which-ratio #560. Will be queued after which-ratio #561 completes. |
| **UI/UX Audit** | ❌ 10 issues (1 critical — CSS stripped, triangle invisible) |
| **Test Coverage** | iter=3 (approved after 3 iterations) |
| **GCP URL** | `https://storage.googleapis.com/mathai-temp-assets/games/name-the-sides/builds/557/index.html` |

### Action Required

> Re-queue after which-ratio #561 completes. CSS stripped in approved HTML — triangle diagram completely invisible. PART-028 deployed.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| #550 | 2026-03-22 | ❌ | 3 | ~36 | ~35 min | Failed | window.loadRound not exposed; jumpToRound silent no-op |
| #552 | 2026-03-22 | ❌ | 0 | ~0 | ~5 min | Rejected | Step 1b contract-fix stripped CSS + broke spread; T1 errors |
| #553 | 2026-03-22 | ❌ | 3 | ~36 | ~35 min | Failed | interactionType=drag false-positive; drag tests generated for MCQ game |
| #554 | 2026-03-22 | ❌ | 0 | ~0 | ~5 min | Killed | HTML missing transitionScreen.hide(); #gameContent stays display:none |
| #555 | 2026-03-22 | ❌ | N/A | — | — | Failed (infra) | EACCES post-approval — warehouse/game/ owned root:root |
| #556 | 2026-03-22 | ❌ | 3 | ~36 | ~35 min | Failed | GEN-117 incomplete; startGame() called hide() but never revealed #gameContent |
| #557 | 2026-03-22 | ✅ | 3 | ~36 | ~35 min | Approved | GEN-116+117+118 compound fix resolved init failure class |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #557 — Final Approved Build)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ✅ Pass | LLM | — | — | GEN-116/117/118 rules applied |
| 2 — Static (T1) | ✅ Pass | validate-static | — | — | — |
| 3 — Contract | ✅ Pass | validate-contract | — | — | — |
| 3b — Playwright Tests | Passed iter 3 | Playwright | game-flow | CDN init + gameContent reveal | Fixed by GEN-118 |
| 4 — Review | ✅ Approved | LLM Review | — | — | — |

---

## UI/UX Audit

| Date | Critical | High | Medium | Low | Status |
|------|----------|------|--------|-----|--------|
| 2026-03-23 | 1 | 4 | 3 | 2 | ❌ Re-queue needed — CSS stripped |

**Top open issues:**

| ID | Severity | Description | Resolution |
|----|----------|-------------|------------|
| UI-NS-001 | Critical | CSS stripped — `<style>` block replaced with comment by targeted fix LLM; triangle diagram completely invisible (CSS border-trick shape — 0×0px without styles) | PART-028 T1 check + FIX-001 gen rule deployed; re-queue required |
| UI-NS-002 | High | Triangle diagram no visible labels during gameplay — sides not annotated until answer submitted | Gen prompt rule needed |
| UI-NS-003 | High | Touch targets 21px — all interactive buttons render at half the 44px minimum (session-wide pattern, also in which-ratio) | R&D backlog: GEN rule min-height 44px |
| UI-NS-004 | High | Results screen not an overlay — `position: static`, "Play Again" at y=1037px on mobile | R&D backlog: GEN rule position:fixed results screen |
| UI-NS-005 | High | No visual feedback on correct/incorrect selection before advancing | Gen prompt rule needed |
| UI-NS-006 | Medium | Dropdown option text truncated on narrow viewport (320px) | Gen prompt rule needed |
| UI-NS-007 | Medium | `progressBar.update(-9)` PAGEERROR fires every round (invalid count value) | R&D backlog: GEN rule clamp progressBar arg; Test Quality backlog: PAGEERROR assertion |
| UI-NS-008 | Medium | Star rating display not visible on results screen (covered by CSS strip issue) | Resolved by re-queue |
| UI-NS-009 | Low | Button disabled state has insufficient colour contrast (grey on grey) | Gen prompt rule needed |
| UI-NS-010 | Low | ARIA live region missing on score/round counter updates | ARIA-001 shipped 2026-03-23 |

→ Full audit details: [`ui-ux.md`](ui-ux.md)

---

## Log Paths

| Artifact | Path |
|----------|------|
| Spec | [`spec.md`](spec.md) |
| RCA | [`rca.md`](rca.md) |
| UI/UX Audit | [`ui-ux.md`](ui-ux.md) |
| Build History | [`build-log.md`](build-log.md) |
| Pipeline HTML (local) | `warehouse/templates/name-the-sides/game/index.html` |
| GCP HTML | `https://storage.googleapis.com/mathai-temp-assets/games/name-the-sides/builds/557/index.html` |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #557 | 2026-03-22 | LLM Review | Approved on iter 3 — GEN-116+117+118 compound fix |

---

## Design Rationale

This game is the entry point to the trig sequence (L2 Understand). It uses label-assignment-dropdown instead of SVG-click interaction because Ralph's pipeline cannot reliably generate custom click-on-SVG-side interactions. The educational demand is preserved: the learner must reason about each side's geometric role (hypotenuse/opposite/adjacent) relative to a reference angle. 9 rounds with three difficulty tiers (standard → rotated → two-angle comparison) force geometric reasoning rather than visual pattern-matching.
