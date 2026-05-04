# Game Design: Doubles — Doubling Speed Challenge

## Identity
- **Game ID:** doubles
- **Title:** Doubles — Doubling Speed Challenge
- **Class/Grade:** Class 2–4 (Grade 2–4, ~7–10 years old)
- **Math Domain:** Number Sense & Operations — multiplication / mental arithmetic
- **Topic:** 2× table fluency (doubling small whole numbers from memory)
- **Bloom Level:** L1 Remember (fact retrieval / fluency, not first exposure)
- **Archetype:** #3 Lives Challenge — fixed N rounds with 3 lives + an auxiliary stopwatch (PART-006) used to measure per-round response time so stars can be awarded by *average correct-answer time*. The timer is NOT a countdown (no time-up game-over); it is a count-up stopwatch driving the star calculation. Lives = 3, wrong answer costs 1 life, 0 lives = early Game Over.
- **NCERT Reference:** Class 2 NCERT Math Magic Chapter 6 "Footprints" / Class 3 NCERT Chapter "Give and Take" — multiplication tables and doubling.
- **Pattern:** P1 (single-tap MCQ) — three pill-button options, no submit step. PART-050 is NOT required (auto-evaluate on tap; the only FloatingButton presence is the canonical end-of-game `'next'` mode that every multi-round game wires per PART-050 sub-rule "Next button at end-of-game").

## One-Line Concept
The student sees "Double of N" and taps the correct double from three pill-shaped MCQ options as fast as possible across 15 rounds, chasing a sub-2-second average to earn three stars while keeping three dark hearts alive.

## Target Skills

| Skill | Description | Round Type |
|-------|-------------|------------|
| Fact fluency for ×2 | Retrieve `2 × N` from memory rather than computing `N + N`. Speed gates the star tier. | doubles-mcq |
| Speed under light pressure | Answer quickly under the soft motivation of three lives and a visible stopwatch. | doubles-mcq |
| Distractor discrimination | Reject near-miss answers (off-by-one, off-by-two, "added 10 instead of doubled") instantly. | doubles-mcq |

## Core Mechanic

### Type A: "Doubles MCQ"

1. **What the student sees**
   - The platform header (ActionBar) shows the game title and the `0/3` star slot.
   - A round counter (round N of 15) and three dark heart icons (filled = remaining lives) sit at the top of `#gameContent`.
   - A count-up stopwatch (mm:ss) ticks in the header so the student can feel their own pace. The stopwatch starts at the first round-prompt paint and persists across rounds; it pauses on visibility-hidden, end-of-round feedback, and end-of-game.
   - A large prompt line in the upper-middle of the play area: **"Double of N"** (e.g. "Double of 6").
   - Three pill-shaped MCQ buttons below the prompt, each ≥44×44 CSS px, ≥8 px apart, in the lower 60% (thumb zone). The three numbers are the correct double and two distractors (see § Distractor design).
2. **What the student does** (input type: single tap, no submit)
   - Taps exactly one pill. There is no submit / check / done step. The tap commits the answer.
3. **What counts as correct**
   - The tapped value equals `2 × N` for the displayed N.
4. **What feedback plays** (per feedback/SKILL.md CASE 4 / CASE 7 / CASE 8)
   - **Correct tap:** input blocked (`isProcessing = true`); the tapped pill turns green; awaited `correct_sound_effect` (with celebration sticker, ~1.5 s floor) → awaited `playDynamicFeedback({audio_content, subtitle, sticker})` where `audio_content` and `subtitle` come from the round's paired `correctTTS` / `correctSubtitle` fields (e.g. `audio_content: "Nice — double of 6 is 12"`, `subtitle: "Double of 6 is 12"`). Round response-time recorded against the round's `responseMs`. Then auto-advance to the next round.
   - **Wrong tap (lives remain):** input blocked; the tapped pill flashes red; the correct pill simultaneously highlights green so the student sees the right answer; one heart goes dim; awaited `incorrect_sound_effect` (with sad sticker, ~1.5 s floor) → awaited `playDynamicFeedback({audio_content: round.wrongTTS, subtitle: round.wrongSubtitle, sticker})` where `wrongTTS` is the verbatim creator-quoted line `"Double of N is 2N"` (e.g. "Double of 6 is 12") and `wrongSubtitle` is the same line ≤60 chars. Wrong-round response time is NOT counted in the star average. Then auto-advance to the next round.
   - **Wrong tap (last life lost → Game Over, CASE 8):** wrong-answer SFX + sticker still play (awaited, ~1.5 s) BEFORE Game Over so the student sees the violated answer; then the canonical Game Over flow renders.

## Rounds & Progression

15 rounds across three stages of 5 each, plus an inter-stage **breather** transition between Stage 1↔2 and Stage 2↔3. The breather shows the student's average correct-answer time so far and reminds them of the 2-second target. Rounds within a stage draw N from the stage's number band; each set (A / B / C) uses a different sub-band of the same stage so a Try Again replay is fresh practice rather than memorisation.

### Stage 1: Easy doubles (Rounds 1–5)
- Round type: doubles-mcq
- Difficulty parameters: N drawn from the small-friendly band {6, 7, 8, 9, 10, 11, 12}. Distractors stay in the off-by-one / off-by-two band.
- Score event per round: +1 if correct; on correct, the round's response time joins the star-average pool.

### Stage 2: Medium doubles (Rounds 6–10)
- Round type: doubles-mcq
- Difficulty parameters: N drawn from the mid-range band {13, 14, 15, 16, 17}. Distractors include the "added 10 instead of doubled" misconception (`N + 10`) alongside off-by-one / off-by-two.
- Score event per round: +1 if correct.

### Stage 3: Harder doubles (Rounds 11–15)
- Round type: doubles-mcq
- Difficulty parameters: N drawn from the larger band {18, 19, 20, 21, 22, 23, 24, 25}, including doubles that cross a decade (e.g. `2 × 18 = 36`, `2 × 23 = 46`). Distractors include all three misconception families.
- Score event per round: +1 if correct.

### Inter-stage breather (after Round 5 and after Round 10)
- Transition screen titled "Stage N complete" (auto-dismiss after dynamic TTS, optional `[I'm ready]` CTA per default Round-N transition contract).
- Subtitle / TTS reads the current `avgCorrectMs` and reminds of the 2-second target — e.g. `"Average so far: 2.3 seconds. Aim for under 2 seconds for three stars."`. The exact narration string is generated at runtime from the live average; this is the only inter-stage screen text the spec mandates.

| Dimension | Stage 1 (R1–R5) | Stage 2 (R6–R10) | Stage 3 (R11–R15) |
|-----------|-----------------|-------------------|---------------------|
| N range | {6–12} | {13–17} | {18–25} including cross-decade |
| Distractor families used | off-by-one, off-by-two | off-by-one, off-by-two, +10 | off-by-one, off-by-two, +10 |
| Crosses a decade? | No | Sometimes | Yes (most) |

## Game Parameters
- **Rounds:** 15 (3 stages × 5 rounds)
- **Timer:** Stopwatch (count-up, no expiry). PART-006 included; used to capture per-round `responseMs` and to surface elapsed time in the header. The game does NOT end on timer expiry.
- **Lives:** 3 (dark hearts; see § Diff)
- **retryPreservesInput:** N/A (multi-round)
- **autoShowStar:** `true` (default, fired from Stars Collected per default-transition-screens.md § 4)
- **Star rating:** 3 stars = `avgCorrectMs < 2000` AND ≥1 correct round; 2 stars = `2000 ≤ avgCorrectMs ≤ 3500` AND ≥1 correct round; 1 star = `avgCorrectMs > 3500` OR any other completed run with ≥1 correct round; 0 stars = Game Over with 0 correct rounds.
- **Star denominator (`y`):** `3` (default; not declared in `game_init`).
- **Input:** Single tap on one of three MCQ pill buttons. No submit step. No drag, no typing.
- **Feedback:** FeedbackManager — CASE 4 / CASE 7 / CASE 8 (single-step). SFX awaited then dynamic TTS awaited per round, both wrapped in `try/catch`.

## Stars contract (read before defining scoring)

Stars in the platform ActionBar represent overall game performance, awarded once at end-of-game via `show_star`. The numerator increments only via `show_star.data.count`; default baseline `0/3` is set by `game_init`. The doubles game fires a single `show_star` at end-of-game with `count = earnedStars` (computed from the rule below). No mid-game header mutation.

## Scoring
- **Points:** +1 per correct answer.
- **Stars:** computed from `avgCorrectMs = mean(responseMs across rounds where correct === true)` AND `correctCount = number of correct rounds`:
  - **3★** if `correctCount ≥ 1` AND `avgCorrectMs < 2000`
  - **2★** if `correctCount ≥ 1` AND `2000 ≤ avgCorrectMs ≤ 3500`
  - **1★** if `correctCount ≥ 1` AND `avgCorrectMs > 3500`
  - **1★** also awarded for any completed-run shape (15 rounds played) with ≥1 correct, even if `avgCorrectMs` puts the student in the 1★ bucket
  - **0★** if `correctCount === 0` (only reachable on Game Over after 3 wrong taps with no correct in between)
- **Lives:** 3 dark hearts. -1 heart per wrong tap. At 0 hearts the game ends early on Game Over (CASE 8 + canonical Game Over screen).
- **Partial credit:** None.

## Flow

**Shape:** Multi-round (default) + customizations.
**Changes from default:**
- Insert an **inter-stage breather** transition between Round 5 and Round 6, and between Round 10 and Round 11. Each breather displays the running `avgCorrectMs` and the 2-second target reminder, then auto-advances (or `[I'm ready]` CTA) into the next stage's first Round-N intro. (Triggered by the creator's "Between stages, a quick pause shows the student their average time so far" line; matches flow-gallery.md row "Stats + intro after each section".)
- Lives display in the progress bar uses **dark hearts** (color override) instead of the default red hearts. (Triggered by "Lives are dark hearts, not the usual red.")

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game       │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ (round N)  │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │ 🔊 prompt  │
│   audio  │        │    VO    │        │ 🔊 "Round N" │         │    / TTS   │
└──────────┘        └──────────┘        └──────────────┘         └─────┬──────┘
                                                ▲                      │ player taps pill
                                                │                      ▼
                                                │            ┌─────────────────────┐
                                                │            │ Feedback (CASE 4/7) │
                                                │            │ ✓ correct SFX→TTS   │
                                                │            │ ✗ incorrect SFX→TTS │
                                                │            │   + heart dims      │
                                                │            └─────────┬───────────┘
                                                │                      │
                              ┌─────────────────┴─────┬────────────────┼──────────────┐
                              │                       │                               │
                        wrong AND lives = 0   correct AND more   correct AND last round
                              │                rounds                  │
                              │            (after R5 / R10:             │
                              │             Stage breather              │
                              │             ─▶ Round N+1 intro)        │
                              ▼                                         ▼
                   ┌────────────────────┐                     ┌────────────────────┐
                   │ Game Over (status) │                     │ Victory (status)   │
                   │ 🔊 sound_game_over │                     │ 1–3★ via avg time  │
                   └─────────┬──────────┘                     │ 🔊 victory / game_ │
                             │ "Try Again"                    │    complete →      │
                             ▼                                │    vo_victory_     │
                   ┌──────────────────┐                       │    stars_N         │
                   │ "Ready to        │                       └──────┬─────┬───────┘
                   │  improve your    │                              │     │
                   │  score?"         │                "Play Again"  │     │ "Claim Stars"
                   │ (trans., tap)    │                (only if      │     │
                   │ 🔊 motivation VO │                 1–2 ★)       ▼     ▼
                   │ [I'm ready]      │                 ┌──────────────────┐  ┌──────────────────────┐
                   └────────┬─────────┘                 │ "Ready to        │  │ "Yay, stars          │
                            │ tap                       │  improve your    │  │  collected!"         │
                            ▼                           │  score?"         │  │ (trans., persist,    │
                   restart from Round 1                 │ (trans., tap)    │  │  no buttons)         │
                   (skips Preview + Welcome,            │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                   round-set cycles A → B → C → A)      │ [I'm ready]      │  │   ─▶ AnswerComponent │
                                                        └────────┬─────────┘  │     carousel         │
                                                                 │ tap        └──────────┬───────────┘
                                                                 ▼                       │ tap Next
                                                        restart from Round 1             ▼
                                                        (skips Preview + Welcome,        exit
                                                         round-set cycles)
```

Inter-stage breather inserts between R5↔R6 and R10↔R11 on the auto-advance arrow back to "Round N intro" in the diagram above.

## Feedback

| Event | Behavior |
|-------|----------|
| Round prompt appears | Stopwatch resumes; `tap_sound` (ambient, fire-and-forget) on first paint of round body. No round-start TTS (the prompt "Double of N" is visually self-evident; an optional read-aloud is offered as a Suggestion). |
| Correct tap | CASE 4 — input blocked → green pill flash → awaited `correct_sound_effect` (with celebration sticker) → awaited `playDynamicFeedback({audio_content: round.correctTTS, subtitle: round.correctSubtitle, sticker})` → response-time recorded → auto-advance. |
| Wrong tap (lives remain) | CASE 7 — input blocked → red flash on tapped pill + green highlight on correct pill → one heart dims (progress bar update) → awaited `incorrect_sound_effect` (sad sticker) → awaited `playDynamicFeedback({audio_content: round.wrongTTS, subtitle: round.wrongSubtitle, sticker})` → wrong-round time excluded from average → auto-advance. |
| Lose last life | CASE 8 — full wrong-answer SFX + TTS sequence plays first, then canonical Game Over transition; `game_complete` posted before end-of-game audio. |
| Stage 1 / 2 complete (after R5, R10) | Inter-stage breather transition — TTS and on-screen subtitle quote the live `avgCorrectMs` plus the 2-second reminder; auto-advance (or `[I'm ready]` CTA) to next stage's Round N intro. |
| Complete all 15 rounds | Canonical Victory + Stars Collected + AnswerComponent carousel (PART-051). Star count = `getStars()` from the average-time formula. `show_star` fires from Stars Collected `onMounted`. |
| Visibility hidden / restored | CASE 14 / CASE 15 — VisibilityTracker auto-popup; stopwatch and audio pause/resume. |

## Content Structure (fallbackContent)

Top-level fields:
- `previewScreen: true` (default — preview shown).
- `previewInstruction:` HTML string explaining the rules in one short paragraph plus a one-line target ("Tap the double — under 2 seconds for 3 stars.").
- `previewAudioText:` plain-text narration patched at deploy time by the TTS pipeline.
- `previewAudio: null` (filled at deploy time).
- `showGameOnPreview: false`.
- `totalRounds: 15`, `totalLives: 3`.
- `answerComponent: true` (default — carousel ships).

**Per-round answer payload schema (PART-051).** Each round carries:

```
answer: {
  prompt: 'Double of N',
  options: [a, b, c],
  correctIndex: <0|1|2>,
  correctValue: 2*N,
  explanation: 'Double of N is 2*N'   // rendered as the slide caption
}
```

The carousel slide renders the prompt, the three pill row in solved state (all three rendered, the `correctIndex` chip highlighted green, the others dimmed), and the explanation caption — input affordances are read-only.

**Round-set cycling.** `rounds.length === 15 × 3 = 45`. Each round carries `set: 'A' | 'B' | 'C'` and a globally unique id (`A_r1_…`, `B_r1_…`, `C_r1_…`). Set A's Round K, Set B's Round K, and Set C's Round K share the same stage and the same distractor profile (parallel difficulty, different N).

**Per-round TTS / Subtitle pairing (spec-creation/SKILL.md § 5e-i).** Every round stores `correctTTS` / `correctSubtitle` and `wrongTTS` / `wrongSubtitle`. By design these pair the same content word ("Double of N is 2N") so the subtitle is grounded in the audio.

**Distractor families used per round** (every wrong option carries a misconception tag):
- `off-by-one` — wrong answer is `2N ± 1` (kid wrote down the next/previous number).
- `off-by-two` — wrong answer is `2N ± 2` (kid added the wrong neighbour).
- `added-10-instead-of-doubled` — wrong answer is `N + 10` (kid confused doubling with the +10 rule).

Every round entry has the shape:

```js
{
  set: 'A',
  id: 'A_r1_double-6',
  round: 1,
  stage: 1,
  type: 'A',
  n: 6,
  prompt: 'Double of 6',
  options: [12, 11, 14],          // shuffled at runtime; correct stays at correctIndex
  correctIndex: 0,
  correctValue: 12,
  correctTTS: 'Nice — double of 6 is 12.',
  correctSubtitle: 'Double of 6 is 12.',
  wrongTTS: 'Double of 6 is 12.',
  wrongSubtitle: 'Double of 6 is 12.',
  misconception_tags: {
    '11': 'off-by-one',
    '14': 'off-by-two'
  },
  answer: {
    prompt: 'Double of 6',
    options: [12, 11, 14],
    correctIndex: 0,
    correctValue: 12,
    explanation: 'Double of 6 is 12'
  }
}
```

The complete `rounds` array (all 45 entries — 3 sets × 15 rounds; option order shown is canonical, build randomises):

```js
const fallbackContent = {
  previewInstruction: '<p><b>Tap the double!</b> See a number — pick its double from the three pills. Three dark hearts, fifteen rounds.</p><p>Aim under <b>2 seconds</b> per double for <b>3 stars</b>.</p>',
  previewAudioText: 'See a number, then tap its double. Try to answer in under two seconds for three stars. You have three lives — three wrong taps and the game ends.',
  previewAudio: null,
  showGameOnPreview: false,
  totalRounds: 15,
  totalLives: 3,
  answerComponent: true,
  rounds: [
    // ── Set A — 15 rounds ──
    // Stage 1 — Easy (N from {6..12})
    { set:'A', id:'A_r1_double-6',  round:1,  stage:1, type:'A', n:6,  prompt:'Double of 6',  options:[12,11,14], correctIndex:0, correctValue:12, correctTTS:'Nice — double of 6 is 12.',  correctSubtitle:'Double of 6 is 12.',  wrongTTS:'Double of 6 is 12.',  wrongSubtitle:'Double of 6 is 12.',  misconception_tags:{ '11':'off-by-one', '14':'off-by-two' }, answer:{ prompt:'Double of 6',  options:[12,11,14], correctIndex:0, correctValue:12, explanation:'Double of 6 is 12' } },
    { set:'A', id:'A_r2_double-8',  round:2,  stage:1, type:'A', n:8,  prompt:'Double of 8',  options:[16,15,18], correctIndex:0, correctValue:16, correctTTS:'Nice — double of 8 is 16.',  correctSubtitle:'Double of 8 is 16.',  wrongTTS:'Double of 8 is 16.',  wrongSubtitle:'Double of 8 is 16.',  misconception_tags:{ '15':'off-by-one', '18':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 8',  options:[16,15,18], correctIndex:0, correctValue:16, explanation:'Double of 8 is 16' } },
    { set:'A', id:'A_r3_double-10', round:3,  stage:1, type:'A', n:10, prompt:'Double of 10', options:[20,19,22], correctIndex:0, correctValue:20, correctTTS:'Nice — double of 10 is 20.', correctSubtitle:'Double of 10 is 20.', wrongTTS:'Double of 10 is 20.', wrongSubtitle:'Double of 10 is 20.', misconception_tags:{ '19':'off-by-one', '22':'off-by-two' }, answer:{ prompt:'Double of 10', options:[20,19,22], correctIndex:0, correctValue:20, explanation:'Double of 10 is 20' } },
    { set:'A', id:'A_r4_double-11', round:4,  stage:1, type:'A', n:11, prompt:'Double of 11', options:[22,21,24], correctIndex:0, correctValue:22, correctTTS:'Nice — double of 11 is 22.', correctSubtitle:'Double of 11 is 22.', wrongTTS:'Double of 11 is 22.', wrongSubtitle:'Double of 11 is 22.', misconception_tags:{ '21':'off-by-one', '24':'off-by-two' }, answer:{ prompt:'Double of 11', options:[22,21,24], correctIndex:0, correctValue:22, explanation:'Double of 11 is 22' } },
    { set:'A', id:'A_r5_double-12', round:5,  stage:1, type:'A', n:12, prompt:'Double of 12', options:[24,23,22], correctIndex:0, correctValue:24, correctTTS:'Nice — double of 12 is 24.', correctSubtitle:'Double of 12 is 24.', wrongTTS:'Double of 12 is 24.', wrongSubtitle:'Double of 12 is 24.', misconception_tags:{ '23':'off-by-one', '22':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 12', options:[24,23,22], correctIndex:0, correctValue:24, explanation:'Double of 12 is 24' } },
    // Stage 2 — Medium (N from {13..17})
    { set:'A', id:'A_r6_double-13', round:6,  stage:2, type:'A', n:13, prompt:'Double of 13', options:[26,23,25], correctIndex:0, correctValue:26, correctTTS:'Nice — double of 13 is 26.', correctSubtitle:'Double of 13 is 26.', wrongTTS:'Double of 13 is 26.', wrongSubtitle:'Double of 13 is 26.', misconception_tags:{ '23':'added-10-instead-of-doubled', '25':'off-by-one' }, answer:{ prompt:'Double of 13', options:[26,23,25], correctIndex:0, correctValue:26, explanation:'Double of 13 is 26' } },
    { set:'A', id:'A_r7_double-14', round:7,  stage:2, type:'A', n:14, prompt:'Double of 14', options:[28,24,27], correctIndex:0, correctValue:28, correctTTS:'Nice — double of 14 is 28.', correctSubtitle:'Double of 14 is 28.', wrongTTS:'Double of 14 is 28.', wrongSubtitle:'Double of 14 is 28.', misconception_tags:{ '24':'added-10-instead-of-doubled', '27':'off-by-one' }, answer:{ prompt:'Double of 14', options:[28,24,27], correctIndex:0, correctValue:28, explanation:'Double of 14 is 28' } },
    { set:'A', id:'A_r8_double-15', round:8,  stage:2, type:'A', n:15, prompt:'Double of 15', options:[30,25,29], correctIndex:0, correctValue:30, correctTTS:'Nice — double of 15 is 30.', correctSubtitle:'Double of 15 is 30.', wrongTTS:'Double of 15 is 30.', wrongSubtitle:'Double of 15 is 30.', misconception_tags:{ '25':'added-10-instead-of-doubled', '29':'off-by-one' }, answer:{ prompt:'Double of 15', options:[30,25,29], correctIndex:0, correctValue:30, explanation:'Double of 15 is 30' } },
    { set:'A', id:'A_r9_double-16', round:9,  stage:2, type:'A', n:16, prompt:'Double of 16', options:[32,26,30], correctIndex:0, correctValue:32, correctTTS:'Nice — double of 16 is 32.', correctSubtitle:'Double of 16 is 32.', wrongTTS:'Double of 16 is 32.', wrongSubtitle:'Double of 16 is 32.', misconception_tags:{ '26':'added-10-instead-of-doubled', '30':'off-by-two' }, answer:{ prompt:'Double of 16', options:[32,26,30], correctIndex:0, correctValue:32, explanation:'Double of 16 is 32' } },
    { set:'A', id:'A_r10_double-17',round:10, stage:2, type:'A', n:17, prompt:'Double of 17', options:[34,27,33], correctIndex:0, correctValue:34, correctTTS:'Nice — double of 17 is 34.', correctSubtitle:'Double of 17 is 34.', wrongTTS:'Double of 17 is 34.', wrongSubtitle:'Double of 17 is 34.', misconception_tags:{ '27':'added-10-instead-of-doubled', '33':'off-by-one' }, answer:{ prompt:'Double of 17', options:[34,27,33], correctIndex:0, correctValue:34, explanation:'Double of 17 is 34' } },
    // Stage 3 — Harder (N from {18..25}, cross-decade)
    { set:'A', id:'A_r11_double-18',round:11, stage:3, type:'A', n:18, prompt:'Double of 18', options:[36,28,35], correctIndex:0, correctValue:36, correctTTS:'Nice — double of 18 is 36.', correctSubtitle:'Double of 18 is 36.', wrongTTS:'Double of 18 is 36.', wrongSubtitle:'Double of 18 is 36.', misconception_tags:{ '28':'added-10-instead-of-doubled', '35':'off-by-one' }, answer:{ prompt:'Double of 18', options:[36,28,35], correctIndex:0, correctValue:36, explanation:'Double of 18 is 36' } },
    { set:'A', id:'A_r12_double-19',round:12, stage:3, type:'A', n:19, prompt:'Double of 19', options:[38,29,37], correctIndex:0, correctValue:38, correctTTS:'Nice — double of 19 is 38.', correctSubtitle:'Double of 19 is 38.', wrongTTS:'Double of 19 is 38.', wrongSubtitle:'Double of 19 is 38.', misconception_tags:{ '29':'added-10-instead-of-doubled', '37':'off-by-one' }, answer:{ prompt:'Double of 19', options:[38,29,37], correctIndex:0, correctValue:38, explanation:'Double of 19 is 38' } },
    { set:'A', id:'A_r13_double-21',round:13, stage:3, type:'A', n:21, prompt:'Double of 21', options:[42,31,40], correctIndex:0, correctValue:42, correctTTS:'Nice — double of 21 is 42.', correctSubtitle:'Double of 21 is 42.', wrongTTS:'Double of 21 is 42.', wrongSubtitle:'Double of 21 is 42.', misconception_tags:{ '31':'added-10-instead-of-doubled', '40':'off-by-two' }, answer:{ prompt:'Double of 21', options:[42,31,40], correctIndex:0, correctValue:42, explanation:'Double of 21 is 42' } },
    { set:'A', id:'A_r14_double-23',round:14, stage:3, type:'A', n:23, prompt:'Double of 23', options:[46,33,45], correctIndex:0, correctValue:46, correctTTS:'Nice — double of 23 is 46.', correctSubtitle:'Double of 23 is 46.', wrongTTS:'Double of 23 is 46.', wrongSubtitle:'Double of 23 is 46.', misconception_tags:{ '33':'added-10-instead-of-doubled', '45':'off-by-one' }, answer:{ prompt:'Double of 23', options:[46,33,45], correctIndex:0, correctValue:46, explanation:'Double of 23 is 46' } },
    { set:'A', id:'A_r15_double-25',round:15, stage:3, type:'A', n:25, prompt:'Double of 25', options:[50,35,48], correctIndex:0, correctValue:50, correctTTS:'Nice — double of 25 is 50.', correctSubtitle:'Double of 25 is 50.', wrongTTS:'Double of 25 is 50.', wrongSubtitle:'Double of 25 is 50.', misconception_tags:{ '35':'added-10-instead-of-doubled', '48':'off-by-two' }, answer:{ prompt:'Double of 25', options:[50,35,48], correctIndex:0, correctValue:50, explanation:'Double of 25 is 50' } },

    // ── Set B — 15 rounds (parallel difficulty, different N within the same stage band) ──
    // Stage 1
    { set:'B', id:'B_r1_double-7',  round:1,  stage:1, type:'A', n:7,  prompt:'Double of 7',  options:[14,13,16], correctIndex:0, correctValue:14, correctTTS:'Nice — double of 7 is 14.',  correctSubtitle:'Double of 7 is 14.',  wrongTTS:'Double of 7 is 14.',  wrongSubtitle:'Double of 7 is 14.',  misconception_tags:{ '13':'off-by-one', '16':'off-by-two' }, answer:{ prompt:'Double of 7',  options:[14,13,16], correctIndex:0, correctValue:14, explanation:'Double of 7 is 14' } },
    { set:'B', id:'B_r2_double-9',  round:2,  stage:1, type:'A', n:9,  prompt:'Double of 9',  options:[18,17,19], correctIndex:0, correctValue:18, correctTTS:'Nice — double of 9 is 18.',  correctSubtitle:'Double of 9 is 18.',  wrongTTS:'Double of 9 is 18.',  wrongSubtitle:'Double of 9 is 18.',  misconception_tags:{ '17':'off-by-one', '19':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 9',  options:[18,17,19], correctIndex:0, correctValue:18, explanation:'Double of 9 is 18' } },
    { set:'B', id:'B_r3_double-6',  round:3,  stage:1, type:'A', n:6,  prompt:'Double of 6',  options:[12,16,13], correctIndex:0, correctValue:12, correctTTS:'Nice — double of 6 is 12.',  correctSubtitle:'Double of 6 is 12.',  wrongTTS:'Double of 6 is 12.',  wrongSubtitle:'Double of 6 is 12.',  misconception_tags:{ '16':'added-10-instead-of-doubled', '13':'off-by-one' }, answer:{ prompt:'Double of 6',  options:[12,16,13], correctIndex:0, correctValue:12, explanation:'Double of 6 is 12' } },
    { set:'B', id:'B_r4_double-12', round:4,  stage:1, type:'A', n:12, prompt:'Double of 12', options:[24,22,23], correctIndex:0, correctValue:24, correctTTS:'Nice — double of 12 is 24.', correctSubtitle:'Double of 12 is 24.', wrongTTS:'Double of 12 is 24.', wrongSubtitle:'Double of 12 is 24.', misconception_tags:{ '22':'added-10-instead-of-doubled', '23':'off-by-one' }, answer:{ prompt:'Double of 12', options:[24,22,23], correctIndex:0, correctValue:24, explanation:'Double of 12 is 24' } },
    { set:'B', id:'B_r5_double-10', round:5,  stage:1, type:'A', n:10, prompt:'Double of 10', options:[20,21,18], correctIndex:0, correctValue:20, correctTTS:'Nice — double of 10 is 20.', correctSubtitle:'Double of 10 is 20.', wrongTTS:'Double of 10 is 20.', wrongSubtitle:'Double of 10 is 20.', misconception_tags:{ '21':'off-by-one', '18':'off-by-two' }, answer:{ prompt:'Double of 10', options:[20,21,18], correctIndex:0, correctValue:20, explanation:'Double of 10 is 20' } },
    // Stage 2
    { set:'B', id:'B_r6_double-14', round:6,  stage:2, type:'A', n:14, prompt:'Double of 14', options:[28,24,29], correctIndex:0, correctValue:28, correctTTS:'Nice — double of 14 is 28.', correctSubtitle:'Double of 14 is 28.', wrongTTS:'Double of 14 is 28.', wrongSubtitle:'Double of 14 is 28.', misconception_tags:{ '24':'added-10-instead-of-doubled', '29':'off-by-one' }, answer:{ prompt:'Double of 14', options:[28,24,29], correctIndex:0, correctValue:28, explanation:'Double of 14 is 28' } },
    { set:'B', id:'B_r7_double-15', round:7,  stage:2, type:'A', n:15, prompt:'Double of 15', options:[30,31,25], correctIndex:0, correctValue:30, correctTTS:'Nice — double of 15 is 30.', correctSubtitle:'Double of 15 is 30.', wrongTTS:'Double of 15 is 30.', wrongSubtitle:'Double of 15 is 30.', misconception_tags:{ '31':'off-by-one', '25':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 15', options:[30,31,25], correctIndex:0, correctValue:30, explanation:'Double of 15 is 30' } },
    { set:'B', id:'B_r8_double-16', round:8,  stage:2, type:'A', n:16, prompt:'Double of 16', options:[32,33,26], correctIndex:0, correctValue:32, correctTTS:'Nice — double of 16 is 32.', correctSubtitle:'Double of 16 is 32.', wrongTTS:'Double of 16 is 32.', wrongSubtitle:'Double of 16 is 32.', misconception_tags:{ '33':'off-by-one', '26':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 16', options:[32,33,26], correctIndex:0, correctValue:32, explanation:'Double of 16 is 32' } },
    { set:'B', id:'B_r9_double-17', round:9,  stage:2, type:'A', n:17, prompt:'Double of 17', options:[34,35,27], correctIndex:0, correctValue:34, correctTTS:'Nice — double of 17 is 34.', correctSubtitle:'Double of 17 is 34.', wrongTTS:'Double of 17 is 34.', wrongSubtitle:'Double of 17 is 34.', misconception_tags:{ '35':'off-by-one', '27':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 17', options:[34,35,27], correctIndex:0, correctValue:34, explanation:'Double of 17 is 34' } },
    { set:'B', id:'B_r10_double-13',round:10, stage:2, type:'A', n:13, prompt:'Double of 13', options:[26,23,28], correctIndex:0, correctValue:26, correctTTS:'Nice — double of 13 is 26.', correctSubtitle:'Double of 13 is 26.', wrongTTS:'Double of 13 is 26.', wrongSubtitle:'Double of 13 is 26.', misconception_tags:{ '23':'added-10-instead-of-doubled', '28':'off-by-two' }, answer:{ prompt:'Double of 13', options:[26,23,28], correctIndex:0, correctValue:26, explanation:'Double of 13 is 26' } },
    // Stage 3
    { set:'B', id:'B_r11_double-19',round:11, stage:3, type:'A', n:19, prompt:'Double of 19', options:[38,29,40], correctIndex:0, correctValue:38, correctTTS:'Nice — double of 19 is 38.', correctSubtitle:'Double of 19 is 38.', wrongTTS:'Double of 19 is 38.', wrongSubtitle:'Double of 19 is 38.', misconception_tags:{ '29':'added-10-instead-of-doubled', '40':'off-by-two' }, answer:{ prompt:'Double of 19', options:[38,29,40], correctIndex:0, correctValue:38, explanation:'Double of 19 is 38' } },
    { set:'B', id:'B_r12_double-20',round:12, stage:3, type:'A', n:20, prompt:'Double of 20', options:[40,30,42], correctIndex:0, correctValue:40, correctTTS:'Nice — double of 20 is 40.', correctSubtitle:'Double of 20 is 40.', wrongTTS:'Double of 20 is 40.', wrongSubtitle:'Double of 20 is 40.', misconception_tags:{ '30':'added-10-instead-of-doubled', '42':'off-by-two' }, answer:{ prompt:'Double of 20', options:[40,30,42], correctIndex:0, correctValue:40, explanation:'Double of 20 is 40' } },
    { set:'B', id:'B_r13_double-22',round:13, stage:3, type:'A', n:22, prompt:'Double of 22', options:[44,32,43], correctIndex:0, correctValue:44, correctTTS:'Nice — double of 22 is 44.', correctSubtitle:'Double of 22 is 44.', wrongTTS:'Double of 22 is 44.', wrongSubtitle:'Double of 22 is 44.', misconception_tags:{ '32':'added-10-instead-of-doubled', '43':'off-by-one' }, answer:{ prompt:'Double of 22', options:[44,32,43], correctIndex:0, correctValue:44, explanation:'Double of 22 is 44' } },
    { set:'B', id:'B_r14_double-24',round:14, stage:3, type:'A', n:24, prompt:'Double of 24', options:[48,34,47], correctIndex:0, correctValue:48, correctTTS:'Nice — double of 24 is 48.', correctSubtitle:'Double of 24 is 48.', wrongTTS:'Double of 24 is 48.', wrongSubtitle:'Double of 24 is 48.', misconception_tags:{ '34':'added-10-instead-of-doubled', '47':'off-by-one' }, answer:{ prompt:'Double of 24', options:[48,34,47], correctIndex:0, correctValue:48, explanation:'Double of 24 is 48' } },
    { set:'B', id:'B_r15_double-18',round:15, stage:3, type:'A', n:18, prompt:'Double of 18', options:[36,38,28], correctIndex:0, correctValue:36, correctTTS:'Nice — double of 18 is 36.', correctSubtitle:'Double of 18 is 36.', wrongTTS:'Double of 18 is 36.', wrongSubtitle:'Double of 18 is 36.', misconception_tags:{ '38':'off-by-two', '28':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 18', options:[36,38,28], correctIndex:0, correctValue:36, explanation:'Double of 18 is 36' } },

    // ── Set C — 15 rounds (parallel difficulty) ──
    // Stage 1
    { set:'C', id:'C_r1_double-8',  round:1,  stage:1, type:'A', n:8,  prompt:'Double of 8',  options:[16,17,14], correctIndex:0, correctValue:16, correctTTS:'Nice — double of 8 is 16.',  correctSubtitle:'Double of 8 is 16.',  wrongTTS:'Double of 8 is 16.',  wrongSubtitle:'Double of 8 is 16.',  misconception_tags:{ '17':'off-by-one', '14':'off-by-two' }, answer:{ prompt:'Double of 8',  options:[16,17,14], correctIndex:0, correctValue:16, explanation:'Double of 8 is 16' } },
    { set:'C', id:'C_r2_double-11', round:2,  stage:1, type:'A', n:11, prompt:'Double of 11', options:[22,21,20], correctIndex:0, correctValue:22, correctTTS:'Nice — double of 11 is 22.', correctSubtitle:'Double of 11 is 22.', wrongTTS:'Double of 11 is 22.', wrongSubtitle:'Double of 11 is 22.', misconception_tags:{ '21':'off-by-one', '20':'off-by-two' }, answer:{ prompt:'Double of 11', options:[22,21,20], correctIndex:0, correctValue:22, explanation:'Double of 11 is 22' } },
    { set:'C', id:'C_r3_double-9',  round:3,  stage:1, type:'A', n:9,  prompt:'Double of 9',  options:[18,19,20], correctIndex:0, correctValue:18, correctTTS:'Nice — double of 9 is 18.',  correctSubtitle:'Double of 9 is 18.',  wrongTTS:'Double of 9 is 18.',  wrongSubtitle:'Double of 9 is 18.',  misconception_tags:{ '19':'added-10-instead-of-doubled', '20':'off-by-two' }, answer:{ prompt:'Double of 9',  options:[18,19,20], correctIndex:0, correctValue:18, explanation:'Double of 9 is 18' } },
    { set:'C', id:'C_r4_double-7',  round:4,  stage:1, type:'A', n:7,  prompt:'Double of 7',  options:[14,17,15], correctIndex:0, correctValue:14, correctTTS:'Nice — double of 7 is 14.',  correctSubtitle:'Double of 7 is 14.',  wrongTTS:'Double of 7 is 14.',  wrongSubtitle:'Double of 7 is 14.',  misconception_tags:{ '17':'added-10-instead-of-doubled', '15':'off-by-one' }, answer:{ prompt:'Double of 7',  options:[14,17,15], correctIndex:0, correctValue:14, explanation:'Double of 7 is 14' } },
    { set:'C', id:'C_r5_double-12', round:5,  stage:1, type:'A', n:12, prompt:'Double of 12', options:[24,25,22], correctIndex:0, correctValue:24, correctTTS:'Nice — double of 12 is 24.', correctSubtitle:'Double of 12 is 24.', wrongTTS:'Double of 12 is 24.', wrongSubtitle:'Double of 12 is 24.', misconception_tags:{ '25':'off-by-one', '22':'off-by-two' }, answer:{ prompt:'Double of 12', options:[24,25,22], correctIndex:0, correctValue:24, explanation:'Double of 12 is 24' } },
    // Stage 2
    { set:'C', id:'C_r6_double-15', round:6,  stage:2, type:'A', n:15, prompt:'Double of 15', options:[30,29,25], correctIndex:0, correctValue:30, correctTTS:'Nice — double of 15 is 30.', correctSubtitle:'Double of 15 is 30.', wrongTTS:'Double of 15 is 30.', wrongSubtitle:'Double of 15 is 30.', misconception_tags:{ '29':'off-by-one', '25':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 15', options:[30,29,25], correctIndex:0, correctValue:30, explanation:'Double of 15 is 30' } },
    { set:'C', id:'C_r7_double-13', round:7,  stage:2, type:'A', n:13, prompt:'Double of 13', options:[26,27,23], correctIndex:0, correctValue:26, correctTTS:'Nice — double of 13 is 26.', correctSubtitle:'Double of 13 is 26.', wrongTTS:'Double of 13 is 26.', wrongSubtitle:'Double of 13 is 26.', misconception_tags:{ '27':'off-by-one', '23':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 13', options:[26,27,23], correctIndex:0, correctValue:26, explanation:'Double of 13 is 26' } },
    { set:'C', id:'C_r8_double-17', round:8,  stage:2, type:'A', n:17, prompt:'Double of 17', options:[34,33,27], correctIndex:0, correctValue:34, correctTTS:'Nice — double of 17 is 34.', correctSubtitle:'Double of 17 is 34.', wrongTTS:'Double of 17 is 34.', wrongSubtitle:'Double of 17 is 34.', misconception_tags:{ '33':'off-by-one', '27':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 17', options:[34,33,27], correctIndex:0, correctValue:34, explanation:'Double of 17 is 34' } },
    { set:'C', id:'C_r9_double-14', round:9,  stage:2, type:'A', n:14, prompt:'Double of 14', options:[28,30,24], correctIndex:0, correctValue:28, correctTTS:'Nice — double of 14 is 28.', correctSubtitle:'Double of 14 is 28.', wrongTTS:'Double of 14 is 28.', wrongSubtitle:'Double of 14 is 28.', misconception_tags:{ '30':'off-by-two', '24':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 14', options:[28,30,24], correctIndex:0, correctValue:28, explanation:'Double of 14 is 28' } },
    { set:'C', id:'C_r10_double-16',round:10, stage:2, type:'A', n:16, prompt:'Double of 16', options:[32,31,26], correctIndex:0, correctValue:32, correctTTS:'Nice — double of 16 is 32.', correctSubtitle:'Double of 16 is 32.', wrongTTS:'Double of 16 is 32.', wrongSubtitle:'Double of 16 is 32.', misconception_tags:{ '31':'off-by-one', '26':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 16', options:[32,31,26], correctIndex:0, correctValue:32, explanation:'Double of 16 is 32' } },
    // Stage 3
    { set:'C', id:'C_r11_double-20',round:11, stage:3, type:'A', n:20, prompt:'Double of 20', options:[40,41,30], correctIndex:0, correctValue:40, correctTTS:'Nice — double of 20 is 40.', correctSubtitle:'Double of 20 is 40.', wrongTTS:'Double of 20 is 40.', wrongSubtitle:'Double of 20 is 40.', misconception_tags:{ '41':'off-by-one', '30':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 20', options:[40,41,30], correctIndex:0, correctValue:40, explanation:'Double of 20 is 40' } },
    { set:'C', id:'C_r12_double-22',round:12, stage:3, type:'A', n:22, prompt:'Double of 22', options:[44,45,32], correctIndex:0, correctValue:44, correctTTS:'Nice — double of 22 is 44.', correctSubtitle:'Double of 22 is 44.', wrongTTS:'Double of 22 is 44.', wrongSubtitle:'Double of 22 is 44.', misconception_tags:{ '45':'off-by-one', '32':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 22', options:[44,45,32], correctIndex:0, correctValue:44, explanation:'Double of 22 is 44' } },
    { set:'C', id:'C_r13_double-24',round:13, stage:3, type:'A', n:24, prompt:'Double of 24', options:[48,49,34], correctIndex:0, correctValue:48, correctTTS:'Nice — double of 24 is 48.', correctSubtitle:'Double of 24 is 48.', wrongTTS:'Double of 24 is 48.', wrongSubtitle:'Double of 24 is 48.', misconception_tags:{ '49':'off-by-one', '34':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 24', options:[48,49,34], correctIndex:0, correctValue:48, explanation:'Double of 24 is 48' } },
    { set:'C', id:'C_r14_double-21',round:14, stage:3, type:'A', n:21, prompt:'Double of 21', options:[42,43,31], correctIndex:0, correctValue:42, correctTTS:'Nice — double of 21 is 42.', correctSubtitle:'Double of 21 is 42.', wrongTTS:'Double of 21 is 42.', wrongSubtitle:'Double of 21 is 42.', misconception_tags:{ '43':'off-by-one', '31':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 21', options:[42,43,31], correctIndex:0, correctValue:42, explanation:'Double of 21 is 42' } },
    { set:'C', id:'C_r15_double-23',round:15, stage:3, type:'A', n:23, prompt:'Double of 23', options:[46,47,33], correctIndex:0, correctValue:46, correctTTS:'Nice — double of 23 is 46.', correctSubtitle:'Double of 23 is 46.', wrongTTS:'Double of 23 is 46.', wrongSubtitle:'Double of 23 is 46.', misconception_tags:{ '47':'off-by-one', '33':'added-10-instead-of-doubled' }, answer:{ prompt:'Double of 23', options:[46,47,33], correctIndex:0, correctValue:46, explanation:'Double of 23 is 46' } }
  ]
};
```

## Suggestions (require explicit creator approval)

These are pedagogy-suggested defaults that the creator did NOT explicitly request; they sit here pending creator approval and are NOT applied to the main spec.

- **Read-aloud prompt at round-start (Bloom L1 scaffold).** Play `playDynamicFeedback({audio_content: 'Double of N', subtitle: ''})` (fire-and-forget, stoppable on first tap) when each round body paints, so non-readers can still play. *Why:* pedagogy/SKILL.md L1 row "Feedback: Show answer" and the Class 2 grade band include early-readers; an aural prompt is a standard L1 scaffold. *Applies if creator approves.*
- **Bilingual math vocabulary (Hindi bridge for Class 4 students).** Append a Hindi paraphrase to the wrong-answer TTS — e.g. "Double of 6 is 12 — chha ka double baarah." *Why:* indian-curriculum.md `[SUGGESTED]` Hindi-English math vocab bridge for Class 4–6. *Applies if creator approves.*
- **Streak SFX at 5 / 10 consecutive correct.** Fire-and-forget `soundChainComplete` (fire-and-forget, no TTS) at streak milestones for emotional juice. *Why:* feedback/SKILL.md emotional-arc.md `[SUGGESTED]` streak-celebration row. *Applies if creator approves.*
- **Show fastest correct round on Victory screen.** Display `min(responseMs)` alongside `avgCorrectMs` so the student sees their personal best. *Why:* pedagogy/emotional-safety.md `[SUGGESTED]` "celebrate personal best" row. *Applies if creator approves.*

## Defaults Applied

- **Bloom Level**: defaulted to L1 Remember based on creator language ("automatic recall", "fluency, not first exposure", "just know it") — explicit in the description, but not numerically tagged; L1 inferred from § Step 1 of pedagogy.
- **Sticker GIFs (correct / wrong / celebration / sad / Victory / Game Over)**: defaulted to the canonical sticker set in feedback/reference/feedbackmanager-api.md (creator did not specify).
- **Audio ids (`correct_sound_effect`, `incorrect_sound_effect`, `victory_sound_effect`, `game_over_sound_effect`, `rounds_sound_effect`, `sound_level_transition`, `tap_sound`, `sound_stars_collected`, `game_complete_sound_effect`)**: defaulted to canonical ids from the Standard Audio URLs table (creator did not specify ids — only described the sound moments).
- **Round-set cycling (Sets A / B / C)**: spec-creation MANDATORY — creator implied "fresh set of numbers each time" so a Try Again cycles to the next set; A→B→C→A.
- **Welcome / Round-N intro / Victory / Game Over / Stars Collected screens**: defaulted to canonical templates from default-transition-screens.md (creator did not quote per-screen narration). No `creatorScreenAudio` block.
- **`previewScreen`**: defaulted to `true` (creator did not specify; preview shown).
- **Flow base**: defaulted to default-flow.md multi-round shape.
- **NCERT chapter reference**: defaulted to Class 2 / Class 3 NCERT multiplication chapters (creator named the 2× table but no curriculum chapter).
- **Star formula `1★ for completed run regardless of `avgCorrectMs`**: applied per creator's "1 star — slower than 3.5 seconds, **or any other completed run**" wording, taken literally.

## Warnings

- **WARNING: Lives at Bloom L1 contradicts pedagogy/SKILL.md `[SUGGESTED]` rule "Never use lives at L1 or L2 by default."** The creator explicitly described 3 dark hearts and a Game Over after 3 wrong taps as the soft motivator; the creator's choice stands per spec-creation Constraint #5 ("Must not override creator choices"). The Bloom level remains L1 because the underlying skill is fluent retrieval; the lives are framed as "soft motivator" rather than gating, matching creator intent.
- **WARNING: Per-round timer (PART-006) at Bloom L1 fact-fluency.** PART-006 is mandatory because `getStars()` reads `avgCorrectMs` (per the new GEN-TIMER-MANDATORY-WHEN-DURATION-VISIBLE rule in game-archetypes/SKILL.md anti-pattern #4). The student-visible "under 2 seconds for 3 stars" promise in `previewInstruction` triggers the rule. Stopwatch is count-up, not a countdown — there is no time-up game-over.
- **WARNING: 15 rounds is on the upper end of pedagogy/SKILL.md L1 quick-reference range (9–15).** Acceptable but at the edge — the creator-quoted "complete session under five minutes" implies sub-20-second average per round including feedback, which the design budgets for. No spec change.

## Diff from creator description

Every spec line below is NOT directly traceable to (1) the literal creator description, (2) a `[MANDATORY]` rule in pedagogy/feedback/mobile/data-contract, or (3) a Creator Decision Default. Each is justified by the rule that put it in the spec.

- `Class/Grade: Class 2–4 (Grade 2–4, ~7–10 years old)` — added because the creator wrote "Class 2–4 students (ages ~7–10)"; the `(Grade 2–4)` parenthetical is a spec-template format requirement.
- `Math Domain: Number Sense & Operations — multiplication / mental arithmetic` — added because spec-template requires a Math Domain field; creator named "2× table" which sits in this domain.
- `NCERT Reference: Class 2 NCERT Math Magic Chapter 6 "Footprints" / Class 3 NCERT Chapter "Give and Take"` — added because pedagogy/SKILL.md `[SUGGESTED]` NCERT reference; specific chapters chosen by curriculum mapping (creator did not name the board).
- `Archetype: #3 Lives Challenge with PART-006 stopwatch variant` — added because spec-template MANDATORY field; matched via decision tree (lives present → Lives Challenge).
- `retryPreservesInput: N/A` — added because PART-050 spec field required on every spec; creator did not specify (multi-round = ignored).
- `autoShowStar: true` — added because spec-template default; creator did not specify.
- `Star denominator y: 3 (default)` — added because spec-template default; creator did not specify.
- `Round-set cycling A / B / C × 15 rounds = 45 round entries` — added because spec-creation MANDATORY rule (`GEN-ROUNDSETS-MIN-3`). Creator wrote "fresh set of numbers each time", which authorises the cycling content but not the structural three-set requirement; the structural requirement is the validator rule.
- Per-round `correctTTS` / `correctSubtitle` / `wrongTTS` / `wrongSubtitle` fields — added because spec-creation MANDATORY § 5e-i (TTS↔Subtitle pairing). Creator wrote the text "Double of 6 is 12" verbatim for the wrong path; the correct-path TTS ("Nice — double of N is 2N") is canonical default narration since the creator described "a quick *ding*" with no specific words for correct.
- Per-round `misconception_tags` — added because spec-creation MANDATORY § 5d. Creator named the misconception families ("off-by-one, off-by-two, added 10 instead of doubled"); tag names `off-by-one`, `off-by-two`, `added-10-instead-of-doubled` are the canonical-form rendering.
- `answer:` payload (PART-051 AnswerComponent) on every round — added because PART-051 default is `answerComponent: true`; creator was silent on answer review, default `true` (do NOT auto-fill `false`).
- `previewInstruction` / `previewAudioText` text — added because PART-039 MANDATORY when `previewScreen: true`; the wording is paraphrased from the creator's description.
- AnswerComponent carousel chain in the flow diagram — added because PART-051 default flow chain (default-flow.md "AnswerComponent insertion").
- Inter-stage breather screen mechanics ("auto-dismiss / `[I'm ready]` CTA, dynamic TTS quoting `avgCorrectMs`") — added because the creator described "a quick pause shows the student their average time so far and reminds them of the 2-second target", but did not specify the screen mechanics or whether it auto-advances; default Round-N transition contract chosen.
- Stopwatch description as "count-up, no expiry, persists across rounds, pauses on visibility-hidden / round-feedback / end-of-game" — added because PART-006 contract for non-countdown timer use; creator wrote "A timer ticks up in the header" but did not specify pause semantics.
- `tap_sound` ambient on round-prompt paint — added because feedback/SKILL.md CASE 17 default for new content appearing.
- `correctIndex: 0` canonical in fallbackContent (build randomises) — added because spec-creation buildability requirement to avoid ambiguity in option order across the 45 rounds; the literal layout doesn't matter at runtime since options are shuffled per session.
- `Star formula special-case "1★ for any completed run with ≥1 correct, even at avgCorrectMs > 3500"` — explicitly traced to creator's "1 star — slower than 3.5 seconds, *or any other completed run*" line. Listed here because the disjunction reading is one valid parse; spec uses the creator's literal "or any other completed run".
- Specific N values per round (e.g. R1 = 6, R2 = 8, R3 = 10) — added because spec-creation MANDATORY § 5c (full content for every round; creator listed the *band* {6, 8, 10, 11, 12} for Stage 1 but not the round-by-round assignment).
- VisibilityTracker / pause-overlay rows in feedback table — added because feedback CASE 14 / CASE 15 MANDATORY.
- "Preview screen" handling — added because PART-039 default `previewScreen: true`.
- "Try Again routes through 'Ready to improve your score?'" — added because default-flow.md MANDATORY restart path.
- WARNING about lives-at-L1 — added because pedagogy/SKILL.md `[SUGGESTED]` rule conflict (Constraint #5: keep creator choice, add WARNING).
- WARNING about PART-006 at L1 — added because game-archetypes/SKILL.md anti-pattern #4 mandates timer when `getStars()` reads duration.
- WARNING about 15 rounds at upper edge of L1 range — added because pedagogy/SKILL.md unusual-round-count check.
- Specific distractor values across all 45 rounds — derived from the creator-named misconception families {off-by-one, off-by-two, +10}; each distractor maps mechanically to one of those formulas.
