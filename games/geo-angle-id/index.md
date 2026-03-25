# geo-angle-id — Human Decision Dashboard

> **Session:** Geometry Session 1 (Games 1–4)
> **Bloom level:** L1 Remember
> **Status:** 📝 Spec ready — awaiting first build

## Current State

| Field | Value |
|-------|-------|
| Game ID | geo-angle-id |
| Spec | [spec.md](spec.md) — 66KB, written 2026-03-23 |
| Latest build | None |
| Approval status | Never approved |
| Queue decision | Pending human spec review before queuing |

## Quick Summary

Visual MCQ game: given a CSS-drawn angle diagram, classify the angle as Acute / Right / Obtuse / Straight / Reflex. 9 rounds across 3 difficulty tiers (prototypical → rotated orientations → arm-length variation + reflex). 4 MCQ buttons per round. No lives — learning mode. Worked-example panel on first wrong attempt. Stars by first-attempt accuracy (≥7/9 = 3★). NCERT Class 7 Ch 5 / Class 9 Ch 6 §6.1.

## Spec Checklist (pre-queue)

- [x] FeedbackManager.init() excluded (PART-017=NO)
- [x] TimerComponent excluded (PART-006=NO) — visual recognition task; time pressure contradicts worked-example goal
- [x] gameId first field in gameState
- [x] window.gameState, window.endGame, window.restartGame, window.nextRound all assigned
- [x] ProgressBarComponent with slotId: 'mathai-progress-slot', totalLives: 0
- [x] TransitionScreen: start + victory only (no game_over path — learning mode)
- [x] syncDOMState() at all phase transitions (start_screen → playing → results)
- [x] game_complete dual-path: spec has VICTORY only (no game_over — correct for no-lives game)
- [x] 5 research sources cited inline
- [x] Anti-Patterns section included
- [x] 12 test cases (TC-001–TC-012)
- [ ] Human review before queuing

## Build History

| Build | Status | Iterations | Notes |
|-------|--------|-----------|-------|
| — | — | — | No builds yet |

## Links

- [spec.md](spec.md)
- [rca.md](rca.md)
- [ui-ux.md](ui-ux.md)
- [games/index.md](../index.md) — Row: Geo 1/4
