# Bloom-to-Game Mapping

**[SUGGESTED]** This is the central lookup table. For each Bloom level, every structural decision is a default recommendation. The pipeline looks up these defaults; creators may override individual rows for specific games. (Tagging note: the table as a *reference* is canonical, but each row — e.g. "L4 scaffolding after 1st wrong = metacognitive prompt" — is a pedagogical default, not a hard contract. The L4-after-1-wrong-metacognitive rule is the one that bit cross-logic and is explicitly SUGGESTED.)

## L1 Remember

> The student retrieves facts from memory. Recognition, not production.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Recommended structures** | MCQ Quiz, Speed Blitz, Memory Match | Recognition tasks: pick the right answer from options |
| **Interaction type** | MCQ single-select, click-to-match | No construction; student selects, not produces |
| **Scoring model** | See `game-archetypes.md` for star thresholds. No penalty for wrong. | Recall is binary -- you know it or you don't. Low star thresholds because recall games are meant to build confidence. |
| **Feedback style** | Immediate. Show correct answer on wrong. No explanation needed -- the fact IS the explanation. "The answer is 7 x 8 = 56." | At L1 the student needs exposure, not reasoning. |
| **Scaffolding pattern** | Show answer immediately after wrong attempt. No hints. Auto-advance after 1.5s. | Hints are wasted at L1 -- you either recall or you don't. Fast exposure to correct answer builds memory. |
| **Lives policy** | No lives (no-penalty). All students complete all rounds. | Kicking a student out of a recall game defeats the purpose -- they need MORE exposure, not less. |
| **Difficulty progression** | Stage 1: common/familiar items. Stage 2: less common items. Stage 3: easily confused pairs (e.g., 7x8 vs 6x9). | Difficulty = how likely the item is to be confused with another. |
| **Pacing** | Fast. 3-5 seconds per question target. Rhythm matters more than thinking time. | Recall should feel like a drill -- snappy, rhythmic, rewarding. |
| **Round count** | 9-15 rounds (3 stages of 3-5). Short sessions. | Recall fatigue sets in fast. Better to replay than to slog. |

## L2 Understand

> The student demonstrates comprehension. Can explain, classify, compare -- not just recognize.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Recommended structures** | MCQ Quiz, Sort/Classify, No-Penalty Explorer | Classification and comparison are L2 hallmarks. |
| **Interaction type** | MCQ single-select, drag-and-drop (sorting), multi-select ("which of these apply?") | Student must discriminate between options, not just recognize. |
| **Scoring model** | See `game-archetypes.md` for star thresholds. No penalty for wrong on first attempt; if retry mechanic exists, reduced score on retry. | Understanding benefits from exploration -- penalizing first wrong discourages risk-taking. |
| **Feedback style** | Corrective with brief explanation. "Not quite -- an equilateral triangle has all sides equal. This one has only two equal sides, so it's isosceles." Show correct answer + 1-sentence reason. | The student needs to understand WHY, not just WHAT. |
| **Scaffolding pattern** | After 1st wrong: show a guided hint (highlight the relevant property). After 2nd wrong: show correct answer + explanation. Auto-advance after student taps "Got it." | Two chances before reveal. Hint bridges the gap. |
| **Lives policy** | No lives (no-penalty) or generous lives (5). Never strict lives at L2. | Understanding develops through exploration. Punishment kills curiosity. |
| **Difficulty progression** | Stage 1: clear-cut examples (textbook cases). Stage 2: examples requiring one distinguishing feature. Stage 3: near-miss examples (items that look like they belong but don't). | Difficulty = ambiguity of classification. |
| **Pacing** | Moderate. 8-15 seconds per question. Time to read, think, decide. | Rushing understanding produces guessing. |
| **Round count** | 9 rounds (3 stages of 3). | Standard. |

## L3 Apply

> The student uses a procedure to solve a problem. Computation, construction, application to new contexts.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Recommended structures** | Lives Challenge, Construction, Worked Example | Application has right/wrong answers with procedural steps. Lives add stakes. |
| **Interaction type** | Number input, build-from-parts, MCQ (for multi-step with final answer), step-reveal | Student produces an answer, not just selects. |
| **Scoring model** | See `game-archetypes.md` for star thresholds. -1 life per wrong. 3 lives default. Bonus for first-attempt correct. | Application is performance -- stakes matter. First-attempt bonus rewards fluency. |
| **Feedback style** | Corrective with procedural hint. "The area of a triangle is (base x height) / 2. You used base x height without dividing." Reference the specific step that went wrong. | The student has the concept but made a procedural error. Point to the step. |
| **Scaffolding pattern** | After 1st wrong: nudge toward the procedure ("Remember: what formula do you need here?"). After 2nd wrong: show the first step of the solution. After 3rd wrong: show full worked solution, deduct 1 life, advance. | Progressive reveal. Each hint gives more. Student always sees the solution before moving on. |
| **Lives policy** | 3 lives. Game over when lives = 0. Student sees all questions answered correctly before game-over screen (review of mistakes). | Lives create focus. Game-over review ensures learning even in failure. |
| **Difficulty progression** | Stage 1: single-step application (one operation). Stage 2: two-step (requires chaining). Stage 3: multi-step or application in unfamiliar context. | Difficulty = number of procedural steps + context unfamiliarity. |
| **Pacing** | Slow. 15-30 seconds per question. Time to compute. | Application requires working memory. Rushing causes careless errors that teach nothing. |
| **Round count** | 9 rounds (3 stages of 3). Fewer if multi-step (6 rounds of 2 stages). | Longer per-round time means fewer rounds to avoid fatigue. |

## L4 Analyze

> The student breaks a problem into parts, identifies patterns, compares structures, evaluates relationships.

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **Recommended structures** | Board Puzzle, Sort/Classify (complex), Construction (proof-like) | Analysis requires seeing the whole picture, not round-by-round drill. |
| **Interaction type** | Multi-select, drag-and-drop (complex sorting), click-to-select (board), construction | Student must examine multiple elements and determine relationships. |
| **Scoring model** | Holistic per-round scoring (not per-click). See `game-archetypes.md` for star thresholds. No partial credit within a round -- analysis is all-or-nothing for each problem. | Analysis can't be scored per-tap. The whole answer is the unit. |
| **Feedback style** | Ask-back before revealing. "What would you check first?" or "Which property did you use to decide?" Then show the analysis path. Never just show the answer -- model the thinking. | At L4, showing the answer teaches nothing. The reasoning path IS the content. |
| **Scaffolding pattern** | After 1st wrong: metacognitive prompt ("What information do you have? What are you looking for?"). After 2nd wrong: narrow the scope ("Focus on just these two items -- what's different?"). After 3rd wrong: show the full analysis with reasoning chain. | Scaffolding at L4 is about narrowing attention, not revealing answers. |
| **Lives policy** | No lives OR generous lives (5). Analysis benefits from multiple attempts. Strict lives at L4 produce stress, not insight. | The goal is to develop analytical thinking. Punishment impedes higher-order cognition. |
| **Difficulty progression** | Stage 1: two items to compare (binary analysis). Stage 2: three or more items, one distinguishing feature. Stage 3: multiple features, requires synthesis to distinguish. | Difficulty = number of dimensions the student must consider simultaneously. |
| **Pacing** | Very slow. 30-60 seconds per problem. No time pressure. | Analysis cannot be rushed. Time pressure forces pattern-matching instead of genuine analysis. |
| **Round count** | 6 rounds (2 stages of 3, or 3 stages of 2). | Complex problems need few rounds. Quality over quantity. |
