# Scaffolding Patterns by Bloom Level

**[SUGGESTED]** Scaffolding is the support given when a student is stuck. It is NOT the same as feedback (which responds to a completed attempt). Scaffolding intervenes DURING the struggle, before the student gives up.

## When Scaffolding Triggers

| Event | Action |
|-------|--------|
| 1st wrong attempt | Bloom-level-dependent (see below) |
| 2nd wrong attempt | Bloom-level-dependent (see below) |
| 3rd wrong attempt | **[SUGGESTED]** Show full solution, mark as scaffolded, advance |
| 15 seconds with no input (L1/L2) | Gentle nudge: "Take your time!" (not a hint) |
| 30 seconds with no input (L3/L4) | No nudge. Thinking time is expected. |

## Scaffolding by Bloom Level

### L1 Remember: Immediate Reveal **[SUGGESTED]**

```
Wrong attempt -> Show correct answer immediately
               -> "The answer is [X]."
               -> Highlight the correct option green
               -> Auto-advance after 1.5 seconds
               -> No lives lost, no score penalty
```

Why: At L1, the student either recalls or doesn't. There is nothing to "hint at." Rapid exposure to correct answers builds the memory trace.

### L2 Understand: Guided Hint, Then Reveal **[SUGGESTED]**

```
1st wrong -> Guided hint: highlight the distinguishing property
             "Look at the number of equal sides."
             Let student try again (same question, same options)

2nd wrong -> Reveal correct answer + 1-sentence explanation
             "An isosceles triangle has exactly 2 equal sides. This triangle has 2 equal sides and 1 different, so it's isosceles."
             Student taps "Got it" to advance
```

Why: Understanding requires connecting features to categories. The first hint narrows attention. The second provides the connection explicitly.

### L3 Apply: Progressive Procedural Reveal **[SUGGESTED]**

```
1st wrong -> Nudge toward the procedure
             "What formula do you need for the area of a triangle?"
             (Do NOT show the formula -- ask for it)
             Let student try again

2nd wrong -> Show the first step
             "Area = (base x height) / 2. The base is 6cm and the height is 4cm."
             Let student try again (they still need to compute)

3rd wrong -> Show full worked solution
             "Area = (6 x 4) / 2 = 24 / 2 = 12 cm^2"
             -1 life. Auto-advance after student taps "Got it"
```

Why: At L3, the student knows the concept but fumbles the procedure. Each hint gives one more piece of the procedure, preserving as much productive struggle as possible.

### L4 Analyze: Metacognitive Scaffolding **[SUGGESTED]** (this is the rule that bit cross-logic — metacognitive prompt after 1 wrong is a pedagogical default, not a contract; creators can override or omit)

```
1st wrong -> Metacognitive prompt
             "What information do you have? What are you trying to find?"
             (Forces the student to articulate the problem structure)
             Let student try again

2nd wrong -> Narrow the scope
             "Focus on just these two: [subset]. What's different about them?"
             (Reduces cognitive load by reducing dimensions)
             Let student try again

3rd wrong -> Show the full analysis with reasoning chain
             "Step 1: Compare A and B on [feature]. Step 2: Compare B and C on [feature]. Step 3: Therefore..."
             No lives lost. Student taps "Got it" to advance
```

Why: At L4, showing the answer teaches nothing -- the reasoning IS the content. Scaffolding must model the analytical process, not shortcut it.

## Scaffolding and Scoring

| Event | Score impact | Lives impact |
|-------|------------|-------------|
| Correct on 1st attempt | Full score (+1) | No change |
| Correct on 2nd attempt (after hint) | Half score (+0.5) | No change |
| Correct on 3rd attempt (after 2 hints) | Minimal score (+0.25) | No change |
| Revealed after 3rd wrong | No score (0) | -1 life (L3 only) |

**[MANDATORY]** Record in `recordAttempt`: `is_scaffolded: true`, `scaffold_level: 1|2|3`, `attempts_before_correct: N`. (Data-contract field; analytics depend on these.)

## Scaffolding vs Hints vs Feedback -- Definitions

| Term | When | Purpose | Example |
|------|------|---------|---------|
| **Feedback** | After a completed attempt (right or wrong) | Tell the student what happened | "Correct!" / "Not quite." |
| **Hint** | During an attempt, triggered by wrong answers | Guide toward the answer | "Look at the angles." |
| **Scaffolding** | Structural support across the game | Reduce cognitive load | Progressive reveal, worked example phases, simplified options |

A game can have all three. They are not interchangeable.
