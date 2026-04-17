# Matching Doubles — Pre-Generation Plan

**Game ID:** matching-doubles | **Archetype:** Memory Match (#5), column-pair adaptation | **Bloom:** L2 | **Flow Shape:** 2 (Multi-round)

## 1. Archetype Mapping

- **Memory Match (#5)** adapted for **column-pair** matching: tiles are **face-up from the start** (no card-flip reveal). Left column = base numbers, right column = candidates (doubles + Stage 3 distractors).
- Interaction keeps the Memory Match click-to-match state machine: first click selects, second click checks; re-tap deselects.
- Spec overrides the archetype defaults: **rounds = 9** (not 3), **lives = 3** (not 0), **timer = count-up** (not 0). Builder MUST wire a `game_over` screen + progress-bar heart display (archetype default has no game_over).

## 2. Screen Flow

```
Preview (PART-039, 5s / skip)
  -> Round 1 intro transition
  -> Round N gameplay (N=1..9)
       -> on all pairs locked: round-complete SFX (awaited) -> Round N+1 intro  OR  Victory (if N=9)
       -> on wrong match & lives==0: Game Over
  -> Victory screen  (N=9 with lives>0)
  -> Game Over screen (lives==0 mid-round)
```

Transitions: Preview -> RoundIntro(1) -> Gameplay(1) -> RoundIntro(2) -> ... -> Gameplay(9) -> Victory. Branch: any wrong-match + lives==0 -> Game Over. Restart resets lives=3, timer=0, round=1; **Preview is NOT re-shown** (PART-039).

## 3. Round-by-Round Breakdown

Pulled verbatim from spec `fallbackContent`:

| # | Stage | Pairs | left | right (shuffled) | distractors / tags |
|---|-------|-------|------|------------------|--------------------|
| 1 | 1 Warm-up | 3 | [3,5,8] | [16,6,10] | none |
| 2 | 1 | 3 | [4,7,9] | [18,8,14] | none |
| 3 | 1 | 3 | [2,6,9] | [18,4,12] | none |
| 4 | 2 Standard | 4 | [6,11,15,22] | [44,12,30,22] | none |
| 5 | 2 | 4 | [9,13,18,25] | [36,18,50,26] | none |
| 6 | 2 | 4 | [8,14,20,27] | [28,40,54,16] | none |
| 7 | 3 Confuse | 5 | [15,18,21,24,30] | [36,17,42,60,30,48] | 17 = `double-add-instead` |
| 8 | 3 | 5 | [17,23,28,35,40] | [46,29,56,80,70,34,55] | 29 = `double-next-number`, 55 = `double-off-by-one` |
| 9 | 3 | 5 | [19,26,33,42,50] | [38,52,44,66,84,100,51] | 44 = `double-add-instead`, 51 = `double-next-number` |

## 4. Scoring & Lives

- **Lives:** start 3, `-1` per wrong match; `lives == 0` -> immediate Game Over (1 star).
- **Timer:** count-up, starts at `startGameAfterPreview()`, **never resets between rounds**, pauses only on visibility-hidden or end screens.
- **Star tier (time-only, final timer when Round 9 last pair locks):**
  - `<= 60s` -> 3 stars
  - `<= 90s` -> 2 stars
  - `> 90s` OR game_over -> 1 star
- Points not tracked. Internal pairs-matched counter feeds analytics only.

## 5. Feedback Patterns (per event)

Multi-step archetype -> **SFX + sticker only, fire-and-forget, no dynamic TTS mid-round**.

| Event | Behavior | Case |
|-------|----------|------|
| Left tile select | accent border + soft select SFX, fire-and-forget | CASE 9 |
| Left tile deselect | remove border + deselect SFX, fire-and-forget | CASE 9 |
| Correct match | green lock + scale-pulse 200ms, correct SFX + celebration sticker, fire-and-forget; input NOT blocked | CASE 5 |
| Wrong match | red flash + shake ~600ms, wrong SFX + sad sticker, fire-and-forget; lives--; both tiles deselect | CASE 7 |
| Round complete | round-complete SFX + sticker + subtitle "Round complete!", **awaited**, input blocked, then Round N+1 intro or Victory | CASE 6 |
| Game Over (lives->0) | Wrong SFX **skipped** (priority rule); Game Over screen renders first with 1 star + "Try Again"; `game_complete` postMessage before audio; then game-over SFX + sad sticker + VO (awaited, CTA interrupts) | CASE 12 |
| Victory (Round 9 done) | Timer pauses -> compute stars; Victory screen renders first with stars + final time + "Play Again"; `game_complete` postMessage before audio; tier-specific VO (awaited, CTA interrupts) | CASE 13 |
| Visibility hidden | Timer + audio pause, "Game Paused" overlay | CASE 14 |
| Visibility restored | Timer + audio resume, overlay dismiss | CASE 15 |
| Restart / Play Again | Stop all audio, lives=3, timer=0, round=1, reload fallbackContent; skip Preview (PART-039) | — |

## 6. Data Contract Integration

- **recordAttempt** fires synchronously on every match attempt (one per two-tap cycle):
  - `is_correct`: true | false
  - `misconception_tag`: on wrong match, look up `round.misconception_tags[right_value_tapped]` -> tag string (e.g. `double-add-instead`) or `null` if the wrong right-tile is itself a valid double (unlikely given data) or if no tag is present. On correct matches, always `null`.
  - `round_number` (1-indexed), `response_time_ms` (roundStartTime delta), `input_of_user` = tapped right value, `correct_answer` = `round.pairs[left_value]`, `difficulty_level` = stage, `question_id` = `r{round}-p{left_value}`.
- **game_complete** (both Victory AND Game Over): nested `data` structure with `metrics = { accuracy, time, stars, attempts, duration_data, totalLives, tries }`. `accuracy` is integer 0-100 from pairs-matched / pairs-attempted.
- **syncDOMState** fields: `currentRound` (0-indexed), `lives`, `elapsedMs`, `selectedLeftIndex`, `selectedRightIndex`, `lockedPairs`, `pairsMatchedTotal`, `stage`.

## 7. Implementation Risks / Open Questions

1. **Memory Match default has `lives: 0` and no `game_over` screen** — builder MUST add lives=3 + heart progress bar + game_over screen (archetype constraint #5).
2. **Round 4 right column `[44,12,30,22]` contains `22` which is also a left-column value** — purely visual coincidence; tile identity must use index + column, not value, to avoid collision bugs.
3. **Stage 3 right arrays have more tiles than left** (6 or 7 tiles vs 5 left) — grid renderer must handle asymmetric columns; remaining distractor tiles stay tappable until lives==0 or round ends.
4. **Timer continuity across rounds** — do NOT reset on round transition; pause only on visibility change / end screens.
5. **game_complete must fire on Game Over too** — common miss; platform needs it for both victory and loss paths.
6. **Misconception lookup on wrong match** — the tag lives on the *right-tile value*, not the left; builder must key into `round.misconception_tags[rightValue]`.
7. **Restart skips Preview (PART-039)** but must reset lives + timer + round index cleanly.
8. **Accuracy decoupled from stars** — a 3-star Victory may include wrong attempts. Emit `pairsMatchedTotal` and wrong-matches via attempts, not stars.
