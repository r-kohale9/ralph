# Pre-generation Plan: Add 15 Numbers

This plan follows the format prescribed by `alfred/skills/game-planning/SKILL.md` — **5 self-contained plan documents** under `pre-generation/`, each consumable independently by the game-building step.

## Plan Documents

| File | Purpose |
|------|---------|
| [pre-generation/game-flow.md](pre-generation/game-flow.md) | One-liner, canonical multi-round flow diagram with inserted per-round timer + round-complete interstitial, shape declaration, stage breakdown |
| [pre-generation/screens.md](pre-generation/screens.md) | ASCII wireframe + Elements table for every screen: preview, welcome, round_intro (×5), gameplay, round_complete_interstitial, game_over, motivation, victory, stars_collected. Includes round presentation sequence for gameplay. |
| [pre-generation/round-flow.md](pre-generation/round-flow.md) | Single round type (Type A) — step-by-step with correct path, wrong path, timeout path, grid tile tap (non-commit), state-change table, and 8 critical ordering invariants |
| [pre-generation/feedback.md](pre-generation/feedback.md) | L3 Apply feedback table with 17 moments mapped to FeedbackManager calls, subtitle examples per type, animation list, wrong-answer handling depth, emotional arc notes |
| [pre-generation/scoring.md](pre-generation/scoring.md) | Points, lives-based star thresholds, progress bar config, TimerComponent (PART-006) config, average-time tracking, data contract fields (`game_complete`, `recordAttempt`, `game_exit`) |

## Archetype

**Archetype #3 Lives Challenge (Timed + Lives variant)** with PART-006 (per-round 15s Timer) added. Shape 2 Multi-round (canonical default-flow.md), with two additive customization deltas: per-round Timer inserted into gameplay, and a round-complete interstitial transition inserted after feedback.

## Cross-cutting invariants honored (from MEMORY.md + spec warnings)

1. **ProgressBar bumps FIRST** in the round-complete handler (`progressBar.update(currentRound, lives)` before `await FeedbackManager.sound.play(...)`, before `nextRound()`, before `endGame()`) — documented in round-flow.md steps 6e and 7f, and scoring.md Progress Bar section. Prevents final-round Victory showing `4/5`.
2. **TimerComponent mounts inside `.mathai-preview-header-center`** at `#timer-container`, visibly with overridden inline styles and hidden `#previewTimerText` — documented in screens.md gameplay Elements table, round-flow.md step 1, scoring.md Timer section.
3. **VisibilityTracker owns the pause overlay** (`autoShowPopup: true`; customize via `popupProps` only, never a custom div) — documented in round-flow.md step 1, feedback.md CASE 14/15 rows.
4. **`gameState.isProcessing = true` set BEFORE any await** in correct/wrong/timeout handlers — documented in round-flow.md steps 6a, 7a.
5. **`game_complete` postMessage fires BEFORE Game Over / Victory audio** — documented in round-flow.md steps 9d, 10d, feedback.md CASE 11/12 rows.
6. **`await` wrong SFX on last life — never skip** (min 1500ms per CASE 8) — documented in round-flow.md step 9b, feedback.md "Last life wrong" row.
7. **Fire-and-forget for `playDynamicFeedback`** after awaited short SFX; auto-advance never blocks on TTS — documented in feedback.md columns "Await?" and round-flow.md steps 6g, 7i.
8. **`renderRound()` is single source of truth for re-enabling inputs** — handlers must NOT manually reset `isProcessing=false` — documented in round-flow.md invariant #8.

## Ambiguities resolved (see spec "Defaults Applied")

All ambiguities were already resolved in the spec's `## Defaults Applied` and `## Warnings` sections. Plan adopts them verbatim:

- **Game title interpretation** ("add-15-numbers") — adopts spec's primary reading (grid-centric: ~15 tiles per round, scaling 12→14→15 across stages so Round 5 hits exactly 15).
- **Star-rating formula** — adopts spec's lives-based tiers (3★ = 3 lives, 2★ = 2, 1★ = 1, 0★ via Game Over). Creator's "3 stars = answered within 15s" heuristic was underspecified for 2★/1★; lives-based is coherent with the rest of the pipeline.
- **Bloom Level** — L3 Apply (spec-declared), so feedback.md uses context-aware TTS citing the correctSum, not a generic confirmation.
- **Grid layout** — 3 columns × 4-5 rows (spec default for 44px+ touch targets on 375px viewport).
- **MCQ count** — 3 buttons in a single horizontal row (creator-specified; spec warns about 33% guess rate and compensates with tighter distractor gaps in Stage 3).
- **Inter-round interstitial** — 2000ms auto-advance (spec-specified), inserted as a Shape-2 additive delta, not a custom Shape.
- **Timeout = wrong for scoring** — adopts spec default (-1 life on timeout). Spec WARNING notes this may be too harsh; plan preserves it as creator-specified and flags for post-playtest review.
- **Misconception explanations in feedback** — reserved for analytics / future depth, NOT spoken in v1 (to keep wrong-answer window ≤3s; stacking explanation TTS would amplify timer pressure). Tags are captured in `recordAttempt` per-round.

## Victory routing on last-round wrong

One detail not explicit in the spec: when the student gets Round 5 wrong (or times out) but still has `lives > 0`, they have attempted all 5 rounds. Plan routes this to Victory (with stars = `lives`), consistent with "all rounds attempted" being the stars-unlock condition. See round-flow.md step 7j and scoring.md star pseudocode.
