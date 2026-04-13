# Screens: Matching Doubles

## Screen Inventory

- start (data-phase="start")
- gameplay (data-phase="gameplay")
- results (data-phase="results")
- game_over (data-phase="game_over")

---

## Start Screen (data-phase="start")

### Layout

```
+---------------------------------------+  375x667
|                                       |
|                                       |
|          MATCHING DOUBLES             |  <- title, centered, large
|                                       |
|       Match numbers to their          |  <- subtitle, centered
|          doubles (x2)                 |
|                                       |
|                                       |
|                                       |
|          +-------------+              |
|          |    Start    |              |  <- CTA button, centered
|          +-------------+              |
|                                       |
|                                       |
+---------------------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Title | center, upper third | "Matching Doubles" | No |
| Subtitle | center, below title | "Match numbers to their doubles (x2)" | No |
| Start button | center, lower third | "Start" | Tap |

### Entry condition

Game loads. FeedbackManager initialized, audio preloaded.

### Exit condition

Student taps "Start" button. Transition to gameplay screen. Timer starts at 0.

---

## Gameplay Screen (data-phase="gameplay")

### Layout (Stage 1: 3 pairs)

```
+---------------------------------------+  375x667
|  Round 1/9          3/3 lives         |  <- top bar: round counter left, hearts right
|  00:00              Score: 0          |  <- timer left, score right
|  [====            ] 1/9              |  <- progress bar, round tracker
|---------------------------------------|
|                                       |
|    +------+       +------+            |
|    |   3  |       |  14  |            |  <- left column item, right column item
|    +------+       +------+            |
|                                       |
|    +------+       +------+            |
|    |   7  |       |  10  |            |  <- left column item, right column item
|    +------+       +------+            |
|                                       |
|    +------+       +------+            |
|    |   5  |       |   6  |            |  <- left column item, right column item
|    +------+       +------+            |
|                                       |
|                                       |
+---------------------------------------+
```

### Layout (Stage 2: 4 pairs)

```
+---------------------------------------+  375x667
|  Round 4/9          2/3 lives         |
|  00:32              Score: 9          |
|  [===========     ] 4/9              |
|---------------------------------------|
|                                       |
|    +------+       +------+            |
|    |  12  |       |  42  |            |
|    +------+       +------+            |
|                                       |
|    +------+       +------+            |
|    |  15  |       |  16  |            |
|    +------+       +------+            |
|                                       |
|    +------+       +------+            |
|    |   8  |       |  30  |            |
|    +------+       +------+            |
|                                       |
|    +------+       +------+            |
|    |  21  |       |  24  |            |
|    +------+       +------+            |
|                                       |
+---------------------------------------+
```

### Layout (Stage 3: 5 pairs)

```
+---------------------------------------+  375x667
|  Round 7/9          1/3 lives         |
|  01:05              Score: 24         |
|  [=============== ] 7/9              |
|---------------------------------------|
|                                       |
|    +------+       +------+            |
|    |  23  |       |  56  |            |
|    +------+       +------+            |
|    +------+       +------+            |
|    |  35  |       |  38  |            |
|    +------+       +------+            |
|    +------+       +------+            |
|    |  19  |       |  84  |            |
|    +------+       +------+            |
|    +------+       +------+            |
|    |  42  |       |  70  |            |
|    +------+       +------+            |
|    +------+       +------+            |
|    |  28  |       |  46  |            |
|    +------+       +------+            |
|                                       |
+---------------------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Round counter | top-left | "Round N/9" | No |
| Lives display | top-right | 3 heart icons, filled = remaining, empty = lost | No |
| Timer | below round counter, left | "MM:SS" count-up from 00:00 | No |
| Score display | below lives, right | "Score: N" | No |
| Progress bar | below timer/score row | Filled bar tracking currentRound/9 | No |
| Left column items | left half, vertically stacked | Numbers (e.g., 3, 7, 5). Each is a tappable card. | Tap to select |
| Right column items | right half, vertically stacked | Doubles in shuffled order (e.g., 14, 10, 6). Each is a tappable card. | Tap to attempt match |

### States for items

- **Default:** Neutral background, tappable.
- **Selected (left):** Blue border/glow. Only one left item selected at a time.
- **Correct match:** Both items turn green, opacity reduced, pointer-events disabled (locked).
- **Wrong match:** Both items flash red for 600ms, then return to default.

### Entry condition

Student taps "Start" on start screen. Round 1 loads with 3 pairs. Timer starts counting up from 00:00.

### Exit condition

- All 9 rounds completed (all pairs matched in round 9) -> transition to results screen.
- Lives reach 0 -> transition to game_over screen.

---

## Results Screen (data-phase="results")

### Layout

```
+---------------------------------------+  375x667
|                                       |
|                                       |
|            WELL DONE!                 |  <- congratulations text
|                                       |
|          *   *   *                    |  <- 3 star display (filled/empty)
|                                       |
|        Time: 00:52                    |  <- total time
|        Score: 36/36                   |  <- matches made / total possible
|        Accuracy: 95%                  |  <- correct matches / total attempts
|                                       |
|                                       |
|          +---------------+            |
|          |  Play Again   |            |  <- CTA button
|          +---------------+            |
|                                       |
|                                       |
+---------------------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Congratulations text | center, upper third | "Well Done!" / "Great Job!" | No |
| Stars display | center, below title | 1-3 filled stars based on time thresholds | No |
| Time | center | "Time: MM:SS" total elapsed time | No |
| Score | center, below time | "Score: N/36" correct matches out of total possible | No |
| Accuracy | center, below score | "Accuracy: N%" (correct matches / total attempts * 100) | No |
| Play Again button | center, lower third | "Play Again" | Tap |

### Entry condition

Round 9 complete (all pairs matched). Timer pauses. Screen renders FIRST. `game_complete` postMessage sent BEFORE audio. Then victory/complete SFX -> VO plays (sequential, awaited). CTA is already visible.

### Exit condition

Student taps "Play Again". All audio stops. All state resets. Return to start screen.

---

## Game Over Screen (data-phase="game_over")

### Layout

```
+---------------------------------------+  375x667
|                                       |
|                                       |
|            GAME OVER                  |  <- game over title
|                                       |
|              :(                       |  <- sad emoji
|                                       |
|      You completed 4 rounds           |  <- rounds completed
|      Score: 12/36                     |  <- matches made
|                                       |
|                                       |
|          +---------------+            |
|          |   Try Again   |            |  <- CTA button
|          +---------------+            |
|                                       |
|                                       |
+---------------------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Title | center, upper third | "Game Over" | No |
| Sad emoji | center, below title | Sad face emoji | No |
| Rounds completed | center | "You completed N rounds" | No |
| Score | center, below rounds | "Score: N/36" | No |
| Try Again button | center, lower third | "Try Again" | Tap |

### Entry condition

Lives reach 0 on a wrong match. Timer pauses. Screen renders FIRST. `game_complete` postMessage sent BEFORE audio. Then game-over SFX -> VO plays (sequential, awaited). CTA is already visible.

### Exit condition

Student taps "Try Again". All audio stops. All state resets. Return to start screen.

---

## Round Presentation Sequence

Within the gameplay screen, each round follows this sequence:

1. **New round loads** -- Previous round's matched items clear. New pairs render in two columns (left = numbers, right = shuffled doubles). `new_cards` SFX plays (fire-and-forget). Items fade in (350ms).
2. **Instructions** (Round 1 only) -- No explicit instruction overlay. The two-column layout is self-explanatory. Implicit instruction via column headers: "Number" (left) and "Double" (right).
3. **Gameplay active** -- All items are tappable. Timer continues counting. Student taps left item to select, then right item to attempt match.
