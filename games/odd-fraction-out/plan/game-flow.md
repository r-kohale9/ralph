# Game Flow: Odd Fraction Out

## One-liner

The student studies four fraction cards (3/4, 6/8, 9/12, 2/3), identifies the non-equivalent fraction, and taps the outlier to demonstrate recognition of equivalent fractions — the game ends after a single tap with 3 or 0 stars.

## Flow Diagram

```
┌──────────┐ tap    ┌────────────┐ tap card ┌──────────────────┐
│ Preview  ├───────▶│ Game (Q1)  ├─────────▶│ Feedback 2s      ├──▶ Game End
│ 🔊 prev  │        │ 🔊 prompt  │          │ ✓ / ✗            │    {stars, correct,
└──────────┘        │ no progress│          │ stars auto-given │     livesLeft:null}
                    │ bar        │          │ no retry         │    → host resumes
                    └────────────┘          └──────────────────┘
```

Every transition:
- Preview → Game: tap the Preview overlay's "Start" CTA.
- Game → Feedback: tap any one of the four fraction cards (input then blocked).
- Feedback → Game End: automatic after 2000ms dwell post-TTS completion.
- Game End: `game_complete` postMessage fires; host app resumes.

No Welcome, no Round-N intro, no Victory screen, no Game-Over screen, no "Ready to improve your score?", no "Yay, stars collected!", no Play Again, no Try Again, no retry, no Claim Stars tap (stars auto-granted).

## Shape

**Shape:** Shape 1 Standalone

## Changes from default

- None — Shape 1 Standalone canonical diagram copied verbatim from `reference/shapes.md`.

## Stages

| Stage | Rounds | Difficulty | Content description |
|-------|--------|------------|---------------------|
| The Only Stage | 1 | L2 Understand — single odd-one-out MCQ | Four fraction cards: 3/4, 6/8, 9/12 (all equivalent via x1/x2/x3 scaling), with 2/3 as the non-equivalent outlier. Fixed card order, no shuffle. |

Notes:
- `totalRounds = 1` per spec (Shape 1 Standalone by creator's explicit design).
- Only one stage exists; no easy/medium/hard progression.
- Content is fully fixed (no procedural generation).
