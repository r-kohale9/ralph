# real-world-problem — Pedagogical Spec Review

**Reviewed:** 2026-03-23
**Spec version:** 714 lines, 4 rounds (ladder/ramp/flagpole/cable)
**Reviewer:** Education Implementation Slot

---

## 1. Bloom Assessment

**Verdict: Genuine L4 Analyze — the claimed level is structurally enforced, not cosmetic.**

The three-step decomposition is the key:

- **Step 1 (diagram labeling):** The learner must independently determine which physical object in the scenario (ladder, ramp, shadow, pole) corresponds to which geometric role (opposite/adjacent/hypotenuse) relative to the named angle. The SVG diagram uses context nouns, not geometric labels, so the learner cannot short-circuit by reading the answer off the diagram. This is the L3→L4 boundary: constructing the triangle model from a word description rather than being handed a labeled triangle.

- **Step 2 (ratio selection):** Given the learner's step-1 answer, they select sin/cos/tan. Equivalent to find-triangle-side step 1 — this is L3 Apply territory. Embedded here as a dependent sub-step, not the primary cognitive demand.

- **Step 3 (typed numeric computation):** Execute the formula, including rearranged cases in rounds 3-4. L3 Apply.

**The spec correctly identifies that the new cognitive demand is step 1.** Rounds 1-2 use direct formula; rounds 3-4 use rearranged formula (divide instead of multiply). This is a genuine difficulty ladder — not superficial variation.

**One concern:** The MCQ for step 1 offers exactly 3 options (opposite/adjacent/hypotenuse). With 3 options, a confused learner has a 1-in-3 chance of guessing correctly and proceeding to step 2 without understanding the diagram. The spec mitigates this by showing detailed explanatory feedback even after a wrong answer followed by "Continue" — so a wrong step-1 answer is instructionally corrective, not just a gate. The no-life-deduct policy on step 1 is pedagogically correct (step 1 errors are learning opportunities, not performance failures). The design is acceptable but a future enhancement could be a second attempt before "Continue" appears, to increase the signal that the learner actually understood the feedback.

---

## 2. Misconception Coverage

**Verdict: Strong — all four primary misconceptions in applied trig word problems are targeted explicitly.**

| Misconception | Round | Step where caught | Spec reference |
|--------------|-------|------------------|---------------|
| Ladder is vertical (confused with wall/pole), not the hypotenuse | 1 | Step 1 feedback | explanationOnWrongDiagram R1 |
| "Horizontal distance" is the hypotenuse rather than the adjacent | 2 | Step 1 feedback | explanationOnWrongDiagram R2 |
| Using sin or cos when hypotenuse is not given (tan-only situation) | 3 | Step 2 feedback | explanationOnWrongRatio R3 |
| Multiply instead of divide when hypotenuse is the unknown | 4 | Step 3 feedback | explanationOnWrongAnswer R4 |

The two misconceptions identified in the task as highest-frequency are both covered:

- **(a) Wrong side identification (confusing opposite/adjacent relative to the angle):** Covered in step 1 feedback for all 4 rounds. Round 1 is particularly strong — the ladder-as-vertical-side misconception is the most common spatial error.
- **(b) Wrong ratio selection (sin vs cos confusion when angle is unlabeled):** Covered in step 2 feedback. Round 3 adds a stronger constraint: it explicitly states that sin and cos *cannot* be used (hypotenuse not given), forcing the learner to reason about which sides are available rather than just picking a ratio name.

**One gap:** No round targets the "angle of depression vs. angle of elevation" confusion (learners who invert the triangle when the problem says "looks down"). This is a NCERT Class 10 Ch 9 §9.1 staple. With only 4 rounds it is reasonable to defer, but it should be noted for a future 8-round variant or a companion game.

---

## 3. Production vs Recognition

**Verdict: Strong — step 3 requires typed numeric production; steps 1-2 are MCQ recognition but structurally constrained.**

Steps 1 and 2 are MCQ (3 options each). This is recognition, not production. However:

1. Step 1's MCQ is constrained by the SVG diagram context: the learner must interpret which physical object plays which geometric role. It is not "pick the word you vaguely remember" — it requires reading the scenario and diagram together.
2. Step 3 requires typed numeric input with ±0.15 tolerance. A learner cannot guess a specific decimal value — they must compute. Round 4 (cable = pole/sin(30°) = 10) requires formula rearrangement; getting 10 from a 5 m pole and 30° angle without understanding the rearrangement is not possible by guessing.

**Assessment:** The production demand is concentrated at step 3, where it matters most. The step-1 and step-2 MCQ gates are appropriately lightweight (no lives, instructional feedback) — they serve as forced checkpoints, not independent assessments. The overall design correctly prioritizes typed production at the highest-stakes step.

**Comparison to find-triangle-side:** That game also uses MCQ for ratio selection and typed input for computation. The new cognitive demand here is step 1, which is a forced analysis step not present in find-triangle-side. This correctly extends the difficulty.

---

## 4. CDN Compliance Notes

**Verdict: Fully compliant — no banned patterns.**

| Check | Status |
|-------|--------|
| FeedbackManager.init() | NOT called — explicitly banned in spec header |
| window.gameState set at module scope | Required — spec header mandates this |
| window.endGame/restartGame/nextRound | Required — spec header mandates this |
| ScreenLayout.inject() | Not used — inline CSS layout only |
| TimerComponent | NOT included — correct (time pressure contradicts L4 goal) |
| StoriesComponent | NOT included — correct (word problems rendered inline, not as sequential cards) |
| FeedbackManager.sound / playDynamicFeedback | No explicit inclusion listed — this may be an omission |
| SVG inline | YES — same pattern as find-triangle-side (build #549) |
| Drag-and-drop on SVG | NOT used — MCQ button rows used instead (correct, CDN cannot hit-test SVG paths) |
| New CDN parts | None required — all interaction achievable with existing parts |
| isProcessing guard | Required — spec mandates it in all three handlers |
| parseFloat not parseInt | Required — anti-pattern #9 in spec |

**One minor gap:** The spec states the game uses "FeedbackManager.sound" and "FeedbackManager.playDynamicFeedback" directly (without init) in the spec header, but the Parts Selected table shows PART-017 as NO. The spec does not include these calls in the game flow description or anti-patterns section. This creates ambiguity: does the generated HTML use FeedbackManager.sound/playDynamicFeedback, or not? The find-triangle-side and soh-cah-toa-worked-example approved games should be referenced to determine which is standard. If sound calls are omitted entirely, the spec header note is misleading. **Recommendation:** Clarify in the anti-patterns section whether FeedbackManager.sound is called on step-3 correct answers or entirely omitted.

**CDN calculator reference panel:** The spec notes that if real-world-problem is built before compute-it (game 5), a collapsible reference panel with standard trig values should be included. This is the correct decision — without compute-it, the learner has no established resource for sin(30°), cos(60°), etc. When queuing, confirm whether compute-it has been approved first.

---

## 5. Test Hook Clarity

**Verdict: Strong — the spec explicitly defines a `cognitive-demand` test category that is absent from all earlier games in the session.**

Key test hooks defined:

| Hook | Location | Purpose |
|------|----------|---------|
| `data-phase` | Standard (window.gameState synced) | Phase transitions |
| `data-lives` | Standard | Life deduction verification |
| `data-score` | Standard | Score tracking |
| `#step1-panel`, `#step2-panel`, `#step3-panel` | Section 8 | Panel visibility enforcement |
| `#diagram-feedback`, `#ratio-feedback`, `#answer-feedback` | Section 8 | Feedback panel testing |
| `[data-side]` attribute on side buttons | Implied by game flow | Side selection |
| `[data-ratio]` attribute on ratio buttons | Implied by game flow | Ratio selection |
| `#answer-input` | Section 5 layout | Typed input |
| `#btn-submit` | Section 5 layout | Submit button |
| `#triangle-diagram` | Section 5, anti-pattern #12 | SVG context label assertion |

The `cognitive-demand` test category (Section 8) is a genuine advance over the other games in the session. It explicitly mandates:

- `#step2-panel` must not be visible before step 1 is complete
- `#step3-panel` must not be visible before step 2 is complete
- `#answer-input` must not be visible at step 1
- SVG text must include at least one context noun (not only generic "opposite/adjacent/hypotenuse")

The fourth assertion is particularly strong: it verifies the L4 Analyze structural requirement that the diagram uses real-world nouns, not geometric labels. This is the anti-cheat test — if SVG labels were generic, step 1 would be trivial.

**One gap:** The spec does not define `data-testid` attributes explicitly. The selectors used are element IDs (`#step1-panel`, `#answer-input`) which are specified in the play area layout section. This is sufficient for a well-specified game; the test generator can use IDs as selectors.

**One gap:** The step-1 buttons have `data-side` attribute mentioned in game flow but not in the test scenarios section. The test scenarios use "click button whose text equals X" rather than `[data-side='hypotenuse']`. Attribute-based selectors are more robust than text-content matching (which breaks if the label text changes). This is a minor weakness in test specification robustness.

---

## 6. Recommended Changes

Listed in priority order:

### Priority 1 (required before queuing):
1. **Clarify FeedbackManager.sound usage:** Remove the ambiguous spec header note or explicitly add `FeedbackManager.sound` calls to the game flow description (Section 6). The header says the game uses it; the parts table and game flow do not mention it. This ambiguity will cause the LLM to make an arbitrary choice during generation.
   **STATUS: APPLIED 2026-03-23** — Spec header rewritten to ban `FeedbackManager.sound` and `playDynamicFeedback` explicitly. Anti-pattern #13 added to Section 7.

2. **Confirm compute-it prerequisite status:** If compute-it is not approved at queue time, the spec's CDN compliance note mandates a trig values reference panel. Decide now and add it to the spec as a conditional (not runtime-conditional — the spec needs to resolve this before generation).
   **STATUS: APPLIED 2026-03-23** — Conditional resolved: compute-it is not yet approved (status: planned), so the reference panel is now an unconditional requirement in Section 11.

3. **Add `data-side` attribute to step-1 button test selectors:** In Section 8 test scenarios, replace "click button whose text equals 'hypotenuse'" with `[data-side='hypotenuse']`. This makes tests robust to label copy changes.

### Priority 2 (quality improvements, not blockers):
4. **Add angle-of-depression scenario to rationale:** Note that the 4-round limit was a deliberate choice and angle-of-depression is deferred. This prevents a reviewer from flagging it as an oversight.

5. **Specify step-1 retry-before-continue behavior:** Decide explicitly whether the learner gets one free try before "Continue" appears, or "Continue" appears immediately after the wrong answer. The current spec says "Continue" appears after wrong step-1, but does not say whether the side buttons re-enable for retry first. Anti-pattern #11 says the learner "must either answer correctly or explicitly click Continue" — implying no retry. This should be stated explicitly to prevent the LLM from implementing a retry loop.

6. **Add `data-step` attribute to step panels:** A `data-step="1"`, `data-step="2"`, `data-step="3"` on the currently visible panel would make test selectors cleaner for the cognitive-demand category.

---

## Summary

The real-world-problem spec is **ready to queue**. Both Priority 1 items have been resolved (2026-03-23): FeedbackManager.sound ambiguity removed + compute-it prerequisite conditionality resolved to unconditional reference panel. The Bloom level is correctly enforced by structure, not just by label. Misconception coverage is strong for the 4-round constraint. The cognitive-demand test category is the best-specified test section in the entire trig session. CDN compliance is clean.

**Estimated build risk:** Low. The interaction pattern (multi-step MCQ + typed input + SVG) is a direct extension of find-triangle-side (#549), which is an approved build. The only novel element is the three-step decomposition with instructional-only feedback on steps 1-2, which is simpler than the faded-example mechanics of soh-cah-toa-worked-example (#544).
