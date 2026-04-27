# Game Flow: Add 15 Numbers

## One-liner

Across 5 timed rounds, the student mentally adds a grid of 12-15 small whole numbers (Whole-Number Addition — Number Sense) and taps the correct sum from 3 MCQ options before a 15-second per-round timer expires, with the goal of completing all 5 rounds without losing all 3 lives.

## Flow Diagram

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)         │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ 🔊 prompt / TTS        │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │ + 15s timer runs       │
│   audio  │        │    VO    │        │ 🔊 "Round N" │         │ + grid tap-to-strike   │
└──────────┘        └──────────┘        └──────────────┘         └─────────┬──────────────┘
                                                ▲                          │ player taps MCQ
                                                │                          │   OR timer hits 0
                                                │                          ▼
                                                │                ┌──────────────────────────┐
                                                │                │ Feedback (2s, same       │
                                                │                │ screen)                  │
                                                │                │ ✓ 🔊 sound_correct       │
                                                │                │ ✗ 🔊 sound_life_lost     │
                                                │                │   + red flash + shake    │
                                                │                │   + correct revealed     │
                                                │                └─────────┬────────────────┘
                                                │                          │
                                                │                          ▼
                                                │                ┌──────────────────────────┐
                                                │                │ Round-complete           │
                                                │                │ interstitial (2s, auto)  │
                                                │                │ "Avg time: X.Xs"         │
                                                │                │ "N/5 rounds complete"    │
                                                │                └─────────┬────────────────┘
                                                │                          │
                            ┌───────────────────┴─────┬────────────────────┼──────────────┐
                            │                         │                                   │
                      wrong/timeout AND lives = 0   correct AND more       correct AND last round won
                            │                      rounds                    │
                            ▼                       (loops to Round N+1)     ▼
                 ┌────────────────────┐                                    ┌────────────────────┐
                 │ Game Over (status) │                                    │ Victory (status)   │
                 │ 💔 "Game Over"     │                                    │ 1-3★ (lives-based) │
                 │ 🔊 sound_game_over │                                    │ 🔊 sound_game_     │
                 └─────────┬──────────┘                                    │    victory         │
                           │ "Try Again"                                   └──────┬─────┬───────┘
                           ▼                                                      │     │
                 ┌──────────────────┐                                "Play Again" │     │ "Claim Stars"
                 │ "Ready to        │                                (only if     │     │
                 │  improve your    │                                 1-2 ★)      ▼     ▼
                 │  score? ⚡"       │                                       ┌──────────────────┐  ┌──────────────────────┐
                 │ (trans., tap)    │                                       │ "Ready to        │  │ "Yay! 🎉            │
                 │ 🔊 motivation VO │                                       │  improve your    │  │  Stars collected!"   │
                 │ [I'm ready! 🙌]  │                                       │  score? ⚡"       │  │ (trans., auto,       │
                 └────────┬─────────┘                                       │ (trans., tap)    │  │  no buttons)         │
                          │ tap                                             │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                          ▼                                                 │ [I'm ready! 🙌]  │  │    sound + ✨ star   │
                 restart from Round 1                                       └────────┬─────────┘  │    animation         │
                 (skips Preview + Welcome)                                           │ tap        └──────────┬───────────┘
                                                                                     ▼                       │ auto
                                                                            restart from Round 1             ▼
                                                                            (skips Preview + Welcome)        exit
```

## Shape

**Shape:** Shape 2 Multi-round

## Changes from default

- Inserted a per-round 15-second `TimerComponent` (PART-006) into the Round N game screen between Round-N intro and player input. Timer pauses on MCQ tap; timeout branches into wrong-answer feedback with life decrement. (flow-gallery row 7/12 — custom timing threshold via PART-006.)
- Inserted a "Round-complete interstitial" auto-dismiss transition between Feedback and the next Round-N intro. Shows "Average time taken: X.Xs" + "N/5 rounds complete" for ~2000ms with a short fire-and-forget "next round" SFX. (flow-gallery row 7 — conditional transition with `waitForSound: true`.)
- No section intros (single contiguous round sequence), no pep-talk branch, no early-exit streak bail-out.
- Victory subtitle is game-specific ("You completed all 5 rounds! Average time: X.Xs").

## Stages

| Stage | Rounds | Difficulty | Content description |
|-------|--------|------------|---------------------|
| Stage 1 Warmup | 1-2 | L3 Apply, small single-digit addends | 12 tiles per round, value range 1-9, target sum 50-75, distractor gap ±3 and ±10 |
| Stage 2 Core | 3-4 | L3 Apply, mixed single + low double digits with make-ten pairs | 14 tiles per round, value range 1-15, target sum 85-120, distractor gap ±5 and ±10 (one digit-swap distractor) |
| Stage 3 Boss | 5 | L3 Apply, larger tiles + teens, tightest distractors | 15 tiles, value range 1-20, target sum 130-170, distractor gap ±5 and ±7 |

Notes:
- Round count is 5 (creator-specified, not archetype default).
- Stage distribution 2+2+1 so Round 5 is a boss.
- Timer is 15s per round across all stages. Lives shared across all 5 rounds (pool of 3).
