# Game Flow: Matching Doubles

## One-liner

Player matches numbers to their doubles (x2) by tapping pairs across two columns, building fluency with the doubling operation across 9 rounds of increasing grid complexity.

## Flow Diagram

```
[start] --tap "Start"--> [gameplay] --loop 9 rounds, all pairs matched each round--> [results]
   ^                         |                                                          |
   |                         +---lives reach 0---> [game_over] -------------------------+
   |                                                    |                                
   +--------------------tap "Play Again"----------------+
   +--------------------tap "Try Again"-----------------+
```

- start -> gameplay: student taps "Start" button
- gameplay -> gameplay: round complete (all pairs matched), advance to next round (rounds 1-9)
- gameplay -> results: round 9 complete (all pairs matched in final round)
- gameplay -> game_over: lives reach 0 on any wrong match
- results -> start: student taps "Play Again"
- game_over -> start: student taps "Try Again"

## Stages

| Stage | Rounds | Difficulty | Content description |
|-------|--------|------------|---------------------|
| Easy | 1-3 | 3 pairs, single-digit numbers | 3 numbers (2-9) on left, 3 doubles (4-18) on right. Low confusability between doubles. |
| Medium | 4-6 | 4 pairs, mixed single/double-digit numbers | 4 numbers (5-30) on left, 4 doubles (10-60) on right. Some doubles are close in value (e.g., 24 and 26). |
| Hard | 7-9 | 5 pairs, double-digit numbers | 5 numbers (15-50) on left, 5 doubles (30-100) on right. Multiple doubles within +/-10 of each other. |
