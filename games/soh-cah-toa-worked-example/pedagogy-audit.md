# soh-cah-toa-worked-example — Pedagogical Quality Audit

**Build approved:** #544
**Audit date:** 2026-03-23
**Auditor:** Education Implementation Slot
**Scope:** Learning quality only — visual/UI quality is covered in ui-ux.md

---

## 1. Does the game require the learner to *do* the cognitive operation or just watch?

**Verdict: Partially — the Example sub-phase is passive; the Faded and Practice sub-phases require active cognitive work.**

### Example sub-phase (L1–L2 passive)

The learner clicks "Next Step" to reveal each solution step sequentially, then clicks "Got It / Move On". No answer is required. This is passive observation. The learner can click through without reading.

**Is this a problem?** No — by design. The worked example effect (Sweller & Cooper, 1985) is the justification, and it is explicitly cited in the spec. Full worked examples deliberately reduce cognitive load at the initial exposure stage. The "passive" reading is intentional; it should not be confused with low quality. The pedagogical claim is that studying worked examples before practice reduces errors in practice. The spec implements this correctly.

**Concern:** The step-by-step reveal (click "Next" to advance) is both a feature and a risk. It forces attention sequencing — you cannot skip to the answer without clicking through all steps. However, a learner who simply clicks rapidly will see all steps but not process them. The game cannot enforce comprehension during the example phase. This is an inherent limitation of worked examples in self-paced digital games, not a spec defect.

### Faded sub-phase (L2 Understand — active, low-stakes)

The learner sees a partially worked problem with one step blanked out and picks the correct MCQ answer. This is the cognitive operation of recognising which formula applies to the given configuration. No lives are deducted on error — a wrong answer reveals the correct choice and allows retry.

**Assessment:** This is genuine L2 cognitive work. The learner must hold the example in memory, apply the SOH-CAH-TOA pattern to a slightly different problem (different numbers, same ratio type), and select the formula expression (e.g., "sin(60°) = QR / 8" not just "sin"). The MCQ options are formula expressions, not just ratio names — this prevents a learner from answering by word association alone ("I remember sin goes with opposite/hypotenuse").

**Strength:** The faded question uses different numbers than the example (e.g., R1 example: sin(30°)×10=5; faded: sin(60°)×8=6.93). Same ratio type, different angle value. This correctly tests transfer, not just repetition.

### Practice sub-phase (L2–L3 Apply — active, high-stakes)

The learner faces a new problem with no scaffolding, picks the numeric MCQ answer. Lives are deducted. The problems use a third distinct angle/side combination (e.g., R1 practice: sin(45°)×14.14=10). The distractors probe specific misconceptions (e.g., "14.14" which is the hypotenuse, not the answer — tempts learners who skip the sin multiplication).

**Assessment:** This is L3 Apply. The learner must independently recall which ratio applies, look up or recall the angle value, and compute. The MCQ format means the cognitive demand is recognition of the correct numerical answer, not production. A learner who computes correctly selects the right answer; a learner who is confused can narrow to 3 options. However, for trig computation, the 3 options are distinct enough that guessing is low-probability (e.g., "10" vs "14.14" vs "7.07" — all plausible but only one is correct for sin(45°)×14.14).

---

## 2. Do the Playwright tests validate the cognitive demand or just check that the correct button was clicked?

**Verdict: Adequate, with one structural gap.**

### What the tests verify:

The test scenarios (Section 14 of spec) specify:

1. **Full Example → Faded → Practice flow (one scenario per round):** Tests navigate the complete 3-sub-phase sequence for each of the 3 rounds. Assertions check panel visibility at each sub-phase transition (e.g., `#example-panel is visible, #faded-panel is hidden` at start of round), phase badge text, ratio label text, and correct button selection.

2. **Wrong faded answer (no life lost):** Asserts `gameState.lives == 3` after a wrong faded answer, verifies the wrong button gets `selected-wrong` class, checks that non-selected buttons re-enable after 2000ms.

3. **Wrong practice answer (life lost):** Asserts `gameState.lives == 2`, `gameState.wrongInPractice == 1`, progress bar update.

4. **Game over when lives reach 0:** Sets `gameState.lives = 1` artificially, clicks wrong, asserts game-over state.

5. **Phase indicator updates:** Asserts `#phase-badge` text changes from "Step 1 of 3" to "Step 2 of 3" to "Step 3 of 3" as sub-phases advance.

### What the tests do NOT verify:

**Gap 1 — Sub-phase isolation is not tested structurally.** The tests check that panels are visible/hidden at key moments, but there is no explicit test that `#practice-panel` is inaccessible (hidden/disabled) while the game is in the Example sub-phase, or that `#faded-panel` cannot be clicked while in the Practice sub-phase. If the game has a CSS bug that makes multiple panels visible simultaneously, the current tests would not catch it as a failure (the test only asserts the *target* panel is visible, not that the *other* panels are hidden).

**Impact:** Low risk in practice — the spec's anti-pattern section clearly prohibits multiple panels visible simultaneously, and the generated HTML is likely to implement panel switching correctly. But a test that explicitly asserts `#practice-panel has class hidden` at the start of Round 1 Example sub-phase would be more robust.

**Gap 2 — The worked example step reveal is not tested for cognitive sequencing.** The test clicks `#btn-example-next` three times to reveal all steps. There is no assertion that the steps are revealed one at a time (step 2 is hidden until step 1 is shown, etc.). This is a minor gap — the spec mandates step-by-step reveal, but the tests only verify the end state (all steps shown, done button visible).

**Gap 3 — The practice MCQ cognitive demand is not directly validated.** The tests click the correct answer and assert `selected-correct`. They do not assert that the practice MCQ options were generated correctly from the content (i.e., that the option whose text is "10" is actually the correct value for sin(45°)×14.14, not a hardcoded label). This is partially mitigated by testing `gameState.score == 1` after the correct click — if the score increments, the validation logic ran correctly.

**Overall test quality:** The test plan validates the game flow, life mechanics, and panel transitions correctly. The cognitive demand validation is implicit (if all panels transition correctly and scores increment, the three-sub-phase sequence ran). An explicit "sub-phase isolation" test would strengthen it.

---

## 3. Difficulty progression and scaffolding toward compute-it

**Verdict: Strong scaffolding. The worked example → faded → practice gradient is well-implemented.**

### Within-round progression

Each round follows: study example → fill one gap → practice independently. The difficulty gradient within a round is:

1. **Example:** Learner sees the full 4-step solution. Zero cognitive demand — pure observation.
2. **Faded:** Learner fills step 2 (the formula setup step — the conceptual step, not the arithmetic). This is the most important gap: if a learner can choose the correct formula expression, they understand *why* that ratio applies, not just the answer.
3. **Practice:** New problem, no scaffolding. Learner must independently select the correct numeric answer.

**Assessment:** The faded step correctly targets the formula-recognition step (not the arithmetic step). If the faded blank had been at step 4 (arithmetic), a learner could fill it correctly by calculator without understanding the ratio. By blanking step 2 (the formula), the game tests conceptual understanding.

### Across-round progression

Round 1 (sin, 30°/60°/45°), Round 2 (cos, 60°/30°/45°), Round 3 (tan, 45°/60°/30°). Each round covers a different ratio. The angles used vary across rounds but stay within standard values (0°, 30°, 45°, 60°, 90°).

**Assessment:** The progression is ratio-by-ratio, not difficulty-by-difficulty. Round 3 (tan) is not harder than Round 1 (sin) — they have the same structure. This is appropriate for a "understand each ratio" game — the goal is breadth of pattern recognition, not depth of difficulty escalation.

### Scaffolding toward compute-it (Game 5)

compute-it requires the learner to compute trig values (e.g., sin(30°) = 0.5, cos(45°) = 0.707) and apply them to formula manipulation. soh-cah-toa-worked-example prepares the learner by:

1. Demonstrating the standard angle values in worked examples (sin(30°)=0.5, sin(60°)=0.866, etc.) — repeated exposure across 3 examples per ratio.
2. Requiring the learner to select the correct formula expression in the faded phase (linking angle value to formula application).
3. Requiring the learner to select the correct numeric result in the practice phase (testing recall of the trig value × side computation).

**Assessment:** The scaffolding toward compute-it is appropriate. A learner who scores 3 stars in soh-cah-toa-worked-example has correctly identified all 3 ratio formulas and computed 3 standard-angle multiplications. compute-it then deepens this to formula rearrangement and less obvious angle combinations.

**One gap in the chain:** soh-cah-toa-worked-example always presents problems where the unknown is the opposite or adjacent (never the hypotenuse as unknown). find-triangle-side (Game 3) and real-world-problem (Game 6) include cases where the hypotenuse is unknown, requiring formula rearrangement (divide instead of multiply). compute-it (Game 5) should bridge this. The soh-cah-toa-worked-example spec does not include rearrangement cases, which is the correct decision at the L2 stage — rearrangement is L3 Apply, not L2 Understand.

---

## 4. Misconceptions the game inadvertently reinforces

**Verdict: One identified — partially mitigated by the spec, but warrants monitoring.**

### Reinforced misconception: "The formula is always sin(θ) = unknown / hypotenuse" (wrong direction)

In every worked example and faded problem in the game, the unknown side is computed by:
`unknown = sin(θ) × hypotenuse` (rounds 1-2), or `unknown = cos(θ) × hypotenuse`, `unknown = tan(θ) × adjacent`

The formula is always arranged as `sin(θ) = Opposite / Hypotenuse` → rearranged to `Opposite = sin(θ) × Hypotenuse`. The hypotenuse or adjacent is always the *given* side; the opposite or adjacent is always the *unknown*. The practice MCQ confirms a numeric answer for the unknown.

**Risk:** A learner who completes soh-cah-toa-worked-example with 3 stars may internalize a specific formula direction: "I multiply the given side by the trig value to get the unknown." When they encounter compute-it round 3 (rearranged formula: hypotenuse is unknown → divide), this internalized rule will produce errors. The explanation in real-world-problem round 4 explicitly addresses this ("When the hypotenuse is unknown, DIVIDE") — but soh-cah-toa-worked-example itself never presents a case where the division direction is needed.

**Assessment:** This is not a spec defect — it is a deliberate pedagogical sequence. soh-cah-toa-worked-example correctly teaches the base case (direct application) before introducing rearrangement. compute-it and real-world-problem are the games that teach rearrangement. The potential for misconception reinforcement is real but managed by the session sequence. If a learner plays soh-cah-toa-worked-example *without* completing compute-it and real-world-problem afterward, they may leave the session believing multiplication is always correct.

**Mitigation recommendation:** In the practice phase of soh-cah-toa-worked-example, ensure that at least one distractor represents the "rearranged division" error (e.g., for "sin(45°) × 14.14 = 10", include a distractor of "14.14 / sin(45°) = 20" so that the division-direction error is explicitly rejected). Checking the fallback content: Round 1 practice distractors are "14.14" (the hypotenuse) and "7.07" (sin(45°)/2). Neither is the rearrangement-error value. This is a gap — adding a rearrangement-error distractor would proactively address the misconception.

### No reinforcement of other misconceptions

- Opposite/adjacent identity confusion: Well handled — the spec explicitly targets this in each round's `misconceptionTargeted` field and the worked examples consistently label sides correctly.
- SOH-CAH-TOA as mnemonic vs. ratio definition: The worked examples show the derivation (ratio = side/side), not just the mnemonic. This is strong.
- Degrees vs. radians: Not addressed in this game (standard in compute-it), but the game does not use radian values, so no confusion is introduced.

---

## Pedagogical Quality Verdict

**ADEQUATE** — The game correctly implements the worked example effect and delivers genuine L2 Understand cognitive demand in the Faded and Practice sub-phases. The scaffolding toward compute-it is appropriate. Test coverage validates the game flow and life mechanics but has a minor gap in sub-phase isolation testing. One misconception (rearrangement direction) is not directly countered by the distractors, though this is managed by the session sequence.

**Specific improvements for a future revision:**

1. Add a rearrangement-error distractor to at least one practice question (e.g., Round 3 practice: include "17.32" which = tan(60°) × 10 when the learner should use tan(30°) × 10 — this is the complementary-angle error, more relevant than a division error at this stage).
2. Add an explicit test assertion: `#practice-panel has class hidden AND #faded-panel has class hidden` at the start of each round's example phase. This verifies sub-phase isolation structurally.
3. The Phase indicator badge text ("Step 1 of 3: Worked Example" / "Step 2 of 3: Fill the Gap" / "Step 3 of 3: Your Turn") is a strong UI choice that reinforces metacognitive awareness — the learner knows where they are in the learning progression. This should be preserved and highlighted in the UI/UX audit as a pattern to replicate.

**No changes required before declaring the game production-ready.** The identified improvements are enhancements, not correctness issues. Build #544 stands as approved.

---

## Handoffs

- **R&D slot:** The rearrangement-direction distractor gap (point 1 above) should inform the `compute-it` spec when it is written — ensure compute-it explicitly includes distractors that target the "multiply when you should divide" error.
- **Test Quality slot:** Add sub-phase isolation test assertions to the worked-example-mcq pattern template in test-gen prompts. Any future game using this pattern (e.g., `quadratic-formula` if Session 2 includes quadratics) should inherit this assertion.
- **UI/UX slot:** The phase badge colour-coding (blue for example, green for faded, yellow for practice) is a proven pattern — note it in the UI/UX audit as a design pattern to apply to any future multi-sub-phase game.
