# Scoring: Odd Fraction Out

## Points

| Action | Points | Notes |
|--------|--------|-------|
| Correct tap (card `c4` = 2/3) | +1 | Only correct outcome. Binary. |
| Wrong tap (card `c1`, `c2`, or `c3`) | 0 | No point penalty beyond the 0; game ends after the tap (no retry). |

## Formula

```
score = (student tapped c4) ? 1 : 0
maxScore = totalRounds = 1
percentage = (score / maxScore) * 100 = score * 100    // yields 0 or 100
```

## Star Thresholds

Shape 1 Standalone with binary outcome per spec: "3 stars = correct tap (2/3). 0 stars = any incorrect tap. No 1-star or 2-star tier."

| Stars | Threshold | Displayed as |
|-------|-----------|-------------|
| 3 stars | score == 1 (i.e. >= 100%) | Three filled stars (host-rendered post-game_complete) |
| 2 stars | N/A — not reachable | — |
| 1 star | N/A — not reachable | — |
| 0 stars | score == 0 (i.e. 0%) | Three empty stars (host-rendered post-game_complete) |

**Override of default 90/66/33%:** Spec explicitly pins stars to binary (3 or 0). Default thresholds do not apply.

**Star display:** Per Shape 1 Standalone — no Victory/Results screen is rendered. Stars are auto-finalized in the `game_complete` payload and the host app renders the star summary post-game_complete. There is no "Claim Stars" tap inside this game's HTML.

## Lives (if applicable)

| Parameter | Value |
|-----------|-------|
| Starting lives | N/A — no lives in this game |
| Lives lost per wrong answer | N/A |
| Game over condition | N/A — game cannot end via life loss because lives do not exist |
| Lives display | Not rendered |
| Life loss animation | Not applicable (no `.heart-break`) |

Per spec Game Parameters: "Lives: None (0). No life display UI." The `livesLeft` field in `game_complete` payload is set to `null` (not 0) to signal "lives concept does not apply to this game."

## Progress Bar

| Parameter | Value |
|-----------|-------|
| Tracks | N/A — hidden for Shape 1 Standalone per `reference/shapes.md` |
| Position | Not rendered |
| Style | Not rendered |
| Updates | N/A |

Per Shape 1 Standalone rules: "**no progress bar in this shape**." Gameplay wireframe must NOT include a progress bar element.

## Data Contract Fields

These fields populate the `game_complete` postMessage payload sent to the host app immediately after the 2000ms feedback dwell:

| Field | Source | Example value (correct) | Example value (wrong) |
|-------|--------|------------------------|----------------------|
| correct | `gameState.correct` (boolean) | `true` | `false` |
| score | `gameState.score` | `1` | `0` |
| totalQuestions | `gameState.totalRounds` (= 1) | `1` | `1` |
| stars | calculated from `correct` (binary: 3 or 0) | `3` | `0` |
| accuracy | `percentage` | `100` | `0` |
| livesLeft | (no lives in game) | `null` | `null` |
| timeSpent | `Date.now() - gameState.startTime` | e.g. `4200` ms | e.g. `4200` ms |

Additionally, one `recordAttempt` postMessage fires per tap (before `game_complete`):

| Field | Source | Example (correct) | Example (wrong: tapped 6/8) |
|-------|--------|------------------|----------------------------|
| selected_option | tapped card's label | `"2/3"` | `"6/8"` |
| is_correct | boolean | `true` | `false` |
| misconception_tag | from `misconception_tags` map (wrong only) | `null` | `"MISC-FRAC-EQ-02"` |
| round | current round number | `1` | `1` |
