# Emotional Safety Rules

## Core Principle

**[SUGGESTED]** A student who feels stupid will not learn. Every design decision must pass the test: "Would a 12-year-old in a crowded classroom feel okay if their friend saw this screen?"

## Game-Over Language

**[MANDATORY]** Never use (banned phrases — spec-review FAILs if present):
- "Game Over" (sounds final, punitive)
- "You failed" / "You lost"
- "Wrong!" as standalone (too harsh)
- "Try harder" (implies the student wasn't trying)
- Red X marks without accompanying explanation
- Score: 2/9 (bare low numbers without context)

**Example (bad):** Screen reads "GAME OVER -- Score: 2/9. Try harder next time!"

Always use:
- "Let's try again!" (for game-over screen)
- "Good effort! You got [N] right." (acknowledge what they DID get)
- "Not quite -- here's what happened: [explanation]" (for wrong answers)
- "You're getting better!" (for retry after game-over, if score improved)
- Phrase scores as progress: "You got 6 right this time!" not "You missed 3"

**Example (good):** Screen reads "Good effort! You got 6 right. Ready for another round?"

## Failure Recovery Patterns

### After 2 consecutive wrong answers **[SUGGESTED]**

- Change encouragement tone slightly: "Take your time with this one."
- No structural change to the game. Two wrongs is normal.

### After 3 consecutive wrong answers **[SUGGESTED]**

This is a critical moment. The student's confidence is crumbling. Response:

1. **Trigger automatic scaffolding** for the current question (skip to full reveal).
2. **Insert an easier question next** (drop to Stage 1 difficulty for one round). This gives the student a guaranteed win to rebuild confidence.
3. **Change feedback tone** to explicitly encouraging: "Nice work!" on the easy question, regardless of whether it's trivially simple.
4. **Resume normal difficulty** after the confidence-building round.

Record this event: `confidence_recovery_triggered: true` in the next `recordAttempt`.

### After 5 consecutive wrong answers **[SUGGESTED]**

This indicates a prerequisite gap, not a difficulty problem. The student likely lacks foundational knowledge for this game.

1. **Show the results screen** (do not continue to game-over). Frame it as: "Let's review what we've covered so far."
2. **Show all questions with correct answers** as a mini-lesson.
3. **Do NOT show a score or stars.** Show: "You practiced [N] questions today."
4. **Offer "Play again" prominently.**

Record: `prerequisite_gap_likely: true` in `game_complete`.

## Tone by Bloom Level

| Bloom level | Correct answer tone | Wrong answer tone | Game-over tone |
|------------|--------------------|--------------------|----------------|
| L1 Remember | Celebratory. "Yes!" with confetti. | Matter-of-fact. "The answer is [X]." No dwelling. | "Nice practice! Let's go again?" |
| L2 Understand | Warm. "That's right! You noticed [property]." | Gentle redirect. "Not quite. Look at [feature]." | "Good thinking! Want to try again?" |
| L3 Apply | Affirming. "Correct! Clean solution." | Procedural. "Check your [step]. Here's the approach." | "Solid effort. Ready for another round?" |
| L4 Analyze | Respectful. "Excellent analysis." | Curious. "Interesting -- what made you choose that?" | "Those were tough problems. Want to tackle them again?" |

## What "Encouraging" Does NOT Mean

- It does NOT mean lying. "Great job!" when the student got 1/9 is patronizing.
- It does NOT mean removing challenge. Easy games are boring, not safe.
- It does NOT mean hiding the score. Students know when they're doing badly. Hiding the score insults their intelligence.
- It DOES mean: framing failure as information ("now you know what to review"), not as judgment ("you're bad at this").
