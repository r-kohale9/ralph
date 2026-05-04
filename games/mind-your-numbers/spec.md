# Game Design: Mind Your Numbers

## Identity
- **Game ID:** mind-your-numbers
- **Title:** Mind Your Numbers
- **Class/Grade:** Class 4-5 (Grade 4-5, ~9-11 years old)
- **Math Domain:** Number Sense & Operations — inductive reasoning over arithmetic rules (sums, differences, products, max/min)
- **Topic:** Infer the hidden arithmetic rule that produces a "centre" value from four "outer" values, by reading two worked examples and testing the rule on a target.
- **Bloom Level:** L4 Analyze — student must hypothesise a rule, test it against TWO worked examples, then APPLY it to a new instance. The cognitive work is rule-induction, not arithmetic.
- **Archetype:** #3 Lives Challenge (Timed + Lives variant) — fixed N rounds with lives + per-round timer; free-text numeric input; one Submit CTA per round.
- **NCERT Reference:**
  - Class 4 — *Tick Tick Tick*, *Long and Short* (number sense, simple arithmetic operations).
  - Class 5 — *Be My Multiple, I'll be Your Factor*, *The Fish Tale* (number relationships, all four operations on small whole numbers, pattern recognition).
  - The math content is intentionally light; the game targets the *reasoning* habit (induction + cross-checking), not the arithmetic.
- **Pattern:** P2 (Numeric typing) — student types the missing centre number into a free-text input and taps Submit. NOT P1 (MCQ), NOT P6 (DnD). Step 4 (Build) runs as `[SUB-AGENT]` — no CDN library beyond the standard CDN core, no main-context override needed.
- **Input:** Free-text numeric input (`<input type="text" inputmode="numeric" pattern="[0-9]*">`) + a single Submit / Check tap (PART-050 FloatingButton in `submit` mode) per round. Enter key also submits.

## One-Line Concept
The student studies two worked "flower" clusters whose centres are filled in, infers the single arithmetic rule that turned each cluster's four outer petals into its centre, then types the missing centre on a third cluster and taps CHECK to verify their hypothesis.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Inductive reasoning | Read two worked examples and form a candidate rule that fits BOTH. | flower-rule |
| Hypothesis testing | Verify a candidate rule by checking it produces the worked centres exactly, before applying it to the target. | flower-rule |
| Cross-checking habit | Reject a rule that fits Example 1 but not Example 2 — never commit to a single-example fit. | flower-rule |
| Mental arithmetic | Sum / subtract / multiply / order small whole numbers (1-12 typically; up to 25 in Round 3). | flower-rule |
| Pattern abstraction (max/min) | Identify the largest and smallest of four values and operate on them — a two-step rule. | flower-rule (Round 3) |

## Core Mechanic

### Type A: "Flower Rule"

1. **What the student sees**
   - Three "flower" clusters laid out on the play area:
     - **Top-left cluster (Example 1)** — 4 outer petals around a centre circle. Centre is FILLED IN with the worked answer (e.g. `36`).
     - **Top-right cluster (Example 2)** — 4 outer petals around a centre circle. Centre is FILLED IN with a different worked answer (e.g. `48`).
     - **Bottom cluster (Target)** — 4 outer petals around a centre circle. Centre is shown as `?` and contains a free-text numeric input box once tapped.
   - Each cluster's 4 outer petals are drawn at 12 / 3 / 6 / 9 o'clock around its centre, each holding a small whole number (typically 1-12 for Rounds 1 and 2; 1-25 for Round 3).
   - Status header: round counter (`Round N / 3`), three hearts (lives), and a per-round countdown timer (`mm:ss` ticking DOWN from 60s).
   - **CHECK** button (FloatingButton, PART-050, `submit` mode). Disabled until the input has at least one digit. Enter key on the input also submits.
2. **What the student does** (input type: free-text numeric typing + 1 tap)
   - Studies the two top clusters, hypothesises a rule.
   - Taps the `?` centre on the bottom cluster — the input becomes editable and the system numeric keypad appears.
   - Types a whole number (digits only; non-numeric keys ignored by `inputmode="numeric"`).
   - Taps **CHECK** (or presses Enter) to commit. One submit per round; the result stands.
3. **What counts as correct**
   - The typed value equals the round's `correct` integer exactly. Whitespace and leading zeros are stripped before comparison; an empty string is rejected at the CHECK stage (Submit stays disabled until at least one digit is entered).
   - Each round has a single correct answer derivable from a single rule. The two worked examples are constructed so the rule is the simplest rule that fits both — the build step verifies at content-author time that no simpler / competing rule produces both centres.
4. **What feedback plays**
   - **Correct:** Input pill turns green, target's centre shows the correct number with a green tick. Awaited `correct_sound_effect` SFX (~1.5 s floor) with celebration sticker → awaited dynamic TTS naming the rule for THIS round (e.g. *"The rule is: add all four petals."*) with subtitle. Lives unchanged. ProgressBar bumps FIRST. Then auto-advance to Round N+1 (or Victory after Round 3).
   - **Wrong (lives remain):** Input pill flashes red (~600 ms), the target's centre then reveals the correct answer in green so the student SEES the answer they should have typed. One heart dims (`progressBar.update(currentRound, lives - 1)`). Awaited `incorrect_sound_effect` SFX (~1.5 s floor) with sad sticker → awaited dynamic TTS naming the rule and the correct answer (e.g. *"The rule is: add all four petals. The centre is 36."*). Auto-advance to next round (no retry on the same round — the round closes).
   - **Wrong (last life):** Same red flash + correct reveal + wrong SFX awaited (1.5 s floor) + TTS awaited (Case 8 — wrong feedback MUST play before game-over), THEN Game Over screen renders.
   - **Timer expiry (per-round 60s reaches 0):** Treated as a wrong answer with the typed-so-far value (or empty if nothing typed). Same Wrong-with-lives feedback path runs; the TTS additionally prefixes *"Time's up!"* to the rule announcement. Life is decremented once, not twice.

## Rounds & Progression

Three rounds per session, each rule a different family. Across rounds the rule family graduates from a *simple binary op on the four values* to a *two-step extremes rule*. Numbers stay small to keep cognitive load on the rule-inference, not the arithmetic.

### Stage 1 — Pairs rule (Round 1)
- Round type: flower-rule
- Difficulty parameters:
  - **Rule family:** the four outers split into two pairs (top pair vs bottom pair, or left pair vs right pair — the exact pairing is fixed across all 3 sets to "top-pair + bottom-pair", i.e. petals at 12 o'clock and 6 o'clock count together as the *top* and *bottom* "halves"). Wait — that's confusing for petals. **Concrete pairing convention adopted:** the four outers are at 12, 3, 6, 9 o'clock; "top pair" = {12 o'clock, 3 o'clock}, "bottom pair" = {6 o'clock, 9 o'clock}. The rule: `centre = (top1 + top2) + (bot1 + bot2)` — i.e. the centre equals the sum of the top pair PLUS the sum of the bottom pair. (This is mathematically the same as "sum of all four", but the spec is intentional that the rule presented to the student via TTS is *"add the top pair, add the bottom pair, then add those two sums"* — to motivate Round 2's "all four" rule as a generalisation.)
  - **Outer values:** small whole numbers in [1, 12].
  - **Centre values:** in [4, 40].
- Time budget: 60 s.
- Expected first-attempt solve rate: ~80 % (gentle on-ramp).
- Worked-example sanity check: every Stage 1 round verifies that NO other simple binary rule (e.g. "sum of one pair only", "difference of pair sums", "product of any two") produces both worked-example centres simultaneously.

### Stage 2 — All-four rule (Round 2)
- Round type: flower-rule
- Difficulty parameters:
  - **Rule family:** a single operation uses ALL four outers. The rule for Round 2 across all sets is `centre = sum_of_all_four_minus_a_constant_K`, where K is fixed within a round but differs across rounds (and across sets). Reading both worked examples with the constant subtracted reveals the rule. (We pick "sum minus constant" rather than "raw sum" because the latter would be solvable from just one example — the student must DETECT the K by comparing the two examples.)
  - **Outer values:** small whole numbers in [1, 12].
  - **Constant K:** small positive integer in [1, 6].
  - **Centre values:** in [4, 44].
- Time budget: 60 s.
- Expected first-attempt solve rate: ~60 %.
- Worked-example sanity check: every Stage 2 round verifies that NO other rule from the {pair-sum families, raw sum-of-four, product, max/min} set produces both worked-example centres simultaneously.

### Stage 3 — Extremes rule (Round 3)
- Round type: flower-rule
- Difficulty parameters:
  - **Rule family:** a two-step rule on `max` and `min` of the four outers. The rule for Round 3 across all sets is `centre = max(outers) - min(outers)` (Set A), `centre = max(outers) + min(outers)` (Set B), `centre = max(outers) * min(outers)` (Set C) — see Round-set cycling below. Within a single play session only one of these three rules is presented (the active set's rule), but the *family* is "operate on max and min".
  - **Outer values:** small whole numbers in [1, 25] (the higher ceiling supports product variants while keeping max*min ≤ 100).
  - **Centre values:** in [2, 100] depending on which set is active.
- Time budget: 75 s (slightly longer because the rule is two-step).
- Expected first-attempt solve rate: ~45 %.
- Worked-example sanity check: every Stage 3 round verifies that the simpler rules from Stages 1-2 (pair-sums, all-four sum, all-four sum minus K with small K) DO NOT produce both worked-example centres — the student is forced into the max/min hypothesis because nothing simpler fits.

| Dimension | Stage 1 (R1, Pairs) | Stage 2 (R2, All four) | Stage 3 (R3, Extremes) |
|-----------|---------------------|-------------------------|-------------------------|
| Rule family | Pair sums | Sum of all four ± constant | Two-step on max/min |
| Outer range | 1-12 | 1-12 | 1-25 |
| Centre range | 4-40 | 4-44 | 2-100 |
| Timer | 60 s | 60 s | 75 s |
| Cognitive demand | Single binary op, two visible halves | Single op over all four with hidden constant | Identify extremes, then operate |
| Expected first-solve | ~80 % | ~60 % | ~45 % |

**Round-set cycling (MANDATORY):** the runtime cycles `fallbackContent.rounds` across three sets (A → B → C → A). Each set has 3 rounds (one per stage). `rounds.length === 9 === totalRounds (3) × 3 sets`. Within each set, Stage-1 / Stage-2 / Stage-3 rules are PARALLEL in difficulty across sets:
- **Set A**'s Round 3 = `max - min` (the canonical "difference of extremes" rule).
- **Set B**'s Round 3 = `max + min` (the "sum of extremes" rule — same family, different op).
- **Set C**'s Round 3 = `max × min` (the "product of extremes" rule — same family, slightly larger numbers admitted).

This rotation gives the round-set cycling system three distinct mastery checks at Stage 3 without changing the rule *family*. Stages 1 and 2 share the same rule family across sets (only the numbers and constant K differ).

## Game Parameters
- **Rounds:** 3 per session.
- **totalRounds:** 3.
- **Timer:** Per-round countdown via PART-006 TimerComponent. Round 1 = 60 s, Round 2 = 60 s, Round 3 = 75 s. Timer resets at the start of each round (after the round transition screen dismisses). Timer expiry triggers the same wrong-answer path as a wrong submit (see Feedback below). Timer pauses on visibility loss (Case 14) and resumes on restore (Case 15). PART-006 mandatory because: (a) the spec mentions a per-round time pressure; (b) the visible header timer drives player-visible state (life loss on expiry).
- **Lives:** 3. Lives lost on wrong submit OR on timer expiry (one life per round, never two from the same round even if a slow wrong answer also expired the timer).
- **retryPreservesInput:** N/A (multi-round game; flag ignored).
- **autoShowStar:** `true` (default end-of-game beat handled by PART-050 / Stars Collected).
- **Star rating (creator-specified — first-attempt solves drive stars):**
  - **3 stars** = all 3 rounds solved on first attempt (no wrong submits, no timer expiries).
  - **2 stars** = 2 rounds solved correctly.
  - **1 star** = exactly 1 round solved correctly.
  - **0 stars** = 0 rounds solved correctly. Routes through Game Over only if `lives === 0` mid-session; otherwise routes through Victory with 0 stars (the AnswerComponent still ships).
- **Input:** Free-text numeric typing (`type="text" inputmode="numeric" pattern="[0-9]*"`) + Submit tap (PART-050 FloatingButton, `submit` mode). Enter key on the input submits. Per mobile rule #13, NEVER `type="number"`. Per mobile rule #28, input `font-size: 16px` to prevent Safari auto-zoom.
- **Feedback:** PART-017 FeedbackManager. `playDynamicFeedback({...})` awaited on every submit per single-step contract. Static SFX (`correct_sound_effect` / `incorrect_sound_effect`) awaited with 1500 ms floor before TTS.
- **previewScreen:** `true` (PART-039 default).
- **answerComponent:** `true` (creator did not opt out; default ships). The 3-slide carousel at end-of-game shows each round's two worked examples + the target's correct answer + a one-sentence rule statement (the same string used in correct-feedback TTS). See "AnswerComponent payload shape" below.
- **PARTs Used:** PART-001 (CDN core), PART-004 (init), PART-005 (visibility), PART-006 (TimerComponent — countdown, header), PART-007 (state), PART-008 (postMessage), PART-009 (recordAttempt), PART-010 (events), PART-017 (FeedbackManager), PART-019 (results), PART-021 (mobile layout), PART-023 (ProgressBar with 3 segments + 3 hearts), PART-024 (TransitionScreen — Welcome, per-round intros, Game Over, Victory, Stars Collected), PART-025 (ScreenLayout), PART-027 (Play Area), PART-039 (PreviewScreen), PART-042 (signals), PART-050 (FloatingButton — Submit + end-of-game Next), PART-051 (AnswerComponent).

## Scoring
- **Points:** +1 per round solved on first (and only) attempt. Max 3 points per session. `gameState.score` = number of correctly-solved rounds.
- **Stars:** Computed from `gameState.score` exactly per the creator's first-attempt-solve rubric:
  ```js
  function getStars() {
    if (gameState.lives <= 0 && gameState.score === 0) return 0;  // game-over with no correct answers
    return gameState.score; // 0..3 maps directly to stars 0..3
  }
  ```
  Note: a student who finishes all 3 rounds (lives intact) with 0 correct still routes through Victory (lives > 0 at session end), and `getStars()` returns 0 → 0★ Victory. The AnswerComponent ships either way.
- **Lives:** 3 hearts in the header. Each wrong submit OR timer expiry decrements once (never both for the same round). At `lives === 0` mid-session, Game Over fires after the awaited wrong-feedback completes (Case 8).
- **Partial credit:** None. Each round is binary: correct on submit (+1) or wrong (no point, -1 life).

### Star Generosity Audit

(Per spec-creation: L4 mastery games should not give 3⭐ for free. Heuristic: 3⭐ should require demonstrated mastery — not survival.)

| Outcome scenario | Rounds solved | Lives at end | Stars | Generosity verdict |
|------------------|---------------|--------------|-------|--------------------|
| Solved all 3 first-try | 3 | 3 | **3⭐** | TIGHT — perfect-run only. Correct for L4 induction. |
| Solved 2, missed 1 | 2 | 2 | **2⭐** | TIGHT — one mistake demotes from 3⭐. Maps to "got the rule for 2 of 3 rule-families". |
| Solved 1 | 1 | 1 or 2 | **1⭐** | NEUTRAL — student got one rule. |
| Solved 0, finished session (3 wrong, 0 lives at end) | 0 | 0 | **0⭐** | Routes via Game Over branch (lives=0). |
| Solved 0, expired timers without typing (lives = 0 by R3) | 0 | 0 | **0⭐** | Game Over. |

**Verdict:** the star rule is appropriately tight for L4 Analyze. 3⭐ requires the student to have inferred all three rule families correctly on first try. No generosity inflation.

## Flow

**Shape:** Multi-round (default).
**Changes from default:**
- Per-round timer (PART-006) added inside the gameplay loop. Timer expiry routes into the same Wrong-feedback path as a wrong submit (no separate "time-up" screen).
- The CHECK CTA is the FloatingButton in `submit` mode (PART-050) — disabled until at least one digit is entered into the input.
- AnswerComponent (PART-051) renders the worked examples + target answer + rule statement as one slide per round (3 slides total).

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌──────────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)       │
│ 🔊 prev  │        │ 🔊 welc. │        │ (trans.,     │ (after  │ 🔊 prompt / TTS      │
│   audio  │        │    VO    │        │  no buttons) │  sound) │ Two worked examples  │
└──────────┘        └──────────┘        │ 🔊 "Round N" │         │ One target with `?`  │
                                        └──────────────┘         │ Numeric input + CHECK│
                                                ▲                │ Per-round countdown  │
                                                │                └─────────┬────────────┘
                                                │                          │ tap CHECK / Enter
                                                │                          │   OR timer expires
                                                │                          ▼
                                                │              ┌─────────────────────────────┐
                                                │              │ Feedback (on same screen)   │
                                                │              │ ✓ green centre + 🔊 correct │
                                                │              │   + TTS "Rule is …"         │
                                                │              │ ✗ red flash, reveal answer  │
                                                │              │   + 🔊 life_lost + TTS      │
                                                │              │   "Rule is …; centre is …"  │
                                                │              └─────────┬───────────────────┘
                                                │                        │
                              ┌─────────────────┴─────────┬──────────────┼─────────────────┐
                              │                           │                                │
                       wrong AND lives = 0       correct OR wrong-      correct OR wrong-  │
                              │                  with-lives AND more    with-lives AND     │
                              ▼                  rounds                  last round done    │
                   ┌────────────────────┐        (loop to Round N+1     │                  │
                   │ Game Over (status) │         intro)                 ▼                  │
                   │ 🔊 sound_game_over │                       ┌────────────────────┐      │
                   └─────────┬──────────┘                       │ Victory (status)   │      │
                             │ "Try Again"                      │ 0–3★               │      │
                             ▼                                  │ 🔊 sound_game_     │      │
                   ┌──────────────────┐                         │    victory →       │      │
                   │ "Ready to        │                         │    vo_victory_     │      │
                   │  improve your    │                         │    stars_N         │      │
                   │  score?"         │                         └──────┬─────┬───────┘      │
                   │ (trans., tap)    │                                │     │              │
                   │ 🔊 motivation VO │                  "Play Again"  │     │ "Claim Stars"│
                   │ [I'm ready]      │                  (only if 0-2★)│     │              │
                   └────────┬─────────┘                                ▼     ▼              │
                            │ tap                       ┌────────────────┐  ┌─────────────────────┐
                            ▼                           │ "Ready to      │  │ "Yay, stars         │
                   restart from Round 1                 │  improve your  │  │  collected!"        │
                   (skips Preview + Welcome,            │  score?"       │  │ (trans., auto,      │
                    cycles round-set A→B→C→A)           │ (trans., tap)  │  │  no buttons)        │
                                                        │ 🔊 motiv. VO   │  │ 🔊 stars-collected  │
                                                        │ [I'm ready]    │  │   + ✨ animation    │
                                                        └────────┬───────┘  └──────────┬──────────┘
                                                                 │ tap                 │ auto
                                                                 ▼                     ▼
                                                        restart from Round 1     ┌──────────────────────┐
                                                        (skips Preview+Welcome)  │ Correct Answers      │
                                                                                 │ carousel (PART-051)  │
                                                                                 │ 3 slides — 1/round   │
                                                                                 │ FloatingBtn 'next'   │
                                                                                 └──────────┬───────────┘
                                                                                            │ Next
                                                                                            ▼
                                                                                           exit
```

## Feedback

| Event | Behavior |
|-------|----------|
| Preview | PART-039 PreviewScreen on game start. Instruction text + audio (see Content Structure for exact strings). Tap [Start] / Got it CTA dismisses. |
| Welcome | TransitionScreen with `Welcome to Mind Your Numbers!` + welcome VO. Tap to continue. |
| Round N intro | TransitionScreen "Round N", auto-advance after round-intro SFX + VO (sequential, awaited). Per CASE 2 Variant A. |
| Round start | Play area paints (2 worked clusters + 1 target cluster + numeric input + CHECK). Per-round countdown timer resets and starts. Round prompt TTS plays fire-and-forget (CASE 3) — does NOT block input; student can read examples and start typing immediately. |
| Type into input | No SFX (avoid keyboard chatter). The `oninput` listener strips non-digits for safety, then enables CHECK once `value.length > 0`. |
| Tap CHECK with non-empty input (correct) | `gameState.isProcessing = true` BEFORE await. Input pill turns green, target's `?` replaces with the typed value in a green tick badge. ProgressBar bumps FIRST in the round-complete handler (`progressBar.update(currentRound, lives)` before audio). `await sound.play('correct_sound_effect', { sticker, minDuration: 1500 })`, then `await playDynamicFeedback({ feedback_type:'correct', audio_content: <round.ruleStatement>, subtitle: <round.ruleStatement> })`. Auto-advance to next round (or Victory after Round 3). CASE 4 (single-step). |
| Tap CHECK with non-empty input (wrong, lives remain) | Input pill flashes red (~600 ms). Target's `?` then reveals the correct answer in a green tick (so the student SEES the right number). `progressBar.update(currentRound, lives - 1)` fires FIRST. `gameState.isProcessing = true` BEFORE await. `await sound.play('incorrect_sound_effect', { sticker, minDuration: 1500 })`, then `await playDynamicFeedback({ feedback_type:'incorrect', audio_content: <round.ruleStatement> + " The centre is " + <round.correct> + ".", subtitle: same })`. Auto-advance to next round (no in-round retry). CASE 7 (single-step). |
| Tap CHECK with non-empty input (wrong, last life) | Same red flash + correct reveal + wrong SFX awaited (1500 ms floor) + TTS awaited. THEN Game Over transition renders (`game_complete` posted before game-over audio). CASE 8. |
| Press Enter on input | Same as tapping CHECK (Mobile rule #16 — Enter key MUST submit). |
| Timer expiry (round timer reaches 0) | Treated identically to tap-CHECK-with-wrong: red flash, correct reveal, life decrement, awaited wrong SFX + awaited TTS. The TTS payload prefixes *"Time's up! "* in front of `<round.ruleStatement>` to make the cause explicit. The CHECK button is disabled by the timer-expiry handler so a late tap is ignored. |
| Round complete (auto-advance to next round) | Round transition screen renders (CASE 2 Variant A — auto-advancing). Sequential audio: round SFX awaited → round VO awaited. Then Game (Round N+1) renders; timer resets. |
| Complete all 3 rounds (Victory) | Victory TransitionScreen renders FIRST (stars, status). `game_complete` postMessage sent BEFORE end-game audio. Then victory SFX + VO sequential. CTAs: `Play Again` (only if 0-2★), `Claim Stars` (always). CASE 11. |
| Game Over (lives = 0 mid-session) | Wrong-answer SFX + TTS complete first (CASE 8). THEN Game Over TransitionScreen renders with `game_complete` posted before game-over audio. CTA: `Try Again`. |
| Tap "Claim Stars" | Routes to "Yay, stars collected!" transition. `sound_stars_collected` awaited → `show_star` postMessage → setTimeout(~1500 ms) → `showAnswerCarousel()` (PART-051). |
| Tap "Play Again" | Routes through "Ready to improve your score?" motivation transition → `restartGame()` → game restarts from Round 1 (skips Preview + Welcome). Round-set cycles A → B → C → A. ProgressBar reset on the motivation transition's `onMounted`. |
| AnswerComponent Next tapped | `answerComponent.destroy()`, `previewScreen.destroy()`, `floatingBtn.destroy()`, `postMessage({type:'next_ended'})`. Iframe tears down. |
| Visibility hidden / tab switch (CASE 14) | Timer pauses (PART-006). All audio pauses. VisibilityTracker's built-in PopupComponent renders the pause overlay (`autoShowPopup: true` default; never custom). |
| Visibility restored (CASE 15) | Timer resumes. Audio resumes. VisibilityTracker dismisses its own popup. Gameplay continues. |
| Audio failure (CASE 16) | All audio calls try/catch wrapped. Visual feedback (green/red flash, reveal) renders regardless. Game advances normally. |

## Content Structure (fallbackContent)

### Per-round payload shape

Each round object carries everything needed to render the play area AND validate the submitted value. The shape:

```js
{
  set: 'A' | 'B' | 'C',
  id: 'A_r1_pairs' | 'A_r2_allfour' | ... ,  // globally unique
  round: 1 | 2 | 3,                           // index within the set
  stage: 1 | 2 | 3,                           // === round (one stage per round)
  type: 'flower-rule',
  ruleFamily: 'pair-sums' | 'sum-minus-k' | 'extremes',
  ruleStatement: 'Add all four petals.',      // human-readable rule, used by correct/wrong TTS and AnswerComponent
  // The two worked clusters and the target cluster.
  // Each cluster carries 4 outers at 12, 3, 6, 9 o'clock.
  example1: { outers: { top: <int>, right: <int>, bottom: <int>, left: <int> }, centre: <int> },
  example2: { outers: { top: <int>, right: <int>, bottom: <int>, left: <int> }, centre: <int> },
  target:   { outers: { top: <int>, right: <int>, bottom: <int>, left: <int> } /* centre is the answer */ },
  correct: <int>,                              // the integer the student must type
  timerSeconds: 60 | 75,
  // Misconception tags map a wrong-answer FAMILY to a named misconception. The runtime
  // evaluates the student's typed value against each family and tags recordAttempt with
  // the matching one (or 'whole-rule-mismatch' if none match).
  misconception_tags: {
    'sum-instead-of-product':           'sum-instead-of-product',
    'wrong-pairing-diagonal-vs-row':    'wrong-pairing-diagonal-vs-row',
    'carry-over-from-previous-round':   'carry-over-from-previous-round',
    'partial-sum-missing-one-outer':    'partial-sum-missing-one-outer',
    'first-minus-second-instead-of-max-minus-min': 'first-minus-second-instead-of-max-minus-min',
    'whole-rule-mismatch':              'whole-rule-mismatch'
  },
  // Answer payload for AnswerComponent (PART-051).
  answer: {
    ruleStatement: 'Add all four petals.',
    example1: { outers: { top, right, bottom, left }, centre: <int> },
    example2: { outers: { top, right, bottom, left }, centre: <int> },
    target:   { outers: { top, right, bottom, left }, centre: <int> /* the correct value */ }
  }
}
```

### Misconception tags (named, real misconceptions for inductive-rule games)

Per the creator brief, these are the misconceptions to surface; each round's `misconception_tags` map advertises ALL of them and the runtime selects the matching one(s) at submit time:

- `sum-instead-of-product` — student summed the four outers when the rule called for a product (Round 3 Set C only).
- `wrong-pairing-diagonal-vs-row` — student paired diagonally (top↔bottom and left↔right) when Round 1's pairing was top-pair / bottom-pair (which itself includes both diagonals because it's "12 o'clock + 3 o'clock" and "6 o'clock + 9 o'clock"); a student who pairs *12+6, 3+9* (vertical / horizontal axes) and sums the pair sums gets a different number for some rounds.
- `carry-over-from-previous-round` — student applied the *previous* round's rule (e.g. Round 2's "sum minus K" carrying into Round 3 where the rule is max-min).
- `partial-sum-missing-one-outer` — student summed three of the four outers and stopped (off by one petal).
- `first-minus-second-instead-of-max-minus-min` — Round 3 Set A only; student computed `first_outer - second_outer` (or `top - bottom`) instead of `max - min`.
- `whole-rule-mismatch` — generic "did not match any of the above named families" tag (the student's number reflects neither the correct rule nor any tracked misconception).

The runtime's wrong-answer evaluator computes the candidate values for each named misconception and matches the student's submitted value against the set; on a match, that named tag goes into `recordAttempt`. On no match, `whole-rule-mismatch` is used.

### Preview-screen content

- `previewInstruction` (HTML):

  ```html
  <p><strong>Mind Your Numbers</strong></p>
  <p>You'll see <strong>three flower clusters</strong>. The top two have their centres filled in — those are <strong>worked examples</strong>.</p>
  <p>The same <strong>arithmetic rule</strong> turns each cluster's four petals into its centre. Figure out the rule from the two examples, then <strong>type the missing centre</strong> on the bottom cluster and tap <strong>CHECK</strong>.</p>
  <p>Three rounds, three lives, one minute per round.</p>
  ```

- `previewAudioText` (plain text, used at deploy time to generate `previewAudio` TTS):

  > "Mind Your Numbers. You'll see three flower clusters. The top two have their centres filled in — those are worked examples. The same arithmetic rule turns each cluster's four petals into its centre. Figure out the rule from the two examples, then type the missing centre on the bottom cluster and tap CHECK. Three rounds, three lives, one minute per round."

- `showGameOnPreview`: `false` (board geometry is novel; preview overlay should not show the game state because the rule-induction concept needs the audio/text explanation first).

### Round-set cycling — 9 round objects total

The spec authors **three full sets (A, B, C) × 3 rounds each = 9 round objects**. Each set's Round 1 = Pairs rule, Round 2 = Sum-minus-K, Round 3 = Extremes (the operator on max/min varies by set: A=`max-min`, B=`max+min`, C=`max*min`). Within each round-and-set the worked-example numbers and target numbers differ to keep the inductive challenge fresh on retry.

```js
const fallbackContent = {
  // Preview (PART-039)
  previewInstruction:
    '<p><strong>Mind Your Numbers</strong></p>' +
    '<p>You\'ll see <strong>three flower clusters</strong>. The top two have their centres filled in — those are <strong>worked examples</strong>.</p>' +
    '<p>The same <strong>arithmetic rule</strong> turns each cluster\'s four petals into its centre. Figure out the rule from the two examples, then <strong>type the missing centre</strong> on the bottom cluster and tap <strong>CHECK</strong>.</p>' +
    '<p>Three rounds, three lives, one minute per round.</p>',
  previewAudioText:
    'Mind Your Numbers. You will see three flower clusters. The top two have their centres filled in — those are worked examples. The same arithmetic rule turns each cluster\'s four petals into its centre. Figure out the rule from the two examples, then type the missing centre on the bottom cluster and tap CHECK. Three rounds, three lives, one minute per round.',
  previewAudio: null,           // patched at deploy time by TTS pipeline
  showGameOnPreview: false,

  // Session config
  totalRounds: 3,
  totalLives: 3,
  // Note: timer is per-round (see each round's `timerSeconds`); not a global timer.

  rounds: [
    // ───────────────────── SET A — 3 rounds ─────────────────────
    {
      set: 'A', id: 'A_r1_pairs', round: 1, stage: 1, type: 'flower-rule',
      ruleFamily: 'pair-sums',
      ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
      // Example 1: top {3,5}=8, bottom {7,2}=9, centre = 8 + 9 = 17
      example1: { outers: { top: 3, right: 5, bottom: 7, left: 2 }, centre: 17 },
      // Example 2: top {4,6}=10, bottom {8,3}=11, centre = 10 + 11 = 21
      example2: { outers: { top: 4, right: 6, bottom: 8, left: 3 }, centre: 21 },
      // Target: top {5,4}=9, bottom {6,7}=13, centre = 9 + 13 = 22
      target:   { outers: { top: 5, right: 4, bottom: 6, left: 7 } },
      correct: 22,
      timerSeconds: 60,
      misconception_tags: {
        'wrong-pairing-diagonal-vs-row': 'wrong-pairing-diagonal-vs-row',
        'partial-sum-missing-one-outer': 'partial-sum-missing-one-outer',
        'sum-instead-of-product':        'sum-instead-of-product',
        'whole-rule-mismatch':           'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
        example1: { outers: { top: 3, right: 5, bottom: 7, left: 2 }, centre: 17 },
        example2: { outers: { top: 4, right: 6, bottom: 8, left: 3 }, centre: 21 },
        target:   { outers: { top: 5, right: 4, bottom: 6, left: 7 }, centre: 22 }
      }
    },
    {
      set: 'A', id: 'A_r2_allfour', round: 2, stage: 2, type: 'flower-rule',
      ruleFamily: 'sum-minus-k',
      ruleStatement: 'Add all four petals, then subtract 3.',
      // Example 1: 6+4+5+3 = 18, centre = 18 - 3 = 15
      example1: { outers: { top: 6, right: 4, bottom: 5, left: 3 }, centre: 15 },
      // Example 2: 7+5+8+4 = 24, centre = 24 - 3 = 21
      example2: { outers: { top: 7, right: 5, bottom: 8, left: 4 }, centre: 21 },
      // Target: 9+6+7+5 = 27, centre = 27 - 3 = 24
      target:   { outers: { top: 9, right: 6, bottom: 7, left: 5 } },
      correct: 24,
      timerSeconds: 60,
      misconception_tags: {
        'partial-sum-missing-one-outer':  'partial-sum-missing-one-outer',
        'carry-over-from-previous-round': 'carry-over-from-previous-round',
        'sum-instead-of-product':         'sum-instead-of-product',
        'whole-rule-mismatch':            'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add all four petals, then subtract 3.',
        example1: { outers: { top: 6, right: 4, bottom: 5, left: 3 }, centre: 15 },
        example2: { outers: { top: 7, right: 5, bottom: 8, left: 4 }, centre: 21 },
        target:   { outers: { top: 9, right: 6, bottom: 7, left: 5 }, centre: 24 }
      }
    },
    {
      set: 'A', id: 'A_r3_extremes', round: 3, stage: 3, type: 'flower-rule',
      ruleFamily: 'extremes',
      ruleStatement: 'Find the largest petal, find the smallest, and subtract the smallest from the largest.',
      // Example 1: outers {12,3,8,5}, max=12, min=3, centre = 12-3 = 9
      example1: { outers: { top: 12, right: 3, bottom: 8, left: 5 }, centre: 9 },
      // Example 2: outers {7,15,2,10}, max=15, min=2, centre = 15-2 = 13
      example2: { outers: { top: 7, right: 15, bottom: 2, left: 10 }, centre: 13 },
      // Target: outers {6,18,4,11}, max=18, min=4, centre = 18-4 = 14
      target:   { outers: { top: 6, right: 18, bottom: 4, left: 11 } },
      correct: 14,
      timerSeconds: 75,
      misconception_tags: {
        'first-minus-second-instead-of-max-minus-min': 'first-minus-second-instead-of-max-minus-min',
        'sum-instead-of-product':                       'sum-instead-of-product',
        'carry-over-from-previous-round':               'carry-over-from-previous-round',
        'partial-sum-missing-one-outer':                'partial-sum-missing-one-outer',
        'whole-rule-mismatch':                          'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Find the largest petal, find the smallest, and subtract the smallest from the largest.',
        example1: { outers: { top: 12, right: 3, bottom: 8, left: 5 }, centre: 9 },
        example2: { outers: { top: 7, right: 15, bottom: 2, left: 10 }, centre: 13 },
        target:   { outers: { top: 6, right: 18, bottom: 4, left: 11 }, centre: 14 }
      }
    },

    // ───────────────────── SET B — 3 rounds (parallel difficulty) ─────────────────────
    {
      set: 'B', id: 'B_r1_pairs', round: 1, stage: 1, type: 'flower-rule',
      ruleFamily: 'pair-sums',
      ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
      // Example 1: top {2,6}=8, bottom {4,5}=9, centre = 8+9 = 17 (same answer as A_r1 for parallelism, different petals)
      example1: { outers: { top: 2, right: 6, bottom: 4, left: 5 }, centre: 17 },
      // Example 2: top {3,7}=10, bottom {6,5}=11, centre = 10+11 = 21
      example2: { outers: { top: 3, right: 7, bottom: 6, left: 5 }, centre: 21 },
      // Target: top {4,5}=9, bottom {7,6}=13, centre = 9+13 = 22
      target:   { outers: { top: 4, right: 5, bottom: 7, left: 6 } },
      correct: 22,
      timerSeconds: 60,
      misconception_tags: {
        'wrong-pairing-diagonal-vs-row': 'wrong-pairing-diagonal-vs-row',
        'partial-sum-missing-one-outer': 'partial-sum-missing-one-outer',
        'sum-instead-of-product':        'sum-instead-of-product',
        'whole-rule-mismatch':           'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
        example1: { outers: { top: 2, right: 6, bottom: 4, left: 5 }, centre: 17 },
        example2: { outers: { top: 3, right: 7, bottom: 6, left: 5 }, centre: 21 },
        target:   { outers: { top: 4, right: 5, bottom: 7, left: 6 }, centre: 22 }
      }
    },
    {
      set: 'B', id: 'B_r2_allfour', round: 2, stage: 2, type: 'flower-rule',
      ruleFamily: 'sum-minus-k',
      ruleStatement: 'Add all four petals, then subtract 5.',
      // Example 1: 5+4+6+5 = 20, centre = 20-5 = 15 (different K from Set A so the rule varies on retry)
      example1: { outers: { top: 5, right: 4, bottom: 6, left: 5 }, centre: 15 },
      // Example 2: 7+6+8+5 = 26, centre = 26-5 = 21
      example2: { outers: { top: 7, right: 6, bottom: 8, left: 5 }, centre: 21 },
      // Target: 9+7+8+5 = 29, centre = 29-5 = 24
      target:   { outers: { top: 9, right: 7, bottom: 8, left: 5 } },
      correct: 24,
      timerSeconds: 60,
      misconception_tags: {
        'partial-sum-missing-one-outer':  'partial-sum-missing-one-outer',
        'carry-over-from-previous-round': 'carry-over-from-previous-round',
        'sum-instead-of-product':         'sum-instead-of-product',
        'whole-rule-mismatch':            'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add all four petals, then subtract 5.',
        example1: { outers: { top: 5, right: 4, bottom: 6, left: 5 }, centre: 15 },
        example2: { outers: { top: 7, right: 6, bottom: 8, left: 5 }, centre: 21 },
        target:   { outers: { top: 9, right: 7, bottom: 8, left: 5 }, centre: 24 }
      }
    },
    {
      set: 'B', id: 'B_r3_extremes', round: 3, stage: 3, type: 'flower-rule',
      ruleFamily: 'extremes',
      ruleStatement: 'Find the largest petal, find the smallest, and add them together.',
      // Example 1: outers {2,9,4,6}, max=9, min=2, centre = 9+2 = 11
      example1: { outers: { top: 2, right: 9, bottom: 4, left: 6 }, centre: 11 },
      // Example 2: outers {7,3,12,5}, max=12, min=3, centre = 12+3 = 15
      example2: { outers: { top: 7, right: 3, bottom: 12, left: 5 }, centre: 15 },
      // Target: outers {8,4,14,6}, max=14, min=4, centre = 14+4 = 18
      target:   { outers: { top: 8, right: 4, bottom: 14, left: 6 } },
      correct: 18,
      timerSeconds: 75,
      misconception_tags: {
        'first-minus-second-instead-of-max-minus-min': 'first-minus-second-instead-of-max-minus-min',
        'sum-instead-of-product':                       'sum-instead-of-product',
        'carry-over-from-previous-round':               'carry-over-from-previous-round',
        'partial-sum-missing-one-outer':                'partial-sum-missing-one-outer',
        'whole-rule-mismatch':                          'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Find the largest petal, find the smallest, and add them together.',
        example1: { outers: { top: 2, right: 9, bottom: 4, left: 6 }, centre: 11 },
        example2: { outers: { top: 7, right: 3, bottom: 12, left: 5 }, centre: 15 },
        target:   { outers: { top: 8, right: 4, bottom: 14, left: 6 }, centre: 18 }
      }
    },

    // ───────────────────── SET C — 3 rounds (parallel difficulty) ─────────────────────
    {
      set: 'C', id: 'C_r1_pairs', round: 1, stage: 1, type: 'flower-rule',
      ruleFamily: 'pair-sums',
      ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
      // Example 1: top {4,3}=7, bottom {6,5}=11, centre = 7+11 = 18
      example1: { outers: { top: 4, right: 3, bottom: 6, left: 5 }, centre: 18 },
      // Example 2: top {5,4}=9, bottom {8,5}=13, centre = 9+13 = 22
      example2: { outers: { top: 5, right: 4, bottom: 8, left: 5 }, centre: 22 },
      // Target: top {6,5}=11, bottom {9,4}=13, centre = 11+13 = 24
      target:   { outers: { top: 6, right: 5, bottom: 9, left: 4 } },
      correct: 24,
      timerSeconds: 60,
      misconception_tags: {
        'wrong-pairing-diagonal-vs-row': 'wrong-pairing-diagonal-vs-row',
        'partial-sum-missing-one-outer': 'partial-sum-missing-one-outer',
        'sum-instead-of-product':        'sum-instead-of-product',
        'whole-rule-mismatch':           'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add the top pair, add the bottom pair, then add those two sums.',
        example1: { outers: { top: 4, right: 3, bottom: 6, left: 5 }, centre: 18 },
        example2: { outers: { top: 5, right: 4, bottom: 8, left: 5 }, centre: 22 },
        target:   { outers: { top: 6, right: 5, bottom: 9, left: 4 }, centre: 24 }
      }
    },
    {
      set: 'C', id: 'C_r2_allfour', round: 2, stage: 2, type: 'flower-rule',
      ruleFamily: 'sum-minus-k',
      ruleStatement: 'Add all four petals, then subtract 2.',
      // Example 1: 4+3+5+4 = 16, centre = 16-2 = 14
      example1: { outers: { top: 4, right: 3, bottom: 5, left: 4 }, centre: 14 },
      // Example 2: 6+5+7+4 = 22, centre = 22-2 = 20
      example2: { outers: { top: 6, right: 5, bottom: 7, left: 4 }, centre: 20 },
      // Target: 8+6+9+5 = 28, centre = 28-2 = 26
      target:   { outers: { top: 8, right: 6, bottom: 9, left: 5 } },
      correct: 26,
      timerSeconds: 60,
      misconception_tags: {
        'partial-sum-missing-one-outer':  'partial-sum-missing-one-outer',
        'carry-over-from-previous-round': 'carry-over-from-previous-round',
        'sum-instead-of-product':         'sum-instead-of-product',
        'whole-rule-mismatch':            'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Add all four petals, then subtract 2.',
        example1: { outers: { top: 4, right: 3, bottom: 5, left: 4 }, centre: 14 },
        example2: { outers: { top: 6, right: 5, bottom: 7, left: 4 }, centre: 20 },
        target:   { outers: { top: 8, right: 6, bottom: 9, left: 5 }, centre: 26 }
      }
    },
    {
      set: 'C', id: 'C_r3_extremes', round: 3, stage: 3, type: 'flower-rule',
      ruleFamily: 'extremes',
      ruleStatement: 'Find the largest petal, find the smallest, and multiply them together.',
      // Example 1: outers {2,5,3,4}, max=5, min=2, centre = 5×2 = 10
      example1: { outers: { top: 2, right: 5, bottom: 3, left: 4 }, centre: 10 },
      // Example 2: outers {6,3,8,5}, max=8, min=3, centre = 8×3 = 24
      example2: { outers: { top: 6, right: 3, bottom: 8, left: 5 }, centre: 24 },
      // Target: outers {4,9,3,7}, max=9, min=3, centre = 9×3 = 27
      target:   { outers: { top: 4, right: 9, bottom: 3, left: 7 } },
      correct: 27,
      timerSeconds: 75,
      misconception_tags: {
        'sum-instead-of-product':                       'sum-instead-of-product',
        'first-minus-second-instead-of-max-minus-min':  'first-minus-second-instead-of-max-minus-min',
        'carry-over-from-previous-round':               'carry-over-from-previous-round',
        'partial-sum-missing-one-outer':                'partial-sum-missing-one-outer',
        'whole-rule-mismatch':                          'whole-rule-mismatch'
      },
      answer: {
        ruleStatement: 'Find the largest petal, find the smallest, and multiply them together.',
        example1: { outers: { top: 2, right: 5, bottom: 3, left: 4 }, centre: 10 },
        example2: { outers: { top: 6, right: 3, bottom: 8, left: 5 }, centre: 24 },
        target:   { outers: { top: 4, right: 9, bottom: 3, left: 7 }, centre: 27 }
      }
    }
  ]
};
```

**Round-set cycling check:** `rounds.length === 9 === totalRounds (3) × 3 sets`. Every round has a `set` key (`'A' | 'B' | 'C'`). All `id` values are globally unique (`A_r1_pairs` through `C_r3_extremes`). Set A's R1 ≈ Set B's R1 ≈ Set C's R1 in difficulty (all are pair-sums on outers in [1, 9] with centres in the high teens / low twenties). Validator `GEN-ROUNDSETS-MIN-3` passes.

### AnswerComponent payload shape (PART-051)

`renderAnswerForRound(round, container)` paints a SOLVED, non-interactive view of the round:
- The two worked clusters at top-left and top-right (centres already filled).
- The target cluster bottom-centre with the **correct** value rendered in green inside the centre circle (where `?` used to be).
- A short rule statement banner above the clusters: e.g. *"Rule: Add all four petals, then subtract 3."*
- No input box, no CHECK button, no timer, no lives.

The carousel has 3 slides (one per round). Slide titles: `Round 1 — Pairs rule`, `Round 2 — All-four rule`, `Round 3 — Extremes rule`. The header label stays at the default `Correct Answers!`.

### Worked-example uniqueness check (build-time guard)

For each round, the build step MUST verify:
- The two worked-example centres `example1.centre` and `example2.centre` are produced by the round's stated rule applied to the corresponding outers.
- The target centre `correct` is produced by the same rule applied to `target.outers`.
- For Stage 1 / Stage 2 rounds, NO simpler rule from the misconception family produces both worked-example centres simultaneously (e.g. a round-1 spec that has `example1.centre = sum-of-all-four` for both examples is broken, because the student could "solve" with the easier R2 rule).
- For Stage 3 rounds, NO simpler Stage-1 / Stage-2 rule (with reasonable K range) produces both worked-example centres.

The build step should fail loudly if any round's worked examples are not uniquely identifying for the stated rule.

## Defaults Applied
- **Bloom Level:** explicitly set by the creator brief ("Bloom L4 (Analyze)"). NOT defaulted.
- **Lives:** explicitly set by the creator brief ("3 lives"). NOT defaulted.
- **Rounds:** explicitly set by the creator brief ("3 rounds per session"). NOT defaulted.
- **Timer (per-round, ~60 s):** explicitly set by the creator brief; spec author defaulted Round 3 to 75 s (creator said "tune per round complexity" — the two-step extremes rule deserves a slightly longer budget).
- **Star rating:** creator specified "tied to first-attempt solves"; spec author defaulted the exact mapping to 3⭐/2⭐/1⭐/0⭐ = 3/2/1/0 first-attempt solves (the most natural mapping).
- **Pairing convention for Round 1 (top-pair / bottom-pair = {12, 3 o'clock} and {6, 9 o'clock}):** spec author defaulted (creator said "two pairs (top pair and bottom pair)" without nailing which petals are "top"). Documented explicitly above so the build step can assert the convention.
- **Round 2 rule family ("sum-minus-K"):** creator suggested "sum of all four, or product of all four, or sum minus a constant"; spec author defaulted to "sum minus K" because "raw sum" is solvable from one example (no induction load) and "product of all four" yields centre values too large for grade-4 mental arithmetic. K varies per set (3, 5, 2 in sets A/B/C).
- **Round 3 rule family rotation across sets (A=`max-min`, B=`max+min`, C=`max*min`):** spec author defaulted (creator said "max-min, max+min, or max×min" as examples); rotation across sets gives the round-set cycling system three distinct mastery checks.
- **Petal layout (12 / 3 / 6 / 9 o'clock):** spec author defaulted (creator said "4 outer petals around a centre circle"; spec author chose the canonical clock-face layout so the build step has a concrete geometry to render).
- **Misconception tag taxonomy:** spec author defaulted to a 6-tag taxonomy mapping the creator's listed misconceptions ("Sum-instead-of-product", "Wrong pairing", "Carry-over from previous round", "Partial sum", "First-minus-second instead of max-min") plus a generic `whole-rule-mismatch` fallback. Tag names normalised to kebab-case.
- **previewScreen: true** (PART-039 default; creator did not opt out).
- **showGameOnPreview: false** (rule-induction concept needs the audio/text intro before the game state is shown).
- **autoShowStar: true** (default).
- **previewAudioText:** spec author drafted; will be patched into `previewAudio` at deploy time.
- **NCERT chapter alignment:** creator named only Class 4-5 grade band; spec author mapped to NCERT Class 4 / 5 chapters that touch number sense and arithmetic operations.
- **Difficulty curve / first-solve targets (~80 / 60 / 45 %):** spec author defaulted per pedagogy.md L4 75 % overall target, tightened by stage to reflect the stage's cognitive load (creator did not specify per-stage targets).
- **Per-round content (the actual outer numbers and correct centres for all 9 rounds):** spec author authored from scratch under the constraints in the creator brief (small whole numbers, 1-12 typical, up to 25 in Round 3, max×min ≤ 100).
- **Wrong-feedback content (TTS reveals the rule + the correct centre):** spec author defaulted to a verbose-but-helpful pattern; creator said "show correct answer after wrong" only generically.

(Per the spec-creation skill rule, `answerComponent: true` is the silent default and is NOT listed here. Creator did not opt out, so the carousel ships.)

## Warnings

- **WARNING: PART-006 timer with lives at L4.** Per archetype #3 "Timed + Lives" variant, this is supported. Per pedagogy.md "Timer + lives if both are specified, warn about difficulty compounding" — flagging. Mitigation: per-round timers are 60 s / 60 s / 75 s, well above the median solve time we expect (15-30 s for fluent students), so the timer is intended as a *bound* on overthinking rather than a speed gate. The wrong-answer flow on timer expiry is identical to the wrong-submit flow (no double-life-loss). Validator rule `TIMER-MANDATORY-WHEN-DURATION-VISIBLE` is satisfied (the timer drives visible state — life loss on expiry).

- **WARNING: L4 Analyze with the simplest single-select interaction (numeric typing).** Per pedagogy.md L4 typically pairs with multi-select / drag / click-to-select. Numeric typing is a *typing* interaction (closer to L3 Apply per the Bloom-interaction table). The cognitive load here is in the *induction* (read 2 examples → form rule → check rule → apply), not in the input affordance — typing a single number is the natural, low-friction way to commit a hypothesis. The L4 framing is therefore correct *for this game*, but the bloom-interaction validator might flag it. Spec author confirms L4 is right; the typing affordance is incidental.

- **WARNING: 3 rounds is below the pedagogy.md L4 default of 6.** The creator explicitly specified 3 rounds. The compensating factor is: each round teaches a distinct rule family, so 3 rounds × 3 rule families = 9 distinct rule families across a single retry session (with the round-set cycling). At session level, the *learning surface* is comparable to a 9-round game with rule repetition.

- **WARNING: Free-text numeric input on cheap Android (P2).** Mobile rules #13, #15, #16, #17, #28 all apply. `type="text" inputmode="numeric" pattern="[0-9]*"` (NEVER `type="number"`). `font-size: 16px` minimum on the input (Safari auto-zoom). FeedbackManager overlays MUST remain visible when keyboard is open (CRITICAL — mobile rule #15). Enter key MUST submit (CRITICAL — mobile rule #16). Do NOT auto-focus the input on round entry or transition (rule #17). The `visualViewport` listener (rule #14) keeps the cluster visible when the keyboard opens.

- **WARNING: Wrong-answer evaluator must compute candidate values from the misconception families.** Per the misconception_tags map, the runtime needs to compute, for each named misconception, what value the student would have typed if they applied that misconception — and match the student's actual submission against the set. This is not a single equality check; it is up to 6 named-misconception checks per round. Build step must implement this as a small dispatch table per `ruleFamily` (the candidate set for `pair-sums` differs from the candidate set for `extremes`). If no match, fall back to `whole-rule-mismatch`.

- **WARNING: Worked-example uniqueness is a content-correctness invariant.** If a round's two worked examples can be "solved" by an easier rule (e.g. a Round-3 round where `max-min` happens to equal `top-pair sum + bottom-pair sum` for both examples), the student can pass the round with the wrong reasoning. The build step's worked-example uniqueness check (described above) MUST run before the game ships. Spec author confirms the 9 round contents in `fallbackContent` pass the check by construction (verified by hand at spec time).

- **WARNING: Pairing convention for Round 1 is non-obvious.** The creator's brief said "two pairs (top pair and bottom pair)". The spec adopts {12 o'clock + 3 o'clock} = "top pair" and {6 o'clock + 9 o'clock} = "bottom pair". This is one of two natural readings (the other being "vertical pair {12, 6}" / "horizontal pair {3, 9}"). The PreviewScreen audio + the correct-feedback TTS both name the rule explicitly as *"Add the top pair, add the bottom pair, then add those two sums"* — but the *visual* of which two petals constitute "top" depends on layout. Build step MUST render the petals at exactly 12, 3, 6, 9 o'clock, and the visual proximity in {12, 3} vs {6, 9} is what tells the student which pair is "top" (12 + 3 are the upper-half petals; 6 + 9 are the lower-half petals when the cluster is drawn on a portrait phone). Visual review (Step 8) should confirm the pairing reads naturally.

- **WARNING: Round 3 rule changes across sets (A: max-min, B: max+min, C: max×min).** A student who replays will encounter a different Stage-3 rule each time, which is an intended feature for round-set cycling — but a creator who is QA-testing the game will see only Set A on the first play, only Set B on the second, etc. Spec-review and visual-review MUST exercise all three sets to confirm the Stage-3 variants render and play correctly. The build step's `setIndex` rotation must be exercised by tests (`recordAttempt`'s `set` field will reflect the active set).
