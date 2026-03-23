# geo-quad-match — Human Decision Dashboard

> **Session:** Geometry Session 3 (Games 1–4)
> **Bloom level:** L2 Understand
> **Status:** 📝 Spec ready — awaiting first build

## Current State

| Field | Value |
|-------|-------|
| Game ID | geo-quad-match |
| Spec | [spec.md](spec.md) — written 2026-03-23 |
| Latest build | None |
| Approval status | Never approved |
| Queue decision | Pending human spec review before queuing |

## Quick Summary

Visual MCQ game: three alternating interaction modes across 9 rounds. Tier 1 (R1–R3, name-to-diagram): given a quadrilateral name + key property, select the correct CSS shape from 4 shape tiles in a 2×2 grid. Tier 2 (R4–R6, diagram-to-name): given a CSS quadrilateral, pick the correct name from 4 text buttons. Tier 3 (R7–R9, property-to-name): given a property list (no diagram), pick the correct quadrilateral name. 6 quadrilateral types covered: parallelogram, rectangle, rhombus, square, trapezium, kite. No lives — learning mode. Worked-example panel on first wrong attempt. Stars by first-attempt accuracy (≥7/9 = 3★). NCERT Class 8 Ch 3.

**Prerequisite:** geo-triangle-sort (Game 2) — dual-axis property reasoning skill required for Tier 3 property-to-name matching.

**Primary misconceptions targeted:** square-not-rectangle, square-not-rhombus, rhombus-not-parallelogram, kite-vs-rhombus, trapezium-not-parallelogram, parallelogram-prototype.

## Spec Checklist (pre-queue)

- [x] FeedbackManager.init() excluded (PART-017=NO)
- [x] TimerComponent excluded (PART-006=NO) — property matching reasoning task
- [x] gameId first field in gameState
- [x] window.gameState, window.endGame, window.restartGame, window.nextRound all assigned
- [x] ProgressBarComponent with slotId: 'mathai-progress-slot', totalLives: 0
- [x] TransitionScreen: start + victory only (no game_over path — learning mode)
- [x] syncDOMState() at all phase transitions (start_screen → playing → results)
- [x] game_complete VICTORY only (no game_over — correct for no-lives game)
- [x] 6 research sources cited inline
- [x] Anti-Patterns section included (22 items)
- [x] 12 test cases (TC-001–TC-012)
- [x] CSS quadrilaterals via clip-path: polygon() — no SVG, no canvas
- [x] 9 rounds, 3 tiers (R1–R3 name-to-diagram, R4–R6 diagram-to-name, R7–R9 property-to-name)
- [x] Tier 1 shape tile grid (2×2, shuffled, CSS shapes as clickable buttons)
- [x] Tier 3 hides diagram — property list text is the sole stimulus
- [ ] Human review before queuing

## Build History

| Build | Status | Iterations | Notes |
|-------|--------|-----------|-------|
| — | — | — | No builds yet |

## Links

- [spec.md](spec.md)
- [rca.md](rca.md)
- [ui-ux.md](ui-ux.md)
- [games/index.md](../index.md) — Row: Geo 3/4
