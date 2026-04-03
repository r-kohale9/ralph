# Game Design: Match Up!

## Identity

- **Game title:** Match Up!
- **Game ID:** ratio-match-up
- **Learning goal:** Equivalent Ratios (Grade 5)
- **Skills covered:** 1 (identify equivalent ratios) & 2 (generate equivalent ratios)
- **Grade:** 5
- **Bloom level:** L2 Understand → L3 Apply

---

## Concept

The kid sees a ratio in a real-world context (recipe, craft pattern, sports team setup) and must either judge whether a second ratio is equivalent (Skill 1) or produce an equivalent ratio by filling in the missing number (Skill 2). The game progressively moves from simple ×2 multipliers to ×3-×5, and from "is this the same?" judgment to "make it the same" production.

---

## Round Types

### Type A: "Same or Different?" (Skill 1 — Identify)

The kid sees two ratios side by side in the same real-world context and decides if they're equivalent.

**Layout:**
- Rule card: "For every 2 🍎, there are 3 🍊"
- Comparison card: "For every 6 🍎, there are 9 🍊"
- Two buttons: "Same ratio!" / "Different ratio!"
- If Different: no follow-up needed (simpler than Scale It Up's reason mechanic)

**Key distractors:**
- Additive trap: 2:3 → 5:6 (added 3 to each)
- Swap trap: 2:3 → 3:2 (reversed)
- One-side trap: 2:3 → 4:3 (only first doubled)

### Type B: "Make It Match!" (Skill 2 — Generate)

The kid sees a ratio and a multiplier instruction, then fills in both values of the equivalent ratio.

**Layout:**
- Rule card: "For every 3 🌹, there are 2 🌻"
- Instruction: "Make it ×4 bigger!"
- Two input fields: ___ 🌹 and ___ 🌻
- Submit button

**Key design:**
- Both fields must be filled (kid produces BOTH numbers)
- Validates each field independently — can get partial credit feedback ("First number correct! Check the second.")
- Additive trap shown as hint on wrong answer: "Did you add 4 instead of multiply by 4?"

---

## Game Structure

| Field | Value |
|-------|-------|
| Rounds | 10 |
| Lives | 3 |
| Timer | None |
| Stages | 3 (Easy → Medium → Hard) |
| Stars | 80%→3★, 50%→2★, >0%→1★ |

### Stage Breakdown

| Stage | Rounds | Types | Multipliers | Ratio complexity |
|-------|--------|-------|-------------|-----------------|
| 1 (Easy) | 1-3 | Type A only | ×2 | Ratios with 1 (1:2, 1:3, 2:1) |
| 2 (Mixed) | 4-7 | A + B | ×2, ×3 | Ratios without 1 (2:3, 3:4) |
| 3 (Hard) | 8-10 | A + B | ×3, ×4, ×5 | Ratios without 1, additive traps close to correct |

---

## Comparison with Previous Games

| Aspect | Same Rule? | Scale It Up | Match Up! |
|--------|-----------|-------------|-----------|
| Goal | Ratio intuition | Ratio intuition | Equivalent ratios |
| Skills | 1-2 | 3-5 | 1-2 (new goal) |
| Core question | "Same for-every rule?" | "What happens when it scales?" | "Same ratio or different?" |
| Key difference | Compares two scenes | Predicts missing value | Compares two explicit ratios |
| Type A | Same/Different judgment | Fill-in-blank | Same/Different judgment |
| Type B | Rule sentence builder | Same/Different + reason | Double fill-in-blank |
| Lives | No | 3 | 3 |

**Why this isn't a repeat of Same Rule?:** Same Rule? tests whether the kid can SEE the for-every relationship in visual scenes. Match Up! tests whether the kid can COMPARE two explicit ratios and GENERATE equivalent ones using multiplication. The cognitive demand shifts from perceptual recognition to multiplicative reasoning.

---

## Voice-Over Strategy

- **Correct (Type A):** Confirm the multiplicative link. "Yes! Both sides were multiplied by 3, so it's the same ratio."
- **Incorrect (Type A):** Point out the mismatch. "Not quite — the apples doubled but the oranges didn't. That changes the ratio."
- **Correct (Type B):** Celebrate the production. "Nice! 3 times 4 is 12, and 2 times 4 is 8. Perfect match!"
- **Incorrect (Type B):** Diagnose the error. "Hmm, did you add 4 instead of multiply? Remember, multiply BOTH sides by the same number."

---

## Visual Design Notes

- Same MathAI design system (Epilogue, 480px, cream/purple/green/red)
- Rule card prominently displayed at top (purple accent border)
- Comparison card below with yellow highlight for emphasis
- Type B has two side-by-side input fields with emoji labels
- Multiplier instruction in a fun "badge" style (e.g., "×3" in a circle)
