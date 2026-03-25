# geo-triangle-sort — Human Decision Dashboard

> **Session:** Geometry Session 2 (Games 1–4)
> **Bloom level:** L1–L2 Remember → Understand
> **Status:** 📝 Spec ready — awaiting first build

## Current State

| Field | Value |
|-------|-------|
| Game ID | geo-triangle-sort |
| Spec | [spec.md](spec.md) — written 2026-03-23 |
| Latest build | None |
| Approval status | Never approved |
| Queue decision | Pending human spec review before queuing |

## Quick Summary

Visual MCQ game: given a CSS-drawn triangle (clip-path polygon), classify it by angle type (Acute-angled / Right-angled / Obtuse-angled), by side type (Equilateral / Isosceles / Scalene), or by both simultaneously. 9 rounds across 3 difficulty tiers. Tier 1 (R1–R3): angles only — re-applies geo-angle-id vocabulary to whole triangles. Tier 2 (R4–R6): sides only — equilateral/isosceles/scalene with tick-mark indicators. Tier 3 (R7–R9): dual classification — compound labels ("Right Isosceles", "Obtuse Scalene", "Acute Isosceles"). 4 MCQ buttons per round. No lives — learning mode. Worked-example panel on first wrong attempt. Stars by first-attempt accuracy (≥7/9 = 3★). NCERT Class 7 Ch 6.

**Prerequisite:** geo-angle-id (Game 1) — angle vocabulary (Acute/Right/Obtuse) required for Tier 1.

## Spec Checklist (pre-queue)

- [x] FeedbackManager.init() excluded (PART-017=NO)
- [x] TimerComponent excluded (PART-006=NO) — visual classification task
- [x] gameId first field in gameState
- [x] window.gameState, window.endGame, window.restartGame, window.nextRound all assigned
- [x] ProgressBarComponent with slotId: 'mathai-progress-slot', totalLives: 0
- [x] TransitionScreen: start + victory only (no game_over path — learning mode)
- [x] syncDOMState() at all phase transitions (start_screen → playing → results)
- [x] game_complete VICTORY only (no game_over — correct for no-lives game)
- [x] 5 research sources cited inline
- [x] Anti-Patterns section included (20 items)
- [x] 12 test cases (TC-001–TC-012)
- [x] CSS triangle via clip-path: polygon() — no SVG, no canvas
- [x] 9 rounds, 3 tiers (R1–R3 angles, R4–R6 sides, R7–R9 both)
- [ ] Human review before queuing

## Build History

| Build | Status | Iterations | Notes |
|-------|--------|-----------|-------|
| — | — | — | No builds yet |

## Links

- [spec.md](spec.md)
- [rca.md](rca.md)
- [ui-ux.md](ui-ux.md)
- [games/index.md](../index.md) — Row: Geo 2/4
