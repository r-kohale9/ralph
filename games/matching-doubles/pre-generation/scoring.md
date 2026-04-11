# Scoring: Matching Doubles

## Points

| Action | Points | Notes |
|--------|--------|-------|
| Correct match | +1 | Per pair matched |
| Wrong match | 0 | No point penalty. Life lost instead. |

## Formula

```
score = number of correct matches
maxScore = 36 (total pairs across 9 rounds: 3+3+3+4+4+4+5+5+5)
percentage = (score / maxScore) * 100
```

Note: Score is not used for star calculation. Stars are based on total time only.

## Star Thresholds

Stars are based on total elapsed time (count-up timer), NOT on score or accuracy.

| Stars | Threshold | Displayed as |
|-------|-----------|-------------|
| 3 stars | totalTime <= 60000ms (60 seconds) | Three filled stars |
| 2 stars | totalTime <= 90000ms (90 seconds) | Two filled, one empty |
| 1 star | totalTime > 90000ms | One filled, two empty |

Stars are only calculated on victory (all 9 rounds completed). Game over has no star display.

## Lives

| Parameter | Value |
|-----------|-------|
| Starting lives | 3 |
| Lives lost per wrong match | 1 |
| Game over condition | lives = 0 |
| Lives display | 3 heart icons at top-right of gameplay screen |
| Life loss animation | `.heart-break` 600ms. Heart empties immediately, shake animation plays. |
| Last life behavior | Wrong SFX skipped entirely. Transition straight to game_over screen (Case 8). |

## Progress Bar

| Parameter | Value |
|-----------|-------|
| Tracks | Round number (currentRound / 9) |
| Position | Below timer/score row on gameplay screen |
| Style | Filled bar, left-to-right |
| Updates | After each round completes (all pairs matched) |
| Label | "N/9" text next to bar |

## Timer

| Parameter | Value |
|-----------|-------|
| Type | Count-up (starts at 0, counts up) |
| Starts | When gameplay screen loads (round 1 begins) |
| Pauses | On visibility hidden, on game end (victory or game over) |
| Resumes | On visibility restored |
| Display | "MM:SS" format, top-left of gameplay screen |
| Used for | Star calculation only. No time limit. Game does not end on timer. |

## Data Contract Fields

| Field | Source | Example value |
|-------|--------|---------------|
| score | gameState.score | 36 |
| totalQuestions | 36 (fixed, total pairs) | 36 |
| stars | calculated from totalTime thresholds | 2 |
| accuracy | (correctMatches / totalAttempts) * 100 | 85 |
| timeSpent | Date.now() - gameState.startTime | 72000 |
| livesRemaining | gameState.lives | 1 |
| roundsCompleted | gameState.currentRound | 9 |
