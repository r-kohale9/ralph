# Count and Tap

**Game ID:** `count-and-tap`
**Session:** Standalone
**Bloom Level:** L1 Remember (subitizing / dot counting)
**Interaction Type:** multiple-choice-quiz (timed)

---

## Status

| Field | Value |
|-------|-------|
| **Approval** | ✅ APPROVED — Build #551 (2026-03-22) |
| **UI/UX Audit** | ❌ Not audited |
| **Test Coverage** | 11/12 iter 1, approved |
| **GCP URL** | TBD |

### Action Required

> No action — game approved. UI/UX audit pending.

---

## Build History

| Build # | Date | Status | Iterations | ~LLM Calls | Build Time | Outcome | Notes |
|---------|------|--------|------------|------------|------------|---------|-------|
| #440 | 2026-03-21 | ❌ | 3 | ~36 | ~35 min | Failed | A: null gameState.content → corrupted fallback. B: CDN cold-start |
| #457 | 2026-03-21 | ❌ | 3 | ~36 | ~35 min | Failed | renderRound() sets isProcessing=false immediately → harness desync |
| #471 | 2026-03-21 | ❌ | 3 | ~36 | ~35 min | Failed | FeedbackManager.sound.playDynamicFeedback wrong namespace → isProcessing stuck |
| #551 | 2026-03-22 | ✅ | 2 | ~24 | ~30 min | Approved | FeedbackManager.playDynamicFeedback fix verified; PART-011-SOUND T1 check shipped |

*LLM calls estimated: ~12 per iteration (gen + review + test-gen + fix rounds).*

---

## Step-Level Failure Analysis (Build #551 — Final Approved Build)

| Step | Outcome | Validator | Category | Root Cause | Resolution |
|------|---------|-----------|----------|------------|------------|
| 1 — HTML Gen | ✅ Pass | LLM | — | — | FeedbackManager namespace rule applied |
| 2 — Static (T1) | ✅ Pass | validate-static | PART-011-SOUND | Wrong FeedbackManager namespace | T1 check shipped (commit 26fcfb6) |
| 3 — Contract | ✅ Pass | validate-contract | — | — | — |
| 3b — Playwright Tests | 11/12 iter 1 (edge-cases 2/3 → fixed iter 2) | Playwright | edge-cases | Timer expiry phase 'results' instead of 'gameover' | Fixed in iter 2 |
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
| Pipeline HTML (local) | `warehouse/templates/count-and-tap/game/index.html` |
| GCP HTML | TBD |
| Server build logs | `journalctl -u ralph-worker` on 34.93.153.206 |

---

## Approval Details

| Build # | Date | Method | Conditions / Notes |
|---------|------|--------|-------------------|
| #551 | 2026-03-22 | LLM Review | Approved iter=2; FeedbackManager fix confirmed |

---

## Design Rationale

Count-and-tap is a subitizing game: dots are briefly shown then hidden, and the learner selects the correct count from MCQ options. Uses TimerComponent (countdown per question), FeedbackManager (sound effects, no init), and ScreenLayout. This game drove three major pipeline fixes: window.gameState.content pre-population (Lesson 92/93), FeedbackManager.sound namespace correction (Lesson 94), and PART-011-SOUND T1 check (Lesson 94). CDN cold-start is a known risk for this game — warm CDN required.
