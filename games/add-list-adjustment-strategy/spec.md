# Game Design: Add List with Adjustment Strategy — The Compensation Workout

## Identity
- **Game ID:** add-list-adjustment-strategy
- **Title:** Add List with Adjustment Strategy — The Compensation Workout
- **Class/Grade:** Class 4–5 (Grade 4–5, ages ~9–11)
- **Math Domain:** Number Operations — Mental Arithmetic / Addition Strategies
- **Topic:** Two-digit + two-digit addition using the **compensation strategy** (add to one addend, subtract the same amount from the other; sum stays invariant). Students learn to nudge awkward pairs like `58 + 72` toward a friendly multiple-of-10 pair like `60 + 70` and then add mentally.
- **Bloom Level:** L3 Apply — student must *apply* the compensation transformation (a procedure with a conserved invariant) to compute a sum mentally. Not L1/L2 because the goal is procedural fluency on a strategy, not just understanding what addition is.
- **Archetype:** #3 Lives Challenge — fixed 9 rounds across 3 stages, 3 lives, wrong submit retries the same round and costs a heart, mixed input pattern (tap +/- buttons to manipulate scratchpad state + numeric input + Submit CTA). Number-input variant (PART-050 FloatingButton in `submit` mode required for the "Next Round" CTA).
- **NCERT Reference:**
  - Class 4 — *Long and Short* (number sense), *The Way the World Looks* (mental arithmetic patterns).
  - Class 5 — *Be My Multiple, I'll be Your Factor* (multiples of 10, friendly numbers), *Parts and Wholes* (decomposition / recomposition strategies).
  - Compensation is one of the canonical mental-arithmetic strategies named in NCERT teacher manuals for Classes 4–5; this game targets the fluency gap NCERT exposition does not drill explicitly.
- **Pattern:** P2 (Numeric typing) for the answer commit, plus a custom +/- nudge scaffold for the addends. NOT P1 (MCQ), NOT P6 (DnD), NOT P8 (click-to-toggle). The +/- buttons mutate display-only scratchpad state (the live `addend1` / `addend2` numbers shown in the boxes); the only graded affordance is the numeric input + Submit. Step 4 (Build) runs as `[SUB-AGENT]` — no CDN library beyond the standard CDN core, no main-context override needed.
- **Input:** Tap on one of the four +/- buttons (two per addend box) to nudge the corresponding addend by ±1; tap on the Reset pill to return both addends to their starting values; numeric typing into a free-text input (`<input type="text" inputmode="numeric" pattern="[0-9]*">`) for the final sum; Submit via PART-050 FloatingButton (`submit` mode, labelled "Next Round"). Enter key on the input also submits.

## One-Line Concept
The student nudges two awkward two-digit addends (like `58 + 72`) toward a friendlier multiple-of-10 pair using +/- buttons — discovering, round after round, that what you add to one number you can subtract from the other and the sum never changes — then types the sum and taps Next Round.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Compensation strategy fluency | Apply "add to one, subtract from the other" to transform an awkward addition into a friendly one without changing the sum. | adjust-and-add |
| Benchmark-number sense | Recognise the nearest multiple of 10 for any two-digit number (e.g. 58 → 60, 72 → 70, 66 → 60 or 70 depending on partner). | adjust-and-add |
| Conservation of sum | Internalise that nudging the two addends in opposite, equal amounts leaves the sum invariant — the deepest lesson the game teaches by having the student observe it across 9 rounds. | adjust-and-add |
| Two-digit + two-digit mental addition | Compute friendly-pair sums (60+70, 70+70, 60+60, 130, 140, 120) without paper or fingers. | adjust-and-add |
| Self-correction via reset | Use the Reset button as a free experimentation tool — abandon a path that's not getting friendlier, start again. | adjust-and-add |

## Core Mechanic

### Type A: "Adjust and Add"

1. **What the student sees**
   - A clean **workspace** centred on the play area:
     - Two **addend boxes** side by side, separated by a large bold black `+` sign. Each box shows a two-digit number (the live addend value, e.g. `58` and `72`).
     - **Above each box:** a small pink `−` button (~44×44 px touch target).
     - **Below each box:** a small green `+` button (~44×44 px touch target).
     - The pair of buttons attached to box 1 nudge `addend1` by ±1; the pair attached to box 2 nudge `addend2` by ±1. Each tap is a single ±1 step.
   - To the **right of the workspace** (or on a row below it on narrow viewports): a `↺ Reset` pill (~120×44 px secondary button).
   - **Below the workspace:** a free-text **numeric input field** with a `?` placeholder, sized for a 3-digit answer.
   - The **PART-050 FloatingButton** labelled `Next Round` (`submit` mode). Disabled until the input has at least one digit.
   - **Status header:** round counter `Round N / 9`, **3 hearts** (lives — PART-023 standard red hearts), and progress bar (9 segments).
   - **Stage 2 visual differentiator:** the two addend boxes get a soft blue border (`--mathai-color-info` or equivalent) instead of the default grey, signalling visually (without text) that the difficulty has stepped up.
   - **Stage 3 visual differentiator:** the boxes return to default grey but use a subtly bolder font weight on the addend digits — telling the student "this is the stretch zone" without being verbose.
   - **No timer** (creator: "Speed isn't graded").
   - **No hints button** (creator: "no scoring of how clever the path is").

2. **What the student does** (input pattern: button-nudge + numeric type + submit tap)
   - **Tap a `+` or `−` button** to nudge the corresponding addend by ±1. The displayed number updates instantly with a soft tick SFX (fire-and-forget, no sticker). NO life is lost on these taps. NO grading occurs on these taps. The +/- taps are unbounded — students can tap them as many times as they want.
   - **Tap the Reset pill** to restore both addends to their starting values for this round (the values that were displayed when the round began). The input field is NOT cleared by Reset — only the two addend boxes are reset. Reset costs no life and triggers no grading.
   - **Tap the numeric input field** to focus it; the system numeric keypad appears. Type a whole number (digits only; non-numeric keys ignored by `inputmode="numeric"`).
   - **Tap "Next Round"** (or press Enter on the input) to **commit the answer**. This is the only graded action.

3. **What counts as correct**
   - The typed value (after stripping whitespace and leading zeros) equals the round's `correct` integer EXACTLY. The `correct` value is the **sum of the original starting values** of the two addends — NOT the sum of whatever the student has nudged the boxes to. (The whole pedagogical point: the student can adjust the boxes to `60 + 70` to compute mentally, but the answer they type is `130`, which is also `58 + 72` — the same sum. The +/- buttons change *how* the student computes; they don't change *what* the correct sum is.)
   - The current displayed values of `addend1` / `addend2` are NOT used for grading — they are scratchpad state. Even if the student leaves the boxes at `60 + 70` after nudging from `58 + 72`, the correct answer is still `130`.
   - An empty input is rejected at the Submit stage (Submit stays disabled until at least one digit is entered).

4. **What feedback plays**
   - **Correct:** Input pill turns green, the addend boxes reveal the canonical compensation form (the boxes animate to show the friendly pair the student was nudging toward, e.g. `60 + 70`, with a green tick badge between them). `gameState.isProcessing = true` BEFORE await. ProgressBar bumps FIRST in the round-complete handler (`progressBar.update(currentRound, lives)` before audio). Awaited `correct_sound_effect` SFX (~1.5 s floor) with celebration sticker → awaited dynamic TTS naming the strategy applied to THIS round (e.g. *"Nice! 58 plus 72 is the same as 60 plus 70, which is 130."*) with subtitle. Lives unchanged. Auto-advance to next round (or Victory after Round 9).
   - **Wrong (lives remain) — RETRY-SAME-ROUND path:** Input pill flashes red and shakes (~600 ms shake animation). The two addend boxes **reset to their starting values** (visual cue that the scratchpad is being cleared so the student can try again). The input clears. One heart dims (`progressBar.update(currentRound, lives - 1)`). `gameState.isProcessing = true` BEFORE await. Awaited `incorrect_sound_effect` SFX (~1.5 s floor) with sad sticker → awaited dynamic TTS announcing the correct sum (e.g. *"Not quite — the sum of 58 and 72 is 130."*) with subtitle. After audio finishes, the SAME round is re-presented (currentRound NOT incremented). Submit re-enables. The student tries again on the same pair.
   - **Wrong (last life) — GAME-OVER path:** Same red flash + shake + addend reset + input clear, awaited wrong SFX (1.5 s floor) + awaited TTS announcing the correct sum (Case 8 — wrong feedback MUST play before game-over). THEN Game Over TransitionScreen renders with `game_complete` posted before game-over audio.
   - **+/- nudge tap:** Soft tick SFX (~50 ms, fire-and-forget, no sticker, no TTS, no input block). Per CASE 9 (tile select). Pure ambient.
   - **Reset tap:** Soft confirm SFX (fire-and-forget). Both addend boxes animate back to starting values (no audio block). No TTS. The input is NOT cleared by Reset.

## Rounds & Progression

Three stages of three rounds each, with a graduating compensation challenge across stages. **All 9 rounds use the same Type A "adjust-and-add" mechanic; only the addend pairs (and the visual surface for stages 2 / 3) differ.** No per-stage transition screen — the stage break is felt visually (border colour / font weight) rather than narrated, in keeping with the creator's "the reveal happens on the student" principle.

### Stage 1 — Easy benchmarks (Rounds 1–3)
- Round type: adjust-and-add.
- **Visual surface:** default grey borders on the addend boxes.
- **Difficulty parameters:**
  - Both addends are within **±4** of a multiple of 10 (e.g. `58, 72, 61, 69, 47, 73`).
  - Each addend's nearest benchmark is unambiguous (no ambiguity between e.g. 60 and 70).
  - Sums are friendly two-digit additions of multiples of 10 in the range `120–140` (e.g. `60+70 = 130`, `60+60 = 120`, `50+80 = 130`).
- **Compensation work required:** 1–4 +/- taps on each addend to reach the friendly pair. Most students can also just compute the sum directly without nudging, but the nudge path is faster and reinforces the strategy.
- **Expected first-attempt solve rate:** ~85%.

### Stage 2 — Tighter adjustments (Rounds 4–6)
- Round type: adjust-and-add.
- **Visual surface:** soft blue border (`--mathai-color-info` family) on the addend boxes — the visible signal that difficulty has stepped up. No text, no narration.
- **Difficulty parameters:**
  - Both addends are within **±2 to ±4** of a multiple of 10 (e.g. `62 + 68`, `47 + 73`, `33 + 87`).
  - The friendly pair is reachable but requires the student to think about *which* benchmark each addend is closest to (e.g. `62 → 60`, `68 → 70` — the *direction* of nudge differs between the two addends, which is exactly the compensation insight).
  - Sums in `120–140` again so the mental-add stays light; the difficulty is in deciding the nudges, not the sum.
- **Compensation work required:** 2–4 +/- taps total, with a clear "this addend up, that addend down" pattern.
- **Expected first-attempt solve rate:** ~70%.

### Stage 3 — Wider gaps (Rounds 7–9)
- Round type: adjust-and-add.
- **Visual surface:** default grey borders return; addend digits use a slightly bolder font weight (visible cue that this is the mastery zone).
- **Difficulty parameters:**
  - Each addend is within **±3 to ±5** of a benchmark (e.g. `66 + 74`, `64 + 76`, `43 + 78`).
  - Often the friendly target is a "twin" pair like `70 + 70 = 140` rather than two distinct multiples — forcing the student to commit to a target pair and adjust both sides by larger amounts.
  - Sums in `120–150` (e.g. `66+74 = 140`, `64+76 = 140`, `43+78 = 121`).
- **Compensation work required:** 3–5 +/- taps per addend (6–10 taps total). Direct mental computation is genuinely hard at this range — compensation is now the path of least resistance.
- **Expected first-attempt solve rate:** ~55%.

| Dimension | Stage 1 (R1-3) | Stage 2 (R4-6) | Stage 3 (R7-9) |
|-----------|----------------|----------------|----------------|
| Distance from benchmark | ±1 to ±4 | ±2 to ±4 (tighter, mixed) | ±3 to ±5 (wider) |
| Visual surface | Default grey | Soft blue border | Bolder digit weight |
| Friendly pair shape | Two distinct multiples (e.g. 60+70) | Two distinct multiples, opposite-direction nudges | Often "twin" pair (e.g. 70+70) |
| Sum range | 120–140 | 120–140 | 120–150 |
| Compensation taps required | 1–4 each | 2–4 total | 3–5 each (6–10 total) |
| Expected first-solve | ~85% | ~70% | ~55% |
| Cognitive demand | First exposure; benchmark recognition | Pick which benchmark; opposite-direction nudge | Commit to twin target; larger adjustments |

**Round-set cycling (MANDATORY — validator: GEN-ROUNDSETS-MIN-3):** the runtime cycles `fallbackContent.rounds` across three sets (A → B → C → A). Each set has 9 rounds (3 per stage). `rounds.length === 27 === totalRounds (9) × 3 sets`. Within each set, Stage-1 / Stage-2 / Stage-3 round-N is parallel in difficulty across sets (Set A's R1 ≈ Set B's R1 ≈ Set C's R1 in distance-from-benchmark and sum range). Each round object carries `set: 'A' | 'B' | 'C'`. `setIndex` rotates on Try Again / Play Again and persists across restarts within the session.

## Game Parameters
- **Rounds:** 9 per session (3 per stage × 3 stages).
- **totalRounds:** 9.
- **Timer:** None (`timer: false`). Creator explicitly states "Speed isn't graded. The point of this game is *thinking carefully*." PART-006 NOT included.
- **Lives:** 3 (rendered as PART-023 standard red hearts in the header).
- **totalLives:** 3.
- **retryPreservesInput:** N/A (multi-round game; flag ignored). Creator-described retry flow is "boxes reset to starting values, input clears, retry same round" — implemented in the wrong-with-lives feedback path. The retry stays on the SAME round and decrements lives by 1.
- **autoShowStar:** `true` (default end-of-game beat handled by PART-050 / Stars Collected onMounted).
- **Star rating (creator-specified — first-try-correct count drives stars):**
  - **3 stars** — All 9 rounds completed first-try correct (3 lives intact at the end). NO wrong submits.
  - **2 stars** — At least 7 of 9 rounds first-try correct (so 1 or 2 lives lost during the session, but the student still finished all 9 rounds).
  - **1 star** — Finished all 9 rounds with at least 1 life remaining, but with more wrong attempts than 2★ allows (i.e. 5 or 6 first-try-correct, the rest needed retries — possible because the retry path doesn't end the round).
  - **0 stars** — Game over (3 wrong attempts before completing Round 9 → lives reach 0 mid-session).

  **Star formula (implementation note):**
  ```js
  function getStars() {
    if (gameState.lives <= 0) return 0;            // game-over branch
    if (gameState.firstTryCorrect >= 9) return 3;  // perfect run
    if (gameState.firstTryCorrect >= 7) return 2;  // 7–8 first-try
    return 1;                                       // finished with 5–6 first-try (or fewer)
  }
  ```
  Implementation requires `gameState.firstTryCorrect` to be incremented ONLY when a round is solved on the first submit attempt within that round (i.e. `attemptsOnThisRound === 0` when Submit fires AND the answer is correct). It is NOT incremented for correct-on-retry. This is captured per round via `gameState.attempts[].isFirstTry`.
- **Input:**
  - **+/- nudge buttons (×4):** tap to mutate `addend1` / `addend2` by ±1. Soft tick SFX. NOT graded. NOT life-deducting. Pattern P-custom (button-nudge); not in the standard PART catalog because it's display-state-only.
  - **Reset pill:** tap to restore both addends to their starting values. Soft confirm SFX. NOT graded.
  - **Numeric input:** `<input type="text" inputmode="numeric" pattern="[0-9]*">` per mobile rule #13. `font-size: 16px+` per mobile rule #28 (Safari auto-zoom prevention).
  - **Next Round button:** PART-050 FloatingButton in `submit` mode, labelled "Next Round". Disabled until the input has at least one digit. Enter key on the input also submits.
- **Feedback:** PART-017 FeedbackManager. `playDynamicFeedback({...})` awaited on every submit per single-step contract. Static SFX awaited with 1.5 s floor before TTS.
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships per spec-creation skill rule). The 9-slide carousel at end-of-game shows each round's starting addend pair, the canonical compensation form (the friendly pair the student should have nudged toward), and the correct sum, with a one-line strategy statement. See "AnswerComponent payload shape" below.
- **PARTs Used:** PART-001 (CDN core), PART-004 (init), PART-005 (visibility), PART-007 (state), PART-008 (postMessage), PART-009 (recordAttempt), PART-010 (events), PART-017 (FeedbackManager — sound + TTS), PART-019 (results), PART-021 (mobile layout), PART-023 (ProgressBar with 9 segments + 3 red hearts), PART-024 (TransitionScreen — Welcome, per-round intros, Game Over, Victory, Stars Collected, Try Again / Play Again motivation), PART-025 (ScreenLayout), PART-027 (Play Area), PART-039 (PreviewScreen), PART-042 (signals), PART-050 (FloatingButton — Submit / "Next Round" + end-of-game Next), PART-051 (AnswerComponent — 9-slide answer carousel after Stars Collected). PART-006 (timer) NOT included; PART-033 (drag) NOT included.

## Scoring
- **Points:** +1 per round solved (regardless of first-try vs retry). Max 9 points per session. `gameState.score` = number of rounds where the student eventually submitted the correct sum (i.e. all completed rounds that did not end in lives-zero game over). NOTE: the *star* rubric uses `firstTryCorrect`, not `score` — see Star formula above. Score is for the recordAttempt / data-contract surface; firstTryCorrect drives the visible star tier.
- **Stars:** see "Star rating" above. Tied to `gameState.firstTryCorrect` and `gameState.lives`.
- **Lives:** 3 hearts. Each wrong submit decrements once. Reset taps and +/- nudges do NOT cost lives. At `lives === 0` mid-session, Game Over fires after the awaited wrong-feedback completes (Case 8).
- **Partial credit:** None per round (each submit is binary — correct or wrong). The retry-on-same-round mechanic is the partial-credit substitute: a round can be solved with 1, 2, or 3 attempts (until lives run out across the whole session), and only the *first attempt* counts toward the star tier.

### Star Generosity Audit

(Per spec-creation: L3 Apply games target 70-85% first-attempt success. The 3⭐ bar should require demonstrated mastery of the strategy across all 9 rounds, not survival.)

| Outcome scenario | First-try correct (of 9) | Lives at end | Stars | Generosity verdict |
|------------------|--------------------------|--------------|-------|--------------------|
| All 9 first-try correct | 9 | 3 | **3⭐** | TIGHT — perfect run only. Correct for L3 fluency mastery. |
| 8 first-try, 1 retry-correct | 8 | 2 | **2⭐** | TIGHT — one mistake demotes from 3⭐. |
| 7 first-try, 2 retry-correct | 7 | 1 or 2 | **2⭐** | TIGHT — at the threshold; appropriate. |
| 6 first-try, 3 retry-correct | 6 | ≥1 | **1⭐** | NEUTRAL — student survived but did not show strategy mastery. |
| 5 first-try, 4 retry-correct | 5 | ≥1 | **1⭐** | NEUTRAL. |
| 0 first-try, all retry-correct (3 wrongs total, never reached 0 lives because lives lost per ROUND-with-wrong, not per attempt) | 0 | depends | **1⭐ or 0⭐** | See below — depends on whether the student reached 9 rounds with ≥1 life. |
| 3 wrong submits → lives = 0 at any point | n/a | 0 | **0⭐** | TIGHT — Game Over, 0 stars. Routes through Game Over not Victory. |

**Important nuance for the 1★ floor:** because each wrong submit costs exactly one life (not "all retries on a round cost lives"), a student gets at most 3 wrong submits across the entire 9-round session before lives run out. So a student who reaches Round 9 has by definition lost at most 2 lives, which means they have **at least 7 rounds where their wrong-submit count was 0** — i.e. `firstTryCorrect >= 7`. **There is no path to "finished all 9 rounds with `firstTryCorrect < 7`"**, so the 1★ band of "5–6 first-try" actually represents a state that is *unreachable under standard play* — finishing all 9 rounds implies `firstTryCorrect >= 7`, which earns 2★ minimum.

This means the **practical star bands** are:
- **3⭐:** all 9 rounds first-try (3 lives intact, `firstTryCorrect = 9`).
- **2⭐:** finished all 9 rounds with 1 or 2 lives (so `firstTryCorrect ∈ {7, 8}`).
- **1⭐:** practically unreachable (kept in the rubric as a defensive default; awarded only if some edge-case state allows finishing with `firstTryCorrect < 7` AND `lives > 0` — e.g. a future feature that lets a student skip a round).
- **0⭐:** game over (lives = 0 before completing Round 9).

**Verdict:** The star rule is appropriately tight for L3 Apply mastery. 3⭐ requires perfect first-try execution. 2⭐ is the broad "you finished" band. 0⭐ is reserved for genuine breakdown. The 1★ band is defensively retained per creator spec but is structurally rare.

This is a creator-specified rubric. The implementation must compute `firstTryCorrect` via per-round `isFirstTry` tracking, NOT via score.

## Pedagogy Note

Compensation is one of the highest-leverage mental-arithmetic strategies in Class 4–5 — it shows up again in subtraction (counting up to a friendlier number), in fractions (rewriting `4/5 + 7/10` by adjusting the denominator), and in algebra (moving terms across an equals sign without changing the equation). Most curricula introduce it as a side note and assume it'll stick. This game makes the strategy the *only* viable way to play efficiently — you *can* stare at `66 + 74` and try to compute it directly, but every student quickly realises that nudging to `70 + 70 = 140` is faster and feels better.

The game **does not name the strategy** during gameplay. The reveal is left to the student. The correct-answer TTS *demonstrates* the strategy on the round's specific numbers (e.g. *"Nice! 58 plus 72 is the same as 60 plus 70, which is 130."*) — making the mathematical equivalence explicit *after* the answer is committed, not before. This is the "self-discovery" pedagogical principle from the concept doc, implemented as audio scaffolding rather than upfront instruction.

The Reset button is the **emotional safety mechanism**: students learn that experimentation is free, that wrong paths aren't penalties, and that math is a thing you *play* with. The +/- buttons feel tactile (each tap is a quiet click), and Reset is drawn as a friendly circular-arrow icon, not a red "ABORT".

NCERT alignment: Class 4 / Class 5 mental-arithmetic chapters listed under Identity. The compensation strategy is named in NCERT teacher manuals but rarely drilled to fluency; this game fills that gap.

## Flow

**Shape:** Multi-round (default).

**Changes from default:**
- The wrong-with-lives feedback path **stays on the SAME round** (currentRound NOT incremented) so the student can retry the same pair. This is a creator-specified deviation from the standard "advance to next round on wrong" pattern. Implementation: in the wrong-with-lives branch of the submit handler, after awaited audio, call a `resetRoundForRetry()` helper that re-renders the same round (resets addend display values, clears input, re-enables Submit) instead of calling `nextRound()`. CurrentRound is NOT incremented; lives ARE decremented.

```
┌──────────┐  tap    ┌──────────┐  tap    ┌──────────────┐  auto    ┌──────────────────────────┐
│ Preview  ├────────▶│ Welcome  ├────────▶│ Round N      ├─────────▶│ Game (round N)           │
│ 🔊 prev  │         │ 🔊 welc. │         │ (trans.,     │  (after  │ [box1: A1] + [box2: A2]  │
│   audio  │         │    VO    │         │  no buttons) │   sound) │ +/− nudge buttons         │
└──────────┘         └──────────┘         │ 🔊 "Round N" │          │ ↺ Reset                   │
                                          └──────────────┘          │ [    ?    ] input         │
                                                  ▲                 │ FloatingBtn "Next Round"  │
                                                  │                 └─────────┬─────────────────┘
                                                  │                           │ tap "Next Round" / Enter
                                                  │                           │ (input non-empty)
                                                  │                           ▼
                                                  │              ┌──────────────────────────────┐
                                                  │              │ Submit handler runs           │
                                                  │              │ recordAttempt before audio    │
                                                  │              │ ✓ → green input + reveal      │
                                                  │              │     friendly pair + 🔊 correct│
                                                  │              │     + TTS "A1 + A2 = same as  │
                                                  │              │      B1 + B2 = SUM"           │
                                                  │              │ ✗ → red shake + addends reset │
                                                  │              │     + input clear + 🔊 wrong  │
                                                  │              │     + TTS "Not quite — sum    │
                                                  │              │      of A1 and A2 is SUM"     │
                                                  │              └─────────┬────────────────────┘
                                                  │                        │
                                ┌─────────────────┼────────────────────────┼──────────────────┐
                                │                 │                        │                  │
                          wrong AND lives > 0  correct AND more     correct AND last   wrong AND lives = 0
                                │ (RETRY-SAME-   │ rounds            round won (R9)          │
                                │  ROUND;        │                                            │
                                │ currentRound   ▼                  │                         │
                                │ NOT bumped)   loop to Round       ▼                         ▼
                                │ stay on game  N+1 intro    ┌────────────────────┐   ┌─────────────────────┐
                                │ screen,                    │ Victory (status)   │   │ Game Over (status)  │
                                │ player retypes             │ 0/2/3★             │   │ 🔊 sound_game_over  │
                                ▼                            │ 🔊 sound_game_     │   │ "Try Again"         │
                          (loop back to Game                 │   victory →        │   └─────────┬───────────┘
                           on same round)                    │   vo_victory_      │             │ tap
                                                             │   stars_N          │             ▼
                                                             └──────┬──────┬──────┘   restart from R1
                                                                    │      │           (cycles A→B→C→A)
                                                       "Play Again" │      │ "Claim Stars"
                                                       (only if 0-2★)│      │
                                                                    ▼      ▼
                                                       ┌────────────────┐  ┌─────────────────────┐
                                                       │ "Ready to      │  │ "Yay, stars         │
                                                       │  improve your  │  │  collected!"        │
                                                       │  score?"       │  │ (auto, no buttons)  │
                                                       │ (trans., tap)  │  │ 🔊 stars-collected  │
                                                       │ 🔊 motiv. VO   │  │   + ✨ animation    │
                                                       │ [I'm ready]    │  └──────────┬──────────┘
                                                       └────────┬───────┘             │ auto
                                                                │ tap                  ▼
                                                                ▼              ┌──────────────────────┐
                                                       restart from R1         │ Correct Answers      │
                                                       (cycles A→B→C→A)        │ carousel (PART-051)  │
                                                                               │ 9 slides — 1/round   │
                                                                               │ FloatingBtn 'next'   │
                                                                               └──────────┬───────────┘
                                                                                          │ Next
                                                                                          ▼
                                                                                         exit
```

## Feedback

| Event | Behavior |
|-------|----------|
| Preview | PART-039 PreviewScreen on game start. Instruction text + audio (see Content Structure). Tap [Start] / Got it CTA dismisses. |
| Welcome | TransitionScreen with `Welcome to The Compensation Workout!` + welcome VO. Tap to continue. |
| Round N intro | TransitionScreen "Round N", auto-advance after round-intro SFX + VO (sequential, awaited). CASE 2 Variant A. |
| Round start | Play area paints (two addend boxes + 4 nudge buttons + Reset + numeric input + Next Round FloatingButton). Round prompt TTS plays fire-and-forget (CASE 3) — does NOT block input; student can tap +/- or start typing immediately. The TTS reads the round's starting prompt softly, e.g. *"Add 58 and 72."* |
| +/- nudge tap on addend box | The corresponding addend (`addend1` or `addend2`) updates by ±1 in the box display. Soft tick SFX (~50 ms, fire-and-forget, no sticker, no TTS, no input block). Per CASE 9 (tile select). The scratchpad state is mutated; the input field and the round's `correct` are unchanged. NO life loss. NO recordAttempt fires here. |
| Reset pill tap | Both addend boxes animate back to the round's starting values (300 ms ease). Soft confirm SFX (fire-and-forget, no sticker). The input field is NOT cleared by Reset — only the addend display is. NO life loss. NO recordAttempt fires here. |
| Type into numeric input | No SFX (avoid keyboard chatter). The `oninput` listener strips non-digits for safety, then enables Submit (FloatingButton.setMode('submit')) once `value.length > 0`. |
| Tap "Next Round" / Enter, input non-empty (correct) | `gameState.isProcessing = true` BEFORE await. Input pill turns green. Addend boxes animate to reveal the canonical friendly pair (e.g. `60 + 70` for a starting pair of `58 + 72`) with a green tick badge between them — making the compensation transformation visible. ProgressBar bumps FIRST. `await sound.play('correct_sound_effect', { sticker, minDuration: 1500 })`, then `await playDynamicFeedback({ feedback_type:'correct', audio_content: '<round.successAudio>', subtitle: '<round.successSubtitle>' })`. `gameState.firstTryCorrect++` IF this round had no previous wrong submits. Auto-advance to next round (or Victory after Round 9). CASE 4 (single-step). |
| Tap "Next Round" / Enter, input non-empty (wrong, lives remain) | `gameState.isProcessing = true` BEFORE await. Input pill flashes red and shakes (~600 ms). The two addend boxes reset to their starting values. The input clears. `progressBar.update(currentRound, lives - 1)` fires FIRST. `await sound.play('incorrect_sound_effect', { sticker, minDuration: 1500 })`, then `await playDynamicFeedback({ feedback_type:'incorrect', audio_content: 'Not quite — the sum of <A1> and <A2> is <correct>.', subtitle: 'Sum of <A1> and <A2> is <correct>.' })`. After audio: `gameState.lives--`, the SAME round re-renders (currentRound NOT incremented; `gameState.attemptsOnThisRound++` bumps so a subsequent correct submit on this round will NOT count toward firstTryCorrect). `gameState.isProcessing = false` in the re-render. CASE 7 (single-step) — but with retry-same-round instead of advance. |
| Tap "Next Round" / Enter, input non-empty (wrong, last life) | Same red shake + addends reset + input clear + wrong SFX awaited (1.5 s floor) + TTS awaited. THEN Game Over TransitionScreen renders (`game_complete` posted before game-over audio). CASE 8. |
| Press Enter on input | Same as tapping Next Round (Mobile rule #16 — Enter MUST submit). Behaves identically. |
| Submit while input is empty | The FloatingButton is disabled (`floatingBtn.setMode('submit')` was never called for an empty input). No-op. No SFX, no shake. Defensive: if a key path bypasses the disable (unlikely), the handler short-circuits silently. |
| Round complete (auto-advance to next round) | Round transition screen renders (CASE 2 Variant A — auto-advancing). Sequential audio: round SFX awaited → round VO awaited. Then Game (Round N+1) renders. Addend boxes paint with the new round's starting values; input clears; `attemptsOnThisRound = 0`. |
| Complete all 9 rounds (Victory) | Victory TransitionScreen renders FIRST (stars from `getStars()`). `game_complete` postMessage sent BEFORE end-game audio. Then victory SFX + VO sequential (different per star tier). CTAs: `Play Again` (only if 0-2★), `Claim Stars` (always). CASE 11. |
| Game Over (lives = 0 mid-session) | Wrong-answer SFX + TTS complete first (CASE 8). THEN Game Over TransitionScreen renders with `game_complete` posted before game-over audio. CTA: `Try Again`. |
| Tap "Claim Stars" | Routes to "Yay, stars collected!" transition. `sound_stars_collected` awaited → `show_star` postMessage → setTimeout (~1500 ms) → `showAnswerCarousel()` (PART-051). |
| Tap "Play Again" | Routes through "Ready to improve your score?" motivation transition → `restartGame()` → game restarts from Round 1 (skips Preview + Welcome). Round-set cycles A → B → C → A. Lives reset to 3, `firstTryCorrect = 0`, `attemptsOnThisRound = 0`. ProgressBar reset on the motivation transition's `onMounted`. CASE 13. |
| AnswerComponent Next tapped | `answerComponent.destroy()`, `previewScreen.destroy()`, `floatingBtn.destroy()`, `postMessage({type:'next_ended'})`. Iframe tears down. |
| Visibility hidden / tab switch (CASE 14) | All audio pauses (static + dynamic + streams). VisibilityTracker's built-in PopupComponent renders the pause overlay (`autoShowPopup: true` default — never custom). Per `feedback_pause_overlay.md` memory. |
| Visibility restored (CASE 15) | Audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues exactly where it was (input value preserved, addend display preserved). |
| Audio failure (CASE 16) | All audio calls try/catch wrapped. Visual feedback (red shake, friendly-pair reveal, sticker) renders regardless. Game advances normally. |

## Content Structure (fallbackContent)

### Per-round payload shape

Each round object carries everything needed to render the play area AND validate the submitted value:

```js
{
  set: 'A' | 'B' | 'C',
  id: 'A_r1_58_72' | 'A_r2_61_69' | ... ,    // globally unique
  round: 1..9,                                 // index within the set
  stage: 1 | 2 | 3,                            // 1: rounds 1-3, 2: rounds 4-6, 3: rounds 7-9
  type: 'adjust-and-add',
  // Starting addend values shown in the boxes when the round loads.
  addend1Start: <int>,                         // two-digit, 10-99
  addend2Start: <int>,                         // two-digit, 10-99
  // The friendly pair the student is "supposed" to nudge toward (used in the correct-answer
  // reveal animation: addend boxes animate from start values to these). The sum equals
  // addend1Start + addend2Start (compensation invariant — verified at build time).
  addend1Friendly: <int>,                      // multiple of 10 (or close to it)
  addend2Friendly: <int>,                      // multiple of 10 (or close to it)
  // The correct integer the student must type. EQUALS addend1Start + addend2Start
  // EQUALS addend1Friendly + addend2Friendly. Verified at build time.
  correct: <int>,
  // Strings for correct/wrong feedback TTS, parameterised on the round's specific numbers.
  successAudio: 'Nice! 58 plus 72 is the same as 60 plus 70, which is 130.',
  successSubtitle: '58 + 72 = 60 + 70 = 130',
  failAudio: 'Not quite — the sum of 58 and 72 is 130.',
  failSubtitle: 'Sum of 58 and 72 is 130',
  // Misconception tags: each maps a wrong-answer FAMILY to a named misconception. The runtime
  // evaluates the student's typed value against each candidate and tags recordAttempt with
  // the matching one (or 'whole-rule-mismatch' if none match).
  misconception_tags: {
    '<value>': 'compensation-applied-only-to-addend1',
    '<value>': 'wrong-direction-compensation',
    '<value>': 'arithmetic-error-on-friendly-pair',
    '<value>': 'tens-only-no-ones-add',
    '<value>': 'off-by-ten-place-value-slip',
    'whole-rule-mismatch': 'whole-rule-mismatch'
  },
  // Answer payload for AnswerComponent (PART-051).
  answer: {
    addend1Start: <int>, addend2Start: <int>,
    addend1Friendly: <int>, addend2Friendly: <int>,
    correct: <int>,
    strategyStatement: '58 + 72 = 60 + 70 = 130. Add 2 to one, subtract 2 from the other — the sum stays the same.'
  }
}
```

### Misconception tags (named, real misconceptions for two-digit + two-digit addition with compensation)

- **`compensation-applied-only-to-addend1`** — student nudged the FIRST addend to a friendly value (e.g. 58 → 60) but FORGOT to apply the compensation to the second addend, then summed the new pair. E.g. for `58 + 72`: nudges 58 → 60 (+2), keeps 72 as is, types `60 + 72 = 132`. Off by +2 from correct.
- **`compensation-applied-only-to-addend2`** — student nudged the SECOND addend to a friendly value (e.g. 72 → 70) but FORGOT to apply the compensation to the first addend, then summed the new pair. E.g. for `58 + 72`: keeps 58, nudges 72 → 70 (-2), types `58 + 70 = 128`. Off by -2 from correct.
- **`wrong-direction-compensation`** — student adds to BOTH addends (or subtracts from both) instead of one up / one down. E.g. for `58 + 72`: nudges 58 → 60 AND 72 → 70 by *adding* to both, types something like `132` (wrong direction on the second). Off by ±4 typically.
- **`arithmetic-error-on-friendly-pair`** — student correctly applies compensation to reach `60 + 70` but mis-adds: types `120` or `140` instead of `130`. Off by ±10 from correct.
- **`tens-only-no-ones-add`** — student adds the tens digits and forgets the ones (a residual column-addition slip). E.g. for `58 + 72`: types `120` (5+7=12 in tens, ignored 8+2=10 carry). Off by exactly 10.
- **`off-by-ten-place-value-slip`** — student misreads or types one of the addends with a tens-digit slip (e.g. types `58 + 72` as if it were `48 + 72` and submits 120). Off by ±10.
- **`whole-rule-mismatch`** — generic catch-all. The student's number reflects neither the correct sum nor any tracked misconception family.

The runtime's wrong-answer evaluator computes the candidate values for each named misconception (per round, parameterised on `addend1Start` / `addend2Start`) and matches the student's submitted value against the set; on a match, that tag goes into `recordAttempt`. On no match, `whole-rule-mismatch` is used.

### Preview-screen content

- `previewInstruction` (HTML):
  ```html
  <p><strong>The Compensation Workout</strong></p>
  <p>You'll see two awkward two-digit numbers to add. Use the <strong>+ and − buttons</strong> on each box to nudge them into a <em>friendlier</em> pair (like 60 + 70).</p>
  <p>Then <strong>type the sum</strong> and tap <strong>Next Round</strong>.</p>
  <p>Tip: what you add to one box, you can subtract from the other — the sum stays the same!</p>
  <p>9 rounds. 3 lives. No timer.</p>
  ```
- `previewAudioText` (plain text, used at deploy time to generate `previewAudio` TTS):
  > "The Compensation Workout. You will see two awkward two-digit numbers to add. Use the plus and minus buttons on each box to nudge them into a friendlier pair, like 60 plus 70. Then type the sum and tap Next Round. Tip: what you add to one box, you can subtract from the other — the sum stays the same. Nine rounds. Three lives. No timer."
- `showGameOnPreview`: `false` (the +/- mechanic is novel; the preview overlay should not show the game state until the audio explains it).

### Round-set cycling — 27 round objects total

`rounds.length === 27 === totalRounds (9) × 3 sets`. Set A plays first attempt. Set B plays after Try Again / Play Again. Set C plays after the next restart, then back to A. Difficulty is parallel across sets — Set A's R1 ≈ Set B's R1 ≈ Set C's R1 in distance-from-benchmark and sum range.

```js
const fallbackContent = {
  // Preview (PART-039)
  previewInstruction:
    '<p><strong>The Compensation Workout</strong></p>' +
    '<p>You\'ll see two awkward two-digit numbers to add. Use the <strong>+ and − buttons</strong> on each box to nudge them into a <em>friendlier</em> pair (like 60 + 70).</p>' +
    '<p>Then <strong>type the sum</strong> and tap <strong>Next Round</strong>.</p>' +
    '<p>Tip: what you add to one box, you can subtract from the other — the sum stays the same!</p>' +
    '<p>9 rounds. 3 lives. No timer.</p>',
  previewAudioText:
    'The Compensation Workout. You will see two awkward two-digit numbers to add. ' +
    'Use the plus and minus buttons on each box to nudge them into a friendlier pair, like 60 plus 70. ' +
    'Then type the sum and tap Next Round. ' +
    'Tip: what you add to one box, you can subtract from the other — the sum stays the same. ' +
    'Nine rounds. Three lives. No timer.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,

  // Session config
  totalRounds: 9,
  totalLives: 3,
  // Note: timer is NOT used; getStars() reads firstTryCorrect/lives, not duration.

  rounds: [
    // ──────────────────────────────────────────────────────────────
    // SET A — 9 rounds
    // ──────────────────────────────────────────────────────────────

    // Stage 1 — Easy benchmarks (within ±4 of a multiple of 10)
    {
      set: 'A', id: 'A_r1_58_72', round: 1, stage: 1, type: 'adjust-and-add',
      addend1Start: 58, addend2Start: 72,
      addend1Friendly: 60, addend2Friendly: 70,
      correct: 130,
      successAudio: 'Nice! 58 plus 72 is the same as 60 plus 70, which is 130.',
      successSubtitle: '58 + 72 = 60 + 70 = 130',
      failAudio: 'Not quite — the sum of 58 and 72 is 130.',
      failSubtitle: 'Sum of 58 and 72 is 130',
      misconception_tags: {
        '132': 'compensation-applied-only-to-addend1', // 60+72=132
        '128': 'compensation-applied-only-to-addend2', // 58+70=128
        '120': 'tens-only-no-ones-add',                 // 5+7=12 -> 120
        '140': 'arithmetic-error-on-friendly-pair',     // 60+70 mis-added as 140
        '134': 'wrong-direction-compensation',          // 60+74 (wrong dir on 72)
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 58, addend2Start: 72,
        addend1Friendly: 60, addend2Friendly: 70,
        correct: 130,
        strategyStatement: '58 + 72 = 60 + 70 = 130. Add 2 to 58, subtract 2 from 72 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r2_61_69', round: 2, stage: 1, type: 'adjust-and-add',
      addend1Start: 61, addend2Start: 69,
      addend1Friendly: 60, addend2Friendly: 70,
      correct: 130,
      successAudio: 'Nice! 61 plus 69 is the same as 60 plus 70, which is 130.',
      successSubtitle: '61 + 69 = 60 + 70 = 130',
      failAudio: 'Not quite — the sum of 61 and 69 is 130.',
      failSubtitle: 'Sum of 61 and 69 is 130',
      misconception_tags: {
        '129': 'compensation-applied-only-to-addend1', // 60+69=129
        '131': 'compensation-applied-only-to-addend2', // 61+70=131
        '120': 'tens-only-no-ones-add',                 // 6+6=12 -> 120
        '140': 'arithmetic-error-on-friendly-pair',     // 60+70 mis-added as 140
        '128': 'wrong-direction-compensation',          // 60+68 (wrong dir on 69)
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 61, addend2Start: 69,
        addend1Friendly: 60, addend2Friendly: 70,
        correct: 130,
        strategyStatement: '61 + 69 = 60 + 70 = 130. Subtract 1 from 61, add 1 to 69 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r3_47_73', round: 3, stage: 1, type: 'adjust-and-add',
      addend1Start: 47, addend2Start: 73,
      addend1Friendly: 50, addend2Friendly: 70,
      correct: 120,
      successAudio: 'Nice! 47 plus 73 is the same as 50 plus 70, which is 120.',
      successSubtitle: '47 + 73 = 50 + 70 = 120',
      failAudio: 'Not quite — the sum of 47 and 73 is 120.',
      failSubtitle: 'Sum of 47 and 73 is 120',
      misconception_tags: {
        '123': 'compensation-applied-only-to-addend1', // 50+73=123
        '117': 'compensation-applied-only-to-addend2', // 47+70=117
        '110': 'tens-only-no-ones-add',                 // 4+7=11 -> 110
        '130': 'arithmetic-error-on-friendly-pair',     // 50+70 mis-added as 130
        '126': 'wrong-direction-compensation',          // 50+76 (added to both)
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 47, addend2Start: 73,
        addend1Friendly: 50, addend2Friendly: 70,
        correct: 120,
        strategyStatement: '47 + 73 = 50 + 70 = 120. Add 3 to 47, subtract 3 from 73 — the sum stays the same.'
      }
    },

    // Stage 2 — Tighter adjustments (soft blue border on boxes)
    {
      set: 'A', id: 'A_r4_62_68', round: 4, stage: 2, type: 'adjust-and-add',
      addend1Start: 62, addend2Start: 68,
      addend1Friendly: 60, addend2Friendly: 70,
      correct: 130,
      successAudio: 'Great! 62 plus 68 is the same as 60 plus 70, which is 130.',
      successSubtitle: '62 + 68 = 60 + 70 = 130',
      failAudio: 'Not quite — the sum of 62 and 68 is 130.',
      failSubtitle: 'Sum of 62 and 68 is 130',
      misconception_tags: {
        '128': 'compensation-applied-only-to-addend1', // 60+68=128
        '132': 'compensation-applied-only-to-addend2', // 62+70=132
        '120': 'tens-only-no-ones-add',                 // 6+6=12 -> 120
        '140': 'arithmetic-error-on-friendly-pair',     // 60+70 -> 140
        '134': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 62, addend2Start: 68,
        addend1Friendly: 60, addend2Friendly: 70,
        correct: 130,
        strategyStatement: '62 + 68 = 60 + 70 = 130. Subtract 2 from 62, add 2 to 68 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r5_53_77', round: 5, stage: 2, type: 'adjust-and-add',
      addend1Start: 53, addend2Start: 77,
      addend1Friendly: 50, addend2Friendly: 80,
      correct: 130,
      successAudio: 'Great! 53 plus 77 is the same as 50 plus 80, which is 130.',
      successSubtitle: '53 + 77 = 50 + 80 = 130',
      failAudio: 'Not quite — the sum of 53 and 77 is 130.',
      failSubtitle: 'Sum of 53 and 77 is 130',
      misconception_tags: {
        '127': 'compensation-applied-only-to-addend1', // 50+77=127
        '133': 'compensation-applied-only-to-addend2', // 53+80=133
        '120': 'tens-only-no-ones-add',                 // 5+7=12 -> 120
        '140': 'arithmetic-error-on-friendly-pair',     // 50+80 -> 140 (mis-add)
        '136': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 53, addend2Start: 77,
        addend1Friendly: 50, addend2Friendly: 80,
        correct: 130,
        strategyStatement: '53 + 77 = 50 + 80 = 130. Subtract 3 from 53, add 3 to 77 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r6_38_82', round: 6, stage: 2, type: 'adjust-and-add',
      addend1Start: 38, addend2Start: 82,
      addend1Friendly: 40, addend2Friendly: 80,
      correct: 120,
      successAudio: 'Great! 38 plus 82 is the same as 40 plus 80, which is 120.',
      successSubtitle: '38 + 82 = 40 + 80 = 120',
      failAudio: 'Not quite — the sum of 38 and 82 is 120.',
      failSubtitle: 'Sum of 38 and 82 is 120',
      misconception_tags: {
        '122': 'compensation-applied-only-to-addend1', // 40+82=122
        '118': 'compensation-applied-only-to-addend2', // 38+80=118
        '110': 'tens-only-no-ones-add',                 // 3+8=11 -> 110
        '130': 'arithmetic-error-on-friendly-pair',     // 40+80 -> 130 (mis-add)
        '124': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 38, addend2Start: 82,
        addend1Friendly: 40, addend2Friendly: 80,
        correct: 120,
        strategyStatement: '38 + 82 = 40 + 80 = 120. Add 2 to 38, subtract 2 from 82 — the sum stays the same.'
      }
    },

    // Stage 3 — Wider gaps (bolder digit weight)
    {
      set: 'A', id: 'A_r7_66_74', round: 7, stage: 3, type: 'adjust-and-add',
      addend1Start: 66, addend2Start: 74,
      addend1Friendly: 70, addend2Friendly: 70,    // twin pair
      correct: 140,
      successAudio: 'Excellent! 66 plus 74 is the same as 70 plus 70, which is 140.',
      successSubtitle: '66 + 74 = 70 + 70 = 140',
      failAudio: 'Not quite — the sum of 66 and 74 is 140.',
      failSubtitle: 'Sum of 66 and 74 is 140',
      misconception_tags: {
        '144': 'compensation-applied-only-to-addend1', // 70+74=144
        '136': 'compensation-applied-only-to-addend2', // 66+70=136
        '130': 'tens-only-no-ones-add',                 // 6+7=13 -> 130
        '150': 'arithmetic-error-on-friendly-pair',     // 70+70 mis-added as 150
        '148': 'wrong-direction-compensation',          // 70+78 added to both
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 66, addend2Start: 74,
        addend1Friendly: 70, addend2Friendly: 70,
        correct: 140,
        strategyStatement: '66 + 74 = 70 + 70 = 140. Add 4 to 66, subtract 4 from 74 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r8_64_76', round: 8, stage: 3, type: 'adjust-and-add',
      addend1Start: 64, addend2Start: 76,
      addend1Friendly: 70, addend2Friendly: 70,    // twin pair
      correct: 140,
      successAudio: 'Excellent! 64 plus 76 is the same as 70 plus 70, which is 140.',
      successSubtitle: '64 + 76 = 70 + 70 = 140',
      failAudio: 'Not quite — the sum of 64 and 76 is 140.',
      failSubtitle: 'Sum of 64 and 76 is 140',
      misconception_tags: {
        '146': 'compensation-applied-only-to-addend1', // 70+76=146
        '134': 'compensation-applied-only-to-addend2', // 64+70=134
        '130': 'tens-only-no-ones-add',                 // 6+7=13 -> 130
        '150': 'arithmetic-error-on-friendly-pair',     // 70+70 mis-added as 150
        '152': 'wrong-direction-compensation',          // 70+82 (wrong dir)
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 64, addend2Start: 76,
        addend1Friendly: 70, addend2Friendly: 70,
        correct: 140,
        strategyStatement: '64 + 76 = 70 + 70 = 140. Add 6 to 64, subtract 6 from 76 — the sum stays the same.'
      }
    },
    {
      set: 'A', id: 'A_r9_43_78', round: 9, stage: 3, type: 'adjust-and-add',
      addend1Start: 43, addend2Start: 78,
      addend1Friendly: 40, addend2Friendly: 81,    // mixed: not both friendly, but compensation works
      // NOTE: for this round the spec authors picked 40 + 81 as the "friendly" reveal — keeping
      // the *mental* sum as 121 (40 + 81 = 121, exactly 43 + 78 = 121). Friendly pair doesn't
      // have to be two multiples of 10; for Round 9 the compensation lands on one multiple-of-10
      // and one easy-to-add neighbour. Build step verifies addend1Friendly + addend2Friendly === correct.
      correct: 121,
      successAudio: 'Excellent! 43 plus 78 is the same as 40 plus 81, which is 121.',
      successSubtitle: '43 + 78 = 40 + 81 = 121',
      failAudio: 'Not quite — the sum of 43 and 78 is 121.',
      failSubtitle: 'Sum of 43 and 78 is 121',
      misconception_tags: {
        '118': 'compensation-applied-only-to-addend1', // 40+78=118
        '124': 'compensation-applied-only-to-addend2', // 43+81=124
        '110': 'tens-only-no-ones-add',                 // 4+7=11 -> 110
        '120': 'arithmetic-error-on-friendly-pair',     // 40+80 = 120 (off by 1)
        '111': 'off-by-ten-place-value-slip',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 43, addend2Start: 78,
        addend1Friendly: 40, addend2Friendly: 81,
        correct: 121,
        strategyStatement: '43 + 78 = 40 + 81 = 121. Subtract 3 from 43, add 3 to 78 — the sum stays the same.'
      }
    },

    // ──────────────────────────────────────────────────────────────
    // SET B — 9 rounds (parallel difficulty to Set A)
    // ──────────────────────────────────────────────────────────────

    // Stage 1
    {
      set: 'B', id: 'B_r1_59_71', round: 1, stage: 1, type: 'adjust-and-add',
      addend1Start: 59, addend2Start: 71,
      addend1Friendly: 60, addend2Friendly: 70,
      correct: 130,
      successAudio: 'Nice! 59 plus 71 is the same as 60 plus 70, which is 130.',
      successSubtitle: '59 + 71 = 60 + 70 = 130',
      failAudio: 'Not quite — the sum of 59 and 71 is 130.',
      failSubtitle: 'Sum of 59 and 71 is 130',
      misconception_tags: {
        '131': 'compensation-applied-only-to-addend1', // 60+71=131
        '129': 'compensation-applied-only-to-addend2', // 59+70=129
        '120': 'tens-only-no-ones-add',
        '140': 'arithmetic-error-on-friendly-pair',
        '132': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 59, addend2Start: 71,
        addend1Friendly: 60, addend2Friendly: 70,
        correct: 130,
        strategyStatement: '59 + 71 = 60 + 70 = 130. Add 1 to 59, subtract 1 from 71 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r2_42_68', round: 2, stage: 1, type: 'adjust-and-add',
      addend1Start: 42, addend2Start: 68,
      addend1Friendly: 40, addend2Friendly: 70,
      correct: 110,
      successAudio: 'Nice! 42 plus 68 is the same as 40 plus 70, which is 110.',
      successSubtitle: '42 + 68 = 40 + 70 = 110',
      failAudio: 'Not quite — the sum of 42 and 68 is 110.',
      failSubtitle: 'Sum of 42 and 68 is 110',
      misconception_tags: {
        '108': 'compensation-applied-only-to-addend1', // 40+68=108
        '112': 'compensation-applied-only-to-addend2', // 42+70=112
        '100': 'tens-only-no-ones-add',                 // 4+6=10 -> 100
        '120': 'arithmetic-error-on-friendly-pair',     // 40+70 -> 120
        '114': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 42, addend2Start: 68,
        addend1Friendly: 40, addend2Friendly: 70,
        correct: 110,
        strategyStatement: '42 + 68 = 40 + 70 = 110. Subtract 2 from 42, add 2 to 68 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r3_57_83', round: 3, stage: 1, type: 'adjust-and-add',
      addend1Start: 57, addend2Start: 83,
      addend1Friendly: 60, addend2Friendly: 80,
      correct: 140,
      successAudio: 'Nice! 57 plus 83 is the same as 60 plus 80, which is 140.',
      successSubtitle: '57 + 83 = 60 + 80 = 140',
      failAudio: 'Not quite — the sum of 57 and 83 is 140.',
      failSubtitle: 'Sum of 57 and 83 is 140',
      misconception_tags: {
        '143': 'compensation-applied-only-to-addend1', // 60+83=143
        '137': 'compensation-applied-only-to-addend2', // 57+80=137
        '130': 'tens-only-no-ones-add',                 // 5+8=13 -> 130
        '150': 'arithmetic-error-on-friendly-pair',
        '146': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 57, addend2Start: 83,
        addend1Friendly: 60, addend2Friendly: 80,
        correct: 140,
        strategyStatement: '57 + 83 = 60 + 80 = 140. Add 3 to 57, subtract 3 from 83 — the sum stays the same.'
      }
    },

    // Stage 2
    {
      set: 'B', id: 'B_r4_63_67', round: 4, stage: 2, type: 'adjust-and-add',
      addend1Start: 63, addend2Start: 67,
      addend1Friendly: 60, addend2Friendly: 70,
      correct: 130,
      successAudio: 'Great! 63 plus 67 is the same as 60 plus 70, which is 130.',
      successSubtitle: '63 + 67 = 60 + 70 = 130',
      failAudio: 'Not quite — the sum of 63 and 67 is 130.',
      failSubtitle: 'Sum of 63 and 67 is 130',
      misconception_tags: {
        '127': 'compensation-applied-only-to-addend1', // 60+67=127
        '133': 'compensation-applied-only-to-addend2', // 63+70=133
        '120': 'tens-only-no-ones-add',
        '140': 'arithmetic-error-on-friendly-pair',
        '136': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 63, addend2Start: 67,
        addend1Friendly: 60, addend2Friendly: 70,
        correct: 130,
        strategyStatement: '63 + 67 = 60 + 70 = 130. Subtract 3 from 63, add 3 to 67 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r5_54_76', round: 5, stage: 2, type: 'adjust-and-add',
      addend1Start: 54, addend2Start: 76,
      addend1Friendly: 50, addend2Friendly: 80,
      correct: 130,
      successAudio: 'Great! 54 plus 76 is the same as 50 plus 80, which is 130.',
      successSubtitle: '54 + 76 = 50 + 80 = 130',
      failAudio: 'Not quite — the sum of 54 and 76 is 130.',
      failSubtitle: 'Sum of 54 and 76 is 130',
      misconception_tags: {
        '126': 'compensation-applied-only-to-addend1', // 50+76=126
        '134': 'compensation-applied-only-to-addend2', // 54+80=134
        '120': 'tens-only-no-ones-add',
        '140': 'arithmetic-error-on-friendly-pair',
        '138': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 54, addend2Start: 76,
        addend1Friendly: 50, addend2Friendly: 80,
        correct: 130,
        strategyStatement: '54 + 76 = 50 + 80 = 130. Subtract 4 from 54, add 4 to 76 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r6_36_84', round: 6, stage: 2, type: 'adjust-and-add',
      addend1Start: 36, addend2Start: 84,
      addend1Friendly: 40, addend2Friendly: 80,
      correct: 120,
      successAudio: 'Great! 36 plus 84 is the same as 40 plus 80, which is 120.',
      successSubtitle: '36 + 84 = 40 + 80 = 120',
      failAudio: 'Not quite — the sum of 36 and 84 is 120.',
      failSubtitle: 'Sum of 36 and 84 is 120',
      misconception_tags: {
        '124': 'compensation-applied-only-to-addend1', // 40+84=124
        '116': 'compensation-applied-only-to-addend2', // 36+80=116
        '110': 'tens-only-no-ones-add',
        '130': 'arithmetic-error-on-friendly-pair',
        '128': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 36, addend2Start: 84,
        addend1Friendly: 40, addend2Friendly: 80,
        correct: 120,
        strategyStatement: '36 + 84 = 40 + 80 = 120. Add 4 to 36, subtract 4 from 84 — the sum stays the same.'
      }
    },

    // Stage 3
    {
      set: 'B', id: 'B_r7_67_73', round: 7, stage: 3, type: 'adjust-and-add',
      addend1Start: 67, addend2Start: 73,
      addend1Friendly: 70, addend2Friendly: 70,
      correct: 140,
      successAudio: 'Excellent! 67 plus 73 is the same as 70 plus 70, which is 140.',
      successSubtitle: '67 + 73 = 70 + 70 = 140',
      failAudio: 'Not quite — the sum of 67 and 73 is 140.',
      failSubtitle: 'Sum of 67 and 73 is 140',
      misconception_tags: {
        '143': 'compensation-applied-only-to-addend1', // 70+73=143
        '137': 'compensation-applied-only-to-addend2', // 67+70=137
        '130': 'tens-only-no-ones-add',
        '150': 'arithmetic-error-on-friendly-pair',
        '146': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 67, addend2Start: 73,
        addend1Friendly: 70, addend2Friendly: 70,
        correct: 140,
        strategyStatement: '67 + 73 = 70 + 70 = 140. Add 3 to 67, subtract 3 from 73 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r8_55_85', round: 8, stage: 3, type: 'adjust-and-add',
      addend1Start: 55, addend2Start: 85,
      addend1Friendly: 50, addend2Friendly: 90,
      correct: 140,
      successAudio: 'Excellent! 55 plus 85 is the same as 50 plus 90, which is 140.',
      successSubtitle: '55 + 85 = 50 + 90 = 140',
      failAudio: 'Not quite — the sum of 55 and 85 is 140.',
      failSubtitle: 'Sum of 55 and 85 is 140',
      misconception_tags: {
        '135': 'compensation-applied-only-to-addend1', // 50+85=135
        '145': 'compensation-applied-only-to-addend2', // 55+90=145
        '130': 'tens-only-no-ones-add',
        '150': 'arithmetic-error-on-friendly-pair',
        '148': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 55, addend2Start: 85,
        addend1Friendly: 50, addend2Friendly: 90,
        correct: 140,
        strategyStatement: '55 + 85 = 50 + 90 = 140. Subtract 5 from 55, add 5 to 85 — the sum stays the same.'
      }
    },
    {
      set: 'B', id: 'B_r9_46_77', round: 9, stage: 3, type: 'adjust-and-add',
      addend1Start: 46, addend2Start: 77,
      addend1Friendly: 50, addend2Friendly: 73,
      correct: 123,
      successAudio: 'Excellent! 46 plus 77 is the same as 50 plus 73, which is 123.',
      successSubtitle: '46 + 77 = 50 + 73 = 123',
      failAudio: 'Not quite — the sum of 46 and 77 is 123.',
      failSubtitle: 'Sum of 46 and 77 is 123',
      misconception_tags: {
        '127': 'compensation-applied-only-to-addend1', // 50+77=127
        '119': 'compensation-applied-only-to-addend2', // 46+73=119
        '110': 'tens-only-no-ones-add',                 // 4+7=11 -> 110
        '120': 'arithmetic-error-on-friendly-pair',
        '113': 'off-by-ten-place-value-slip',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 46, addend2Start: 77,
        addend1Friendly: 50, addend2Friendly: 73,
        correct: 123,
        strategyStatement: '46 + 77 = 50 + 73 = 123. Add 4 to 46, subtract 4 from 77 — the sum stays the same.'
      }
    },

    // ──────────────────────────────────────────────────────────────
    // SET C — 9 rounds (parallel difficulty to Sets A and B)
    // ──────────────────────────────────────────────────────────────

    // Stage 1
    {
      set: 'C', id: 'C_r1_48_62', round: 1, stage: 1, type: 'adjust-and-add',
      addend1Start: 48, addend2Start: 62,
      addend1Friendly: 50, addend2Friendly: 60,
      correct: 110,
      successAudio: 'Nice! 48 plus 62 is the same as 50 plus 60, which is 110.',
      successSubtitle: '48 + 62 = 50 + 60 = 110',
      failAudio: 'Not quite — the sum of 48 and 62 is 110.',
      failSubtitle: 'Sum of 48 and 62 is 110',
      misconception_tags: {
        '112': 'compensation-applied-only-to-addend1', // 50+62=112
        '108': 'compensation-applied-only-to-addend2', // 48+60=108
        '100': 'tens-only-no-ones-add',                 // 4+6=10 -> 100
        '120': 'arithmetic-error-on-friendly-pair',
        '114': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 48, addend2Start: 62,
        addend1Friendly: 50, addend2Friendly: 60,
        correct: 110,
        strategyStatement: '48 + 62 = 50 + 60 = 110. Add 2 to 48, subtract 2 from 62 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r2_29_81', round: 2, stage: 1, type: 'adjust-and-add',
      addend1Start: 29, addend2Start: 81,
      addend1Friendly: 30, addend2Friendly: 80,
      correct: 110,
      successAudio: 'Nice! 29 plus 81 is the same as 30 plus 80, which is 110.',
      successSubtitle: '29 + 81 = 30 + 80 = 110',
      failAudio: 'Not quite — the sum of 29 and 81 is 110.',
      failSubtitle: 'Sum of 29 and 81 is 110',
      misconception_tags: {
        '111': 'compensation-applied-only-to-addend1', // 30+81=111
        '109': 'compensation-applied-only-to-addend2', // 29+80=109
        '100': 'tens-only-no-ones-add',                 // 2+8=10 -> 100
        '120': 'arithmetic-error-on-friendly-pair',
        '112': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 29, addend2Start: 81,
        addend1Friendly: 30, addend2Friendly: 80,
        correct: 110,
        strategyStatement: '29 + 81 = 30 + 80 = 110. Add 1 to 29, subtract 1 from 81 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r3_56_64', round: 3, stage: 1, type: 'adjust-and-add',
      addend1Start: 56, addend2Start: 64,
      addend1Friendly: 60, addend2Friendly: 60,
      correct: 120,
      successAudio: 'Nice! 56 plus 64 is the same as 60 plus 60, which is 120.',
      successSubtitle: '56 + 64 = 60 + 60 = 120',
      failAudio: 'Not quite — the sum of 56 and 64 is 120.',
      failSubtitle: 'Sum of 56 and 64 is 120',
      misconception_tags: {
        '124': 'compensation-applied-only-to-addend1', // 60+64=124
        '116': 'compensation-applied-only-to-addend2', // 56+60=116
        '110': 'tens-only-no-ones-add',                 // 5+6=11 -> 110
        '130': 'arithmetic-error-on-friendly-pair',
        '128': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 56, addend2Start: 64,
        addend1Friendly: 60, addend2Friendly: 60,
        correct: 120,
        strategyStatement: '56 + 64 = 60 + 60 = 120. Add 4 to 56, subtract 4 from 64 — the sum stays the same.'
      }
    },

    // Stage 2
    {
      set: 'C', id: 'C_r4_71_69', round: 4, stage: 2, type: 'adjust-and-add',
      addend1Start: 71, addend2Start: 69,
      addend1Friendly: 70, addend2Friendly: 70,
      correct: 140,
      successAudio: 'Great! 71 plus 69 is the same as 70 plus 70, which is 140.',
      successSubtitle: '71 + 69 = 70 + 70 = 140',
      failAudio: 'Not quite — the sum of 71 and 69 is 140.',
      failSubtitle: 'Sum of 71 and 69 is 140',
      misconception_tags: {
        '139': 'compensation-applied-only-to-addend1', // 70+69=139
        '141': 'compensation-applied-only-to-addend2', // 71+70=141
        '130': 'tens-only-no-ones-add',
        '150': 'arithmetic-error-on-friendly-pair',
        '142': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 71, addend2Start: 69,
        addend1Friendly: 70, addend2Friendly: 70,
        correct: 140,
        strategyStatement: '71 + 69 = 70 + 70 = 140. Subtract 1 from 71, add 1 to 69 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r5_47_85', round: 5, stage: 2, type: 'adjust-and-add',
      addend1Start: 47, addend2Start: 85,
      addend1Friendly: 50, addend2Friendly: 82,    // 50+82=132 ; not both multiples of 10, but compensation valid
      correct: 132,
      successAudio: 'Great! 47 plus 85 is the same as 50 plus 82, which is 132.',
      successSubtitle: '47 + 85 = 50 + 82 = 132',
      failAudio: 'Not quite — the sum of 47 and 85 is 132.',
      failSubtitle: 'Sum of 47 and 85 is 132',
      misconception_tags: {
        '135': 'compensation-applied-only-to-addend1', // 50+85=135
        '129': 'compensation-applied-only-to-addend2', // 47+82=129
        '120': 'tens-only-no-ones-add',                 // 4+8=12 -> 120
        '130': 'arithmetic-error-on-friendly-pair',     // 50+80 = 130
        '138': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 47, addend2Start: 85,
        addend1Friendly: 50, addend2Friendly: 82,
        correct: 132,
        strategyStatement: '47 + 85 = 50 + 82 = 132. Add 3 to 47, subtract 3 from 85 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r6_28_94', round: 6, stage: 2, type: 'adjust-and-add',
      addend1Start: 28, addend2Start: 94,
      addend1Friendly: 30, addend2Friendly: 92,    // 30+92=122
      correct: 122,
      successAudio: 'Great! 28 plus 94 is the same as 30 plus 92, which is 122.',
      successSubtitle: '28 + 94 = 30 + 92 = 122',
      failAudio: 'Not quite — the sum of 28 and 94 is 122.',
      failSubtitle: 'Sum of 28 and 94 is 122',
      misconception_tags: {
        '124': 'compensation-applied-only-to-addend1', // 30+94=124
        '120': 'compensation-applied-only-to-addend2', // 28+92=120
        '110': 'tens-only-no-ones-add',                 // 2+9=11 -> 110
        '130': 'arithmetic-error-on-friendly-pair',
        '126': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 28, addend2Start: 94,
        addend1Friendly: 30, addend2Friendly: 92,
        correct: 122,
        strategyStatement: '28 + 94 = 30 + 92 = 122. Add 2 to 28, subtract 2 from 94 — the sum stays the same.'
      }
    },

    // Stage 3
    {
      set: 'C', id: 'C_r7_65_75', round: 7, stage: 3, type: 'adjust-and-add',
      addend1Start: 65, addend2Start: 75,
      addend1Friendly: 70, addend2Friendly: 70,
      correct: 140,
      successAudio: 'Excellent! 65 plus 75 is the same as 70 plus 70, which is 140.',
      successSubtitle: '65 + 75 = 70 + 70 = 140',
      failAudio: 'Not quite — the sum of 65 and 75 is 140.',
      failSubtitle: 'Sum of 65 and 75 is 140',
      misconception_tags: {
        '145': 'compensation-applied-only-to-addend1', // 70+75=145
        '135': 'compensation-applied-only-to-addend2', // 65+70=135
        '130': 'tens-only-no-ones-add',
        '150': 'arithmetic-error-on-friendly-pair',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 65, addend2Start: 75,
        addend1Friendly: 70, addend2Friendly: 70,
        correct: 140,
        strategyStatement: '65 + 75 = 70 + 70 = 140. Add 5 to 65, subtract 5 from 75 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r8_44_86', round: 8, stage: 3, type: 'adjust-and-add',
      addend1Start: 44, addend2Start: 86,
      addend1Friendly: 40, addend2Friendly: 90,
      correct: 130,
      successAudio: 'Excellent! 44 plus 86 is the same as 40 plus 90, which is 130.',
      successSubtitle: '44 + 86 = 40 + 90 = 130',
      failAudio: 'Not quite — the sum of 44 and 86 is 130.',
      failSubtitle: 'Sum of 44 and 86 is 130',
      misconception_tags: {
        '126': 'compensation-applied-only-to-addend1', // 40+86=126
        '134': 'compensation-applied-only-to-addend2', // 44+90=134
        '120': 'tens-only-no-ones-add',
        '140': 'arithmetic-error-on-friendly-pair',
        '138': 'wrong-direction-compensation',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 44, addend2Start: 86,
        addend1Friendly: 40, addend2Friendly: 90,
        correct: 130,
        strategyStatement: '44 + 86 = 40 + 90 = 130. Subtract 4 from 44, add 4 to 86 — the sum stays the same.'
      }
    },
    {
      set: 'C', id: 'C_r9_37_88', round: 9, stage: 3, type: 'adjust-and-add',
      addend1Start: 37, addend2Start: 88,
      addend1Friendly: 40, addend2Friendly: 85,    // 40+85=125
      correct: 125,
      successAudio: 'Excellent! 37 plus 88 is the same as 40 plus 85, which is 125.',
      successSubtitle: '37 + 88 = 40 + 85 = 125',
      failAudio: 'Not quite — the sum of 37 and 88 is 125.',
      failSubtitle: 'Sum of 37 and 88 is 125',
      misconception_tags: {
        '128': 'compensation-applied-only-to-addend1', // 40+88=128
        '122': 'compensation-applied-only-to-addend2', // 37+85=122
        '110': 'tens-only-no-ones-add',                 // 3+8=11 -> 110
        '120': 'arithmetic-error-on-friendly-pair',
        '115': 'off-by-ten-place-value-slip',
        'whole-rule-mismatch': 'whole-rule-mismatch'
      },
      answer: {
        addend1Start: 37, addend2Start: 88,
        addend1Friendly: 40, addend2Friendly: 85,
        correct: 125,
        strategyStatement: '37 + 88 = 40 + 85 = 125. Add 3 to 37, subtract 3 from 88 — the sum stays the same.'
      }
    }
  ]
};
```

**Round-set cycling check:** `rounds.length === 27 === totalRounds (9) × 3 sets`. Every round has a `set` key (`'A' | 'B' | 'C'`). All `id` values are globally unique (`A_r1_58_72` through `C_r9_37_88`). Set A's R1 ≈ Set B's R1 ≈ Set C's R1 in difficulty. Validator `GEN-ROUNDSETS-MIN-3` passes.

**Build-time invariants (must be verified by the build step):**
1. For every round: `addend1Start + addend2Start === correct`.
2. For every round: `addend1Friendly + addend2Friendly === correct` (compensation invariant — the friendly pair must sum to the same value).
3. For every round: `Math.abs(addend1Start - addend1Friendly) === Math.abs(addend2Start - addend2Friendly)` (the magnitude added to one side equals the magnitude subtracted from the other).
4. For every round: `addend1Start` and `addend2Start` are two-digit positive integers (10–99).
5. For every round: `correct` is a positive integer (typically 100–150 in this game).
6. Stage 1 rounds: `Math.abs(addend1Start - addend1Friendly) <= 4` AND `Math.abs(addend2Start - addend2Friendly) <= 4`.
7. Stage 3 rounds: `Math.abs(addend1Start - addend1Friendly) >= 3` OR `Math.abs(addend2Start - addend2Friendly) >= 3` (wider gaps).

### AnswerComponent payload shape (PART-051)

`renderAnswerForRound(round, container)` paints a SOLVED, non-interactive view of each round:
- The two addend boxes side by side showing the **starting values** (e.g. `58` and `72`), with a faint `→` arrow and a second pair of boxes below showing the **friendly values** (`60` and `70`). The mathematical equivalence is visually scaffolded.
- A green tick badge with the **correct sum** (`130`) below the friendly pair.
- A short strategy statement banner above: e.g. *"58 + 72 = 60 + 70 = 130. Add 2 to one, subtract 2 from the other — the sum stays the same."*
- No +/- buttons, no Reset, no input box, no hearts, no progress bar.

The carousel has 9 slides (one per round). Slide titles: `Round 1`, `Round 2`, …, `Round 9`. Header label stays at default `Correct Answers!`. The component shows the active set's rounds (whichever set was played in the just-finished session — A, B, or C).

## Visual / Theme

- **Layout:** PART-021 standard mobile layout. Header (round counter + 3 hearts + 9-segment progress bar) on top. Workspace centred: two addend boxes side by side, +/- buttons stacked vertically beside each box (− above, + below). The big black `+` operator between the boxes is non-interactive, ~32 px font weight bold. Reset pill below the workspace (centred) on narrow viewports, or to the right on wider viewports. Numeric input below Reset, ~140 px wide × 56 px tall, font-size ≥ 16 px (mobile rule #28). Floating "Next Round" button (PART-050) at the bottom in submit mode.
- **Addend box dimensions on a 375 px-wide viewport:** ~104 px × 80 px each, with 8 px spacing to the +/- buttons. The +/- buttons are ~44 × 44 px each (mobile rule #9). The big `+` operator takes ~40 px between the boxes. Total workspace width ≈ 104 + 44 + 40 + 44 + 104 = 336 px, fits comfortably within 343 px content area. (Spacing between adjacent touch targets ≥ 8 px per mobile rule #10.)
- **Stage-1 box style:** 1 px solid `--mathai-color-border` (default grey), 12 px border-radius, white background, dark text.
- **Stage-2 box style:** 2 px solid soft blue (`--mathai-color-info` or equivalent — in the blue family that looks "informational" rather than "alert"), same dimensions.
- **Stage-3 box style:** back to default grey border but `font-weight: 700` on the addend digits (vs `font-weight: 500` in stages 1-2) — the extra visual weight signals the mastery zone.
- **+/- button style:** `−` on top in soft pink (`#FCDDE0` background, `#E63946` text); `+` on bottom in soft green (`#D4EFDF` background, `#2A9D8F` text). PART-022 secondary style baseline. `touch-action: manipulation` per mobile rule #19. Each tap shows a 100 ms scale-down (0.92) animation per CASE 17-style ambient feedback.
- **Reset pill:** PART-022 secondary style. Light grey background, `↺ Reset` label with the icon to the left of the text. ~120 × 44 px. `touch-action: manipulation`.
- **Numeric input:** white background, dark text, 1 px solid border, 12 px radius, font-size 24 px (well above the 16 px Safari-zoom threshold), `text-align: center`. `inputmode="numeric"`, `pattern="[0-9]*"`, `type="text"` (NEVER `type="number"`).
- **Big `+` operator between the boxes:** `font-size: 32px`, `font-weight: 700`, dark text. Non-interactive (`pointer-events: none`).
- **Hearts in the header:** 3 PART-023 standard red hearts. Heart-pop animation on life loss (~400 ms).
- **Progress bar:** 9 segments (one per round), filling left-to-right as rounds complete. PART-023 default style.
- **Correct-answer reveal animation:** the addend boxes animate from their last-displayed values to the round's `addend1Friendly` / `addend2Friendly` over ~500 ms (a smooth count animation), with a green tick badge fading in between them and the `=` sign appearing before the correct sum. This makes the compensation transformation visible to the student even if they didn't fully nudge to the friendly pair themselves.
- **Wrong-answer shake + reset:** input pill shakes with a 600 ms keyframe animation (`-6px → +6px → -6px → +6px → 0`, 4 cycles). After the shake, the addend boxes animate back to starting values over ~300 ms. Input clears after the shake.
- **Mobile compliance:** all rules in mobile/SKILL.md apply. `viewport meta` correct, `100dvh`, `overflow-x: hidden`, `overscroll-behavior: none`, `touch-action: manipulation` on all interactive elements (NOT on the addend boxes themselves, which are display-only), `-webkit-` prefixes paired with standard properties, no flexbox `gap` (margins or grid `gap`), `font-size: 16px+` on the input (Safari auto-zoom prevention).

## Out of Scope

- **No procedural number generation** — the 27 round contents (A/B/C × 9) are hand-authored in the spec and copied verbatim into `fallbackContent`.
- **No hint button** — creator explicitly says the +/- nudge mechanic IS the hint; no extra hint affordance.
- **No "show me the friendly pair" button mid-round** — students must discover the friendly pair themselves; the canonical pair is only revealed in the correct-answer feedback or on wrong-answer audio.
- **No timer** — creator explicitly says speed is not graded.
- **No drag-and-drop variant** — interaction pattern is button-nudge + numeric type.
- **No multi-step rounds** — every round is a single Submit-and-evaluate.
- **No leaderboard / streak tracking across sessions.**
- **No undo button beyond Reset** — Reset clears all nudges on the current round; no per-tap undo.
- **No custom feedback overlays** — FeedbackManager owns the overlay layer (CASE constraint).

## Decision-Points / Open Items

(For the creator and spec-review to confirm before Step 4 / Build.)

1. **Friendly-pair reveal animation on correct.** Spec proposes the addend boxes animate to the canonical friendly pair (`60 + 70`) on correct, even if the student left them at e.g. `60 + 72`. This makes the strategy explicit. Confirm: keep this reveal, or leave the addend boxes at whatever the student's last-displayed values were?
2. **+/- buttons at top vs side.** Spec puts `−` above each box and `+` below. An alternative is `−` to the left and `+` to the right of each box. Spec author chose top/bottom because it visually maps to "lower the number / raise the number" (down = decrease, up = increase) — a more intuitive metaphor than left/right. Confirm.
3. **Stage-2 visual cue (soft blue border).** Spec uses a soft blue colour from the `--mathai-color-info` family. If the colour palette doesn't include a clean info-blue, fall back to a slightly darker grey border. Confirm: pick a colour that reads as "different but not alarming".
4. **Reset behaviour on the input field.** Spec says Reset only clears the addend boxes, NOT the input field. Concept text is ambiguous ("boxes reset to starting values, input clears" — but that's described in the wrong-answer flow, not the Reset-button flow). Confirm: Reset preserves the input or clears it?
5. **Round 9 of Sets A/B/C uses non-multiple-of-10 friendly pairs.** Spec uses `40 + 81 = 121` for A_r9 and similar for B_r9 / C_r9. The compensation is still valid (sum unchanged), but the "friendly" value is not strictly a multiple of 10. Confirm: is this acceptable for Stage-3 mastery, or should Round 9 stick to multiple-of-10 friendly pairs even if the compensation amount is larger?
6. **Star rule's 1★ band is structurally rare.** As noted in the Star Generosity Audit, finishing all 9 rounds implies `firstTryCorrect ≥ 7` (because each wrong submit costs a life, and only 3 lives are available). The 1★ band only triggers in unusual edge cases. Confirm: leave the rubric as authored, or simplify to a 3⭐ / 2⭐ / 0⭐ system?
7. **Bold vs default font-weight for Stage-3.** Spec proposes `font-weight: 700` on the addend digits in Stage 3. An alternative is to use a different colour (e.g. dark blue) or no visual change at all. Confirm: keep the bold, or switch to colour, or no change?
8. **Wrong-answer TTS phrasing.** Spec uses *"Not quite — the sum of 58 and 72 is 130."* matching the concept doc. Confirm wording, or prefer a different phrasing (e.g. *"Try again — 58 plus 72 equals 130."*)?

## Defaults Applied

(Decisions NOT specified by the creator and filled by a default. Per spec-creation Step 3, `answerComponent` is silently `true` and is NOT listed here.)

- **Visual surface differentiation per stage** (default grey / soft blue / bolder weight): defaulted by spec author to make the difficulty step visible without text. Concept said only "soft blue border vs grey" for Stage 2; spec author extended to "bolder digit weight" for Stage 3 to keep the visual graduation across all three stages.
- **Friendly-pair reveal on correct** (addend boxes animate to canonical friendly pair): defaulted by spec author. Concept doesn't specify what the boxes show on correct.
- **Round-content (the 27 specific addend pairs across A/B/C × 9 rounds):** spec author authored from scratch under the constraints in the concept (Stage 1 ±1–4, Stage 2 tighter mixed-direction, Stage 3 ±3–5).
- **Misconception tag taxonomy (6 named tags):** defaulted by spec author. Concept named no specific misconceptions; spec author chose tags based on standard two-digit-addition misconception research.
- **Round 1 / 2 round-intro audio (auto-advancing):** defaulted to PART-024 standard auto-advance per CASE 2 Variant A.
- **Welcome screen audio:** defaulted to standard "Welcome to The Compensation Workout!" per archetype #3 + creator-titled game.
- **Difficulty curve / first-solve targets (~85 / 70 / 55%):** spec author defaulted per pedagogy.md L3 70-85% target, slightly aggressive on Stage 1 because the on-ramp is gentle.
- **Layout (workspace centred, header on top, FloatingButton at bottom):** PART-021 default mobile layout.
- **previewScreen: true** (PART-039 default; creator did not opt out).
- **showGameOnPreview: false** (the +/- mechanic is novel; preview overlay should not show the game state until the audio explains it).
- **autoShowStar: true** (default).
- **previewAudioText:** spec author drafted; will be patched into `previewAudio` at deploy time.
- **NCERT chapter alignment:** creator named only Class 4-5 grade band; spec author mapped to NCERT Class 4 / 5 chapters that touch number sense and benchmark numbers.
- **Bloom Level L3 Apply:** spec author defaulted (creator did not state Bloom level explicitly; the verbs "apply" and "internalise a strategy" point to L3, not L1/L2).
- **Wrong-feedback TTS reveals the correct sum** (verbose-but-helpful pattern): creator said *"the input shakes red, voice-over reads correct sum aloud"* — spec author kept this verbatim.
- **Per-round audio strings (`successAudio`, `failAudio`, etc.):** spec author authored per the concept's example *"Not quite — the sum of 58 and 72 is 130"*.
- **Pattern P-custom for the +/- nudge mechanic:** the +/- buttons are not a standard PART pattern (they mutate display-only scratchpad state, not graded state). Spec author flags this as a custom button-nudge UI element implemented inside the standard PART-027 Play Area, NOT a new CDN pattern.

(Per the spec-creation skill rule, `answerComponent: true` is the silent default and is NOT listed here. Creator did not opt out, so the carousel ships.)

## Warnings

- **WARNING: Custom button-nudge UI is not a standard PART pattern.** The +/- buttons that nudge the scratchpad addends are NOT P1 (MCQ), P2 (numeric typing), P5 (continuous drag), P6 (DnD), P7 (text input), P8 (click-to-toggle), or P13 (directional). They mutate display-only state without grading. Build step must implement this as plain HTML buttons with click handlers inside the PART-027 Play Area — NOT via a CDN component. The spec author notes this is structurally simple (4 buttons + 1 reset, all wired to local state mutators) and does not require an MCP-fetched library; Step 4 can run as `[SUB-AGENT]` per the orchestration override table.

- **WARNING: Retry-same-round on wrong is non-default for archetype #3.** The standard Lives Challenge advances to the next round on wrong (with a life decrement); this game STAYS on the same round and re-presents it after addends are reset. Implementation must NOT call `nextRound()` in the wrong-with-lives branch — instead call a `resetRoundForRetry()` helper that re-renders the same round (resets addend display, clears input, re-enables Submit, sets `isProcessing = false`, increments `attemptsOnThisRound` so a subsequent correct on this round is NOT counted as first-try). `currentRound` MUST NOT be incremented on wrong. Validator should NOT trip on this; verify with spec-review that no validator rule assumes round-advance-on-wrong.

- **WARNING: Star rubric uses `firstTryCorrect`, not `score`.** Standard archetype #3 uses score-based thresholds (90%/66%/33% of total rounds). This game uses first-attempt-correct count, which is a creator-specified deviation. `getStars()` MUST read `gameState.firstTryCorrect` (incremented only when `attemptsOnThisRound === 0` at correct submit) and `gameState.lives`. NOT score. The implementation must wire `attemptsOnThisRound` correctly — incremented on every wrong submit within a round, reset to 0 on round-advance.

- **WARNING: 1★ band is structurally rare.** As detailed in the Star Generosity Audit, finishing all 9 rounds implies `firstTryCorrect ≥ 7` (because 3 lives cap the wrong-submit count). The 1★ band only triggers if some future feature lets a student finish a round without solving it (e.g. a skip button — out of scope). Spec author kept the 1★ band as a defensive default per the creator's stated rubric. Spec-review may simplify if confirmed.

- **WARNING: PART-006 timer NOT included.** Per archetype anti-pattern #4 (updated): PART-006 is mandatory ONLY when `getStars()` reads elapsed time OR the preview text promises a speed gate. Neither applies here — `getStars()` reads only `firstTryCorrect` and `lives`, and the preview text explicitly says "No timer". Validator rule `TIMER-MANDATORY-WHEN-DURATION-VISIBLE` should NOT trip.

- **WARNING: Numeric input on cheap Android (P2).** Mobile rules #13, #15, #16, #17, #28 all apply. `type="text" inputmode="numeric" pattern="[0-9]*"` (NEVER `type="number"`). `font-size: 16px+` (Safari auto-zoom). FeedbackManager overlays MUST remain visible when keyboard is open (mobile rule #15 — CRITICAL). Enter key MUST submit (mobile rule #16 — CRITICAL). Do NOT auto-focus the input on round entry (mobile rule #17). The `visualViewport` listener (rule #14) keeps the workspace visible when the keyboard opens.

- **WARNING: Wrong-answer evaluator must compute candidate values from the misconception families.** The runtime needs to compute, for each named misconception, what value the student would have typed if they applied that misconception — and match the student's actual submission against the set. This is up to 6 named-misconception checks per round. Build step implements this as a small dispatch table per round (the values are pre-computed in `misconception_tags`, keyed by the candidate integer). On no match, fall back to `whole-rule-mismatch`.

- **WARNING: Compensation invariant must be verified at build time.** For every round, the build step MUST verify `addend1Start + addend2Start === addend1Friendly + addend2Friendly === correct`. If any round fails, fail loudly. This guarantees the friendly pair the game *reveals* on correct genuinely produces the same sum the student typed.

- **WARNING: Reset semantics — input not cleared.** Spec specifies that Reset only clears the addend boxes, NOT the numeric input. This is one of the Decision-Points (#4); the concept's wording is ambiguous. Spec-review must confirm. If creator prefers Reset to also clear the input, change the Reset handler to clear `inputEl.value` and re-disable the FloatingButton.

- **WARNING: Round 9 of all three sets uses non-multiple-of-10 friendly pairs.** A_r9 = `43 + 78 = 40 + 81 = 121`, B_r9 = `46 + 77 = 50 + 73 = 123`, C_r9 = `37 + 88 = 40 + 85 = 125`. The compensation is mathematically valid (sum invariant) but the "friendly" target isn't two multiples of 10. This is intentional for Stage-3 mastery (the student must commit to a friendly target that *one* side reaches a multiple of 10 and the other side ends up at an easier neighbour). Decision-Point #5 asks for confirmation. If creator prefers strict multiple-of-10 friendly pairs, the Round-9 contents need different addend pairs (e.g. `46 + 84 = 50 + 80 = 130`).

- **WARNING: 9 rounds at L3 Apply is at the upper end of pedagogy.md's L3 default (6-9).** This is creator-specified. Session length is bounded by no-timer + retry-on-wrong; creator estimates 4-7 minutes per session. Acceptable.

- **WARNING: 3 lives + retry-on-same-round means a single round can absorb up to 3 lives.** A student who gets a round wrong 3 times in a row exhausts all lives on that one round and triggers Game Over. This is the intended pedagogical pressure — but it means a struggling student on Round 1 may never reach Round 2. Implementation should handle this naturally (Game Over fires when `lives === 0` on any wrong submit). Spec-review may want to confirm with creator that a single-round-wipeout is acceptable failure mode.
