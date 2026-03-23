# Game Spec Review Prompt

When the user says "review spec", run the following review process against the game spec present in the conversation.

---

You are reviewing a MathAI game spec before it is implemented. Your job is to find issues that would cause bugs, broken learning outcomes, or a bad user experience — before any code is written.

Do not apply rigid rules. Instead, reason from the intent of the spec. Every finding should explain *why* something is a problem given what this specific game is trying to do.

**Important assumptions:**
- The student already understands the math concept from prior instruction (a video, lesson, or tutorial). This game is practice, not introduction. The game does not need to explain the concept — it needs to correctly exercise it.
- Never write code in your response. Describe what the spec should say differently, not how to implement it.

You MUST use this exact format for every finding. Do not deviate from this structure:

```
### [SEVERITY] [CATEGORY] — [Short title]

**What the spec says:** "[Direct quote from the spec]"

**Problem:** [What goes wrong, for this specific game]

**Suggested fix:** [Describe the change in plain language — no code]
```

Where:
- SEVERITY is one of: 🔴 Critical | ⚠️ Warning | ℹ️ Info
- CATEGORY is one of: Concept | Interaction | Promise | Completeness

Example:

```
### 🔴 Critical · Interaction — Timer not recreated between rounds

**What the spec says:** "Timer destroyed in endGame() and at start of each new round."

**Problem:** TimerComponent is destroyed but never recreated for the next round. startRound() would crash when calling timer.start() on a null reference.

**Suggested fix:** Add an explicit statement: "At the start of each new round, the previous timer is destroyed and a new TimerComponent is created with startTime: rounds[currentRound].timerSeconds."
```

Every finding MUST have all three fields (What the spec says, Problem, Suggested fix). Do not merge or skip any field.

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

### Step 6 — Input Schema & Content Set Readiness

The spec must provide enough information for the pipeline to generate an `inputSchema.json` and multiple content sets without guessing. Check both:

#### 6a — Input Schema

Look for a section in the spec that describes **what data the game accepts as input** — i.e., what is parameterized and what is hardcoded. Specifically:

1. **Is there a clear description of the input schema structure?** The spec should describe (in prose or JSON) every top-level field the game expects from external content: round configurations, prompts, grid/board dimensions, answer sets, distractor pools, timing values, etc.
2. **Is it clear which parts of the game are content-driven vs. hardcoded?** For example: are sound IDs, sticker URLs, and instruction text parameterized, or baked into the HTML? The spec should make this explicit.
3. **Are the field types, constraints, and required/optional status described?** e.g., "rounds: array of 1–5 round objects, each with a grid (rows: integer 3–7, cols: integer 3–7) and a tagCluster (tags: array of at least 3 tag objects)."
4. **Is there a fallback content example?** The spec should include at least one complete example of valid input content so the generator knows the exact shape.

If input schema information is **missing or vague**, emit a **⚠️ Warning · Completeness** finding. In the "Suggested fix" field, propose a concrete schema outline based on what the spec's game mechanics imply should be parameterized (round structure, answer data, difficulty knobs, display text, etc.).

#### 6b — Content Set Generation

Look for a section that describes **how to generate multiple content sets** at different difficulty levels. Specifically:

1. **Does the spec state how many content sets to generate?** (The standard is 3: easy, medium, hard.)
2. **Does it describe what varies between difficulties?** e.g., "easy uses smaller numbers and fewer blanks; hard uses larger numbers, more blanks, and denser grids." Vague statements like "make it harder" are not sufficient — the spec should name the specific dimensions that change (number range, grid size, item count, time limit, number of rounds, distractor count, etc.).
3. **Does it describe constraints that all content sets must satisfy?** e.g., "every expression must be mathematically solvable," "no duplicate tags," "grid must have at least one valid solution."
4. **Are there examples or authoring guidance?** e.g., "one simpler compact grid with fewer blanks, one medium grid, one larger grid with more expressions."

If content set generation guidance is **missing or vague**, emit a **⚠️ Warning · Completeness** finding. In the "Suggested fix" field, propose concrete content set guidance: how many sets, what dimensions to vary, what constraints to enforce, and a brief example of how easy/medium/hard would differ for this specific game.

---

### Step 7 — Feedback Asset Completeness

If the spec describes audio or visual feedback, check that the required assets are actually specified.

#### 7a — Static Audio URLs

Look for any mention of playing pre-loaded sounds (e.g., `sound.play`, `FeedbackManager.sound.play`, `preload`, sound IDs like `correct_tap`, `wrong_tap`, `all_correct`, etc.).

- If the spec says a sound should play but **does not provide the audio URL** for that sound (or reference a standard sound ID from PART-017), emit a **⚠️ Warning · Completeness** finding. The generator cannot preload audio without a URL.
- This does **NOT** apply to dynamic/TTS audio (`playDynamicFeedback`, `audio_content`). Dynamic audio only needs text content, not a URL.

#### 7b — Sticker URLs

Look for any mention of showing stickers during feedback (e.g., `sticker`, `IMAGE_GIF`, sticker on correct/incorrect, etc.).

- If the spec says a sticker should appear but **does not provide the sticker image URL** (or reference a standard sticker from PART-017), emit a **⚠️ Warning · Completeness** finding. The generator cannot show a sticker without a URL.

For both 7a and 7b: if the spec references standard asset IDs (e.g., "use the standard correct/incorrect sounds and stickers") without explicit URLs, that is acceptable — the standard URLs are defined in PART-017. The warning is only for cases where the spec invents custom feedback moments without providing the corresponding asset URLs.

---

### Summary

End with this exact summary table. List each finding as a one-line reference. Do not omit any finding.

```
| # | Severity | Category      | Title                              |
|---|----------|---------------|------------------------------------|
| 1 | Critical | Interaction   | Timer not recreated between rounds |
| 2 | Warning  | Concept       | Arbitrary distractors              |
| … | …        | …             | …                                  |

VERDICT: [Ready for implementation | Needs revision — N critical, M warnings]
```

If there are any Critical findings, the verdict MUST be "Needs revision".
