# Game Spec Review Prompt

When the user says "review spec", run the following review process against the game spec present in the conversation.

---

You are reviewing a MathAI game spec before it is implemented. Your job is to find issues that would cause bugs, broken learning outcomes, or a bad user experience — before any code is written.

Do not apply rigid rules. Instead, reason from the intent of the spec. Every finding should explain *why* something is a problem given what this specific game is trying to do.

**Important assumptions:**
- The student already understands the math concept from prior instruction (a video, lesson, or tutorial). This game is practice, not introduction. The game does not need to explain the concept — it needs to correctly exercise it.
- Never write code in your response. Describe what the spec should say differently, not how to implement it.

For each issue found, output:
- **Severity**: Critical / Warning / Info
- **Category**: Concept | Interaction | Promise | Completeness
- **What the spec says** (quote it)
- **The problem** (what goes wrong, for this specific game)
- **Suggested fix** (describe the change in plain language — no code)

---

### Step 1 — Understand the game first

Before reviewing anything, answer these questions from the spec:

1. What math concept does this game exercise?
2. How does the core mechanic represent or reinforce that concept?
3. What does a "correct" user interaction look like from start to finish (walk through one round)?
4. What are all the states a user can be in during gameplay?

Write these answers out. They will be the lens for everything that follows.

---

### Step 2 — Does the game correctly reinforce the concept?

Using your understanding from Step 1:

1. Does the mechanic accurately model the concept? Could a student who already understands the concept be confused or led astray by how the game represents it?
2. Is there any way to succeed in the game *without* engaging with the concept? (i.e., is the mechanic essential, or can it be bypassed?)
3. Do the example numbers, labels, and feedback messages reflect the concept accurately? Check any worked examples in the spec for correctness.
4. Is the difficulty/pacing appropriate for practice — not too easy to complete without thinking, not so hard it becomes frustrating?

---

### Step 3 — Interaction flow

For each interactive element or user action described in the spec:

1. **In every state the user can be in, can they still perform the actions the game intends them to perform?**
   - Walk through the user flows implied by the concept (not just the happy path).
   - For each state change or UI re-render, ask: given what this game is trying to do, does the user retain the ability to do what they need to do next?
   - Flag any state where a user becomes stuck or loses an option they should have — *but only if that loss is unintended given the game's design.*

2. **Are repeated actions handled correctly?**
   - For actions that a user is expected to perform multiple times (e.g., adjusting a value, retrying after a wrong answer), does the spec support this correctly across all iterations, not just the first?

3. **Are transitions between states complete?**
   - When the spec describes a state change (new round, level transition, wrong answer, correct answer), does it fully describe the resulting state, or does it leave things ambiguous?

---

### Step 4 — Does the spec honor its own promises?

The spec uses language that carries implicit user expectations. For each named action, screen, or button described in the spec, ask: **does the described implementation actually deliver what that language promises to the user?**

1. **Identify the promises.** Look for language like button labels ("Play Again", "Try Again", "Next Level"), screen names ("Results", "Game Over"), and transition descriptions. Each one carries a user expectation. State what that expectation is in plain terms.
   - "Play Again" → user expects the game to feel like the first time they played it
   - "Next Level" → user expects continuity of progress into a harder challenge
   - "Try Again" → user expects the same problem with a fresh attempt

2. **Check if the described behavior matches the promise.** For each promise, look at what the spec says the relevant function actually does. Ask:
   - Does the described behavior match the user's expectation?
   - Is there state that *should* carry over (e.g., total games played, high score) that the spec would accidentally wipe?
   - Is there state that *should* reset (e.g., current score, lives, round) that the spec leaves unchanged?

   The goal is not "reset everything" or "reset nothing" — it is: **does the resulting state match what the user would expect given the label or description that triggered this transition?**

3. **Flag mismatches between promise and implementation**, not just missing resets.

---

### Step 5 — Spec completeness

Flag anything left undefined or ambiguous:

1. Are there combinations of state the spec doesn't cover?
2. Are there user actions the spec doesn't define a response for?
3. Are there edge cases at the boundaries (first round, last round, zero lives, maximum/minimum values)?
4. Does every described UI state have a clear path to the next state?

---

### Summary

```
CONCEPT
- [findings about whether the mechanic correctly exercises the concept]

INTERACTION
- [findings about stuck states, broken flows, or repeated-action failures]

PROMISES
- [findings about mismatches between what the spec says and what it actually describes happening]

COMPLETENESS
- [findings about undefined states, missing edge cases, ambiguous spec language]

VERDICT: [Ready for implementation | Needs revision]
```
