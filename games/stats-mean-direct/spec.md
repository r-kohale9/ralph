# Mean Machine — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block (module scope, NOT inside DOMContentLoaded). The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame`. Tests call these directly.

> **CRITICAL — TimerComponent destroy/recreate on restart.** `restartGame()` MUST call `timer.destroy()` then `timer = new TimerComponent(...)` before calling `startGame()`. Reusing the old timer after destroy causes a no-op and the timer never starts.

> **CRITICAL — gameId MUST be the FIRST field in the gameState object literal.** The pipeline validator checks that `gameState.gameId` is set and matches the game directory name. Any other field before gameId causes the contract check to fail.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 2 (Understand) and Level 3 (Apply) for the skill `stats-mean-direct`: given a small dataset of 5–7 numbers, the learner must compute the arithmetic mean (direct method) and select the correct answer from four options. The four distractors are designed to surface the four documented student misconceptions about computing mean: (1) forgetting to divide by n — selecting the raw sum; (2) dividing by the wrong n — off-by-one count; (3) selecting the mode instead of the mean (confusion between "most common" and "average"); (4) selecting the median instead of the mean (positional thinking vs additive). Difficulty increases across three tiers: Easy (whole numbers, sum ≤ 50, n = 5), Medium (larger values requiring mental carry, n = 5–6), Hard (repeated values creating a plausible mode distractor, n = 5–7). 45 seconds per round allows mental calculation without feeling rushed. Session predecessor: stats-identify-class (L1 classification — which measure is appropriate). Interaction type: `mean-computation-mcq`.
>
> **RESEARCH SOURCES (Exa, 2026-03-23):**
> - Source A: NCERT Class 9 Maths Chapter 14 Statistics, Exercise 14.4 (via byjus.com/geeksforgeeks.org NCERT Solutions, 2021–2025) — canonical Indian curriculum problems for computing mean of ungrouped data: "The following number of goals scored by a team in 10 matches: 2, 3, 4, 5, 0, 1, 3, 3, 4, 3. Find the mean, median and mode." Mean = Σxi / n = 28/10 = 2.8. Round design for this game draws directly from NCERT Ex 14.4 Q1 and Q2 (marks in a maths test) contexts and number ranges. NCERT Class 9 Ch 14 also introduces the direct method for grouped data (Σfi·xi / Σfi) which this game previews via ungrouped versions. (https://byjus.com/ncert-solutions-class-9-maths/chapter-14-statistics/, https://www.geeksforgeeks.org/maths/class-9-ncert-solutions-chapter-14-statistics-exercise-14-4/)
> - Source B: Cambridge Assessment International Education "Common Errors in Mathematics" (PDF, https://www.cambridgeassessment.org.uk/Images/466316-common-errors-in-mathematics.pdf) — documents that GCSE and IGCSE candidates "often divided incorrectly to calculate the mean, usually either dividing the frequency by the number of classes" and "candidates commonly confused mean, median and mode." Distractor design for this game targets both: one distractor is always the sum (forgot to divide), one is always the median (positional confusion), one is always the mode when repeated values are present.
> - Source C: Pollatsek, Lima & Well (1981) "Concept or computation: Students' understanding of the mean", Educational Studies in Mathematics 12, pp. 191–204 (via causeweb.org) — "while students can easily compute the mean of a group of numbers, a surprisingly large proportion do not understand the concept of the weighted mean... dealing with the mean is a computational rather than a conceptual act." Rounds 7–9 (Hard tier) use repeated values precisely to probe whether students treat all items equally regardless of frequency — the specific misconception documented in this study.
> - Source D: Cai, J. (1998) "Exploring Students' Conceptual Understanding of the Averaging Algorithm", School Science and Mathematics 98:93–98 (onlinelibrary.wiley.com) — "majority of students knew the add-them-all-up-and-divide algorithm, but only about half were able to correctly apply the algorithm to a contextualized average problem." Hard rounds use real-world contexts (cricket scores, plant counts) to test whether students can transfer the algorithm, not just recite it.

---

## 1. Game Identity

| Field | Value |
|---|---|
| **Title** | Mean Machine |
| **Game ID** | `stats-mean-direct` |
| **Type** | standard |
| **Session** | Statistics Session 2 — Game 2 of 4 |
| **Bloom Level** | L2 Understand + L3 Apply |
| **Description** | Students compute the arithmetic mean of a small dataset (5–7 numbers) using the direct method (sum ÷ count) and select the correct answer from 4 options. 9 rounds across 3 difficulty tiers. 3 lives — a life is lost on wrong answer OR timeout. Timer: 45 seconds per round. Stars based on correct answers. Session predecessor: stats-identify-class (L1 — which measure to use). Session successor: stats-median (L3 — compute median of grouped data). Targets NCERT Class 9 Ch 14, Section 14.2 (Mean of Ungrouped Data). |

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                     |
| -------- | ----------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                |
| PART-003 | waitForPackages               | YES             | required = ['ScreenLayout', 'TransitionScreenComponent', 'ProgressBarComponent', 'TimerComponent', 'FeedbackManager']            |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                               |
| PART-006 | TimerComponent                | YES             | 45s countdown per round; loses a life on timeout. Destroyed and recreated on restartGame().                                      |
| PART-007 | Game State Object             | YES             | Custom fields: isProcessing, correctAnswers, incorrectAnswers, gameEnded                                                         |
| PART-008 | PostMessage Protocol          | YES             | game_complete on BOTH victory and game_over paths                                                                                |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                |
| PART-010 | Event Tracking                | YES             | Events: answer_correct, answer_wrong, timeout, round_complete                                                                    |
| PART-011 | End Game & Metrics            | YES             | Star logic: 9/9 = 3★; 6–8/9 = 2★; 3–5/9 = 1★; 0–2/9 = 0★. Game-over on 0 lives.                                              |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                |
| PART-013 | Validation Fixed              | YES             | String equality: selectedOption === round.correctAnswer                                                                          |
| PART-014 | Validation Function           | NO              | —                                                                                                                                |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Use .sound() and .playDynamicFeedback() only.             |
| PART-018 | Case Converter                | NO              | —                                                                                                                                |
| PART-019 | Results Screen UI             | YES             | Metrics: correct answers, accuracy %, stars earned, rounds completed                                                             |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                |
| PART-023 | ProgressBar Component         | YES             | `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 9, totalLives: 3 })`                                   |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game_over                                                                                               |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                   |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist in Section 15                                                                                             |
| PART-027 | Play Area Construction        | YES             | Layout: dataset display (numbers in a styled box) + question text + 4 MCQ option buttons in 2×2 grid + feedback text div         |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with numbers, question, options (4), correctAnswer, distractorNotes, misconceptionTags, difficulty           |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                |
| PART-031 | API Helper                    | NO              | —                                                                                                                                |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                        |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                    |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                           |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY FIRST FIELD — gameId must be the FIRST key in this object literal:
  gameId: 'stats-mean-direct',
  phase: 'start',                // 'start' | 'playing' | 'results' | 'game_over'
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 9,
  lives: 3,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null
  },

  // GAME-SPECIFIC:
  correctAnswers: 0,            // Total rounds answered correctly (any attempt)
  incorrectAnswers: 0,          // Total rounds answered wrong or timed out
  isProcessing: false,          // Guard against double-submit during feedback delay
  gameEnded: false              // Prevent post-endGame state mutations
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
let timer = null;
```

**Lives system:** 3 lives. A life is deducted on WRONG answer OR TIMEOUT. When `gameState.lives` reaches 0, `endGame(false)` is called immediately (game_over). Victory requires completing all 9 rounds with at least 1 life remaining.

**Phase values (MANDATORY — syncDOMState maps these to data-phase):**
- `'start'` — start screen visible, game not begun
- `'playing'` — active round in progress
- `'results'` — victory screen, all 9 rounds completed
- `'game_over'` — lives exhausted before round 9

---

## 4. Input Schema (External Variables)

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "numbers": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 5,
            "maxItems": 7,
            "description": "The dataset. 5–7 whole numbers shown to the learner. Easy: small values summing <60. Medium: values 10–30 requiring careful addition. Hard: includes repeated values that create a plausible mode distractor."
          },
          "question": {
            "type": "string",
            "description": "The question shown above the MCQ buttons. Always a variant of 'What is the mean of these numbers?' with optional real-world framing."
          },
          "correctAnswer": {
            "type": "string",
            "description": "The correct mean as a string. May be a whole number ('6') or one decimal place ('5.4'). Must match one of the options strings exactly."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. One is the correct mean. The remaining three are distractors targeting documented misconceptions: (D1) sum without dividing, (D2) median of the dataset, (D3) mode of the dataset (only plausible when repeated values exist — otherwise use off-by-one count distractor). Options must be in shuffled order (correct answer not always first)."
          },
          "difficulty": {
            "type": "string",
            "enum": ["easy", "medium", "hard"],
            "description": "easy = rounds 1–3, medium = rounds 4–6, hard = rounds 7–9."
          },
          "distractorNotes": {
            "type": "string",
            "description": "Internal note for the LLM explaining what each distractor represents. Not shown to the learner. Example: 'D1=sum(30)/not-divided, D2=median(6), D3=mode(4)'"
          },
          "misconceptionTags": {
            "type": "array",
            "items": { "type": "string", "enum": ["M-forget-divide", "M-wrong-n", "M-mode-confusion", "M-median-confusion"] },
            "description": "Tags for the misconceptions targeted by the distractors in this round. One tag per distractor (up to 3)."
          },
          "feedbackCorrect": {
            "type": "string",
            "description": "One sentence shown briefly on correct answer. Must show the working: 'Correct! (2+4+6+8+10) ÷ 5 = 30 ÷ 5 = 6.' Max 25 words."
          },
          "feedbackWrong": {
            "type": "string",
            "description": "One sentence shown briefly on wrong answer before advancing. Must name the correct answer and show the key step: 'Mean = (2+4+6+8+10) ÷ 5 = 6. Remember to divide by the count.' Max 30 words."
          }
        },
        "required": ["numbers", "question", "correctAnswer", "options", "difficulty", "distractorNotes", "misconceptionTags", "feedbackCorrect", "feedbackWrong"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. Rounds 1–3: easy, rounds 4–6: medium, rounds 7–9: hard."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content (9 rounds)

Field names in each round object MUST match the inputSchema: `numbers` (array of numbers), `question` (string), `correctAnswer` (string), `options` (array of 4 strings), `difficulty` (string), `distractorNotes` (string), `misconceptionTags` (array), `feedbackCorrect` (string), `feedbackWrong` (string).

```javascript
// FIELD NAMES PER SCHEMA: numbers (array), question (string), correctAnswer (string),
// options (array of 4 strings), difficulty ('easy'|'medium'|'hard'),
// distractorNotes (string), misconceptionTags (array), feedbackCorrect (string), feedbackWrong (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1 — EASY — no repeated values, small whole-number mean
    // Numbers: 2, 4, 6, 8, 10  →  Sum = 30, n = 5, Mean = 6
    // Distractors: D1 = 30 (forgot to divide), D2 = 6 (median — same as mean here, so use sum),
    //              D3 = 4 (off-by-one: divided by 6 instead of 5 → 5, or divided by 4 → 7.5, use 5)
    // Note: mean = median here; to avoid identical correct/distractor, D2 = 5 (divided by 6)
    // NCERT-aligned: ungrouped data, direct method Σxi/n
    // Misconceptions: M-forget-divide (D1=30), M-wrong-n (D3=5)
    // ============================================================
    {
      numbers: [2, 4, 6, 8, 10],
      question: 'What is the mean of these 5 numbers?',
      correctAnswer: '6',
      options: ['5', '6', '8', '30'],
      difficulty: 'easy',
      distractorNotes: 'D1=30 (forgot to divide by 5), D2=5 (divided by 6 instead of 5), D3=8 (selected 4th value / positional confusion). Correct=6.',
      misconceptionTags: ['M-forget-divide', 'M-wrong-n', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (2+4+6+8+10) ÷ 5 = 30 ÷ 5 = 6.',
      feedbackWrong: 'Mean = (2+4+6+8+10) ÷ 5 = 30 ÷ 5 = 6. Always divide the sum by the count.'
    },

    // ============================================================
    // ROUND 2 — EASY — different values, clear whole-number mean
    // Numbers: 3, 5, 7, 9, 11  →  Sum = 35, n = 5, Mean = 7
    // Distractors: 35 (forgot divide), 9 (median), 6 (wrong n: 35÷6 ≈ 5.8, round to 6)
    // NCERT-aligned: arithmetic progression — uniform step, mean = middle value
    // ============================================================
    {
      numbers: [3, 5, 7, 9, 11],
      question: 'Find the mean of: 3, 5, 7, 9, 11',
      correctAnswer: '7',
      options: ['6', '7', '9', '35'],
      difficulty: 'easy',
      distractorNotes: 'D1=35 (forgot to divide), D2=9 (selected median = 3rd value), D3=6 (divided by 6 instead of 5). Correct=7.',
      misconceptionTags: ['M-forget-divide', 'M-median-confusion', 'M-wrong-n'],
      feedbackCorrect: 'Correct! (3+5+7+9+11) ÷ 5 = 35 ÷ 5 = 7.',
      feedbackWrong: 'Mean = (3+5+7+9+11) ÷ 5 = 35 ÷ 5 = 7. The middle value (9) is the median, not the mean.'
    },

    // ============================================================
    // ROUND 3 — EASY — simple real-world framing (cricket scores)
    // Numbers: 4, 8, 12, 6, 10  →  Sum = 40, n = 5, Mean = 8
    // Distractors: 40 (forgot divide), 8 (correct — must be distinct from median here),
    //              10 (median of sorted: 4,6,8,10,12 = 8 — same as mean; use 6 as median-positional confusion)
    // Sorted: 4, 6, 8, 10, 12 → median = 8. Use different distractor: 6 (selected 2nd value), 12 (selected max)
    // NCERT Ex 14.4 Q1 context: goals/runs scored
    // ============================================================
    {
      numbers: [4, 8, 12, 6, 10],
      question: 'A student scored 4, 8, 12, 6, and 10 runs in 5 cricket matches. What is the mean score?',
      correctAnswer: '8',
      options: ['6', '8', '12', '40'],
      difficulty: 'easy',
      distractorNotes: 'D1=40 (forgot to divide), D2=12 (selected maximum), D3=6 (selected 2nd lowest / positional confusion). Correct=8. Sorted: 4,6,8,10,12 — median=8=mean, so both median/mode distractors replaced with positional confusions.',
      misconceptionTags: ['M-forget-divide', 'M-median-confusion', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (4+8+12+6+10) ÷ 5 = 40 ÷ 5 = 8 runs per match.',
      feedbackWrong: 'Mean = (4+8+12+6+10) ÷ 5 = 40 ÷ 5 = 8. Add all scores first, then divide by 5.'
    },

    // ============================================================
    // ROUND 4 — MEDIUM — larger values, mental carry required
    // Numbers: 12, 18, 24, 15, 21  →  Sum = 90, n = 5, Mean = 18
    // Distractors: 90 (forgot divide), 18 (correct!), 15 (median of sorted: 12,15,18,21,24), 20 (wrong n: 90÷4.5 not clean; use 90÷6=15 — same as median; use 19 instead — common mental arithmetic slip)
    // Sorted: 12, 15, 18, 21, 24 → median = 18 = mean. Use 15 (2nd value) and 21 (4th value) as positional distractors.
    // ============================================================
    {
      numbers: [12, 18, 24, 15, 21],
      question: 'What is the mean of: 12, 18, 24, 15, 21?',
      correctAnswer: '18',
      options: ['15', '18', '21', '90'],
      difficulty: 'medium',
      distractorNotes: 'D1=90 (forgot to divide), D2=15 (2nd value in sorted list / positional confusion), D3=21 (4th value in sorted list / positional confusion). Correct=18. Sum=90, n=5.',
      misconceptionTags: ['M-forget-divide', 'M-median-confusion', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (12+18+24+15+21) ÷ 5 = 90 ÷ 5 = 18.',
      feedbackWrong: 'Mean = (12+18+24+15+21) ÷ 5 = 90 ÷ 5 = 18. Add all 5 values first, then divide.'
    },

    // ============================================================
    // ROUND 5 — MEDIUM — 6 numbers, tests correct n=6
    // Numbers: 14, 20, 16, 18, 22, 18  →  Sum = 108, n = 6, Mean = 18
    // Distractors: 108 (forgot divide), 18 (correct), 18 (mode=18 appears twice — same as mean; use 17 and 20)
    // Mode = 18 (appears twice) = mean. Use 17 (divided by wrong n=108÷6.4≈17 — close enough as plausible slip) and 20 (median: sorted 14,16,18,18,20,22 → (18+18)/2=18 = mean again; use 16 as 2nd value).
    // ============================================================
    {
      numbers: [14, 20, 16, 18, 22, 18],
      question: 'A farmer measured rainfall (mm) over 6 days: 14, 20, 16, 18, 22, 18. What is the mean daily rainfall?',
      correctAnswer: '18',
      options: ['16', '18', '20', '108'],
      difficulty: 'medium',
      distractorNotes: 'D1=108 (forgot to divide), D2=16 (2nd value in sorted list), D3=20 (5th value in sorted list). Correct=18. Sum=108, n=6. Mode=18=mean — tested implicitly.',
      misconceptionTags: ['M-forget-divide', 'M-median-confusion', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (14+20+16+18+22+18) ÷ 6 = 108 ÷ 6 = 18 mm.',
      feedbackWrong: 'Mean = (14+20+16+18+22+18) ÷ 6 = 108 ÷ 6 = 18. There are 6 days — divide by 6, not 5.'
    },

    // ============================================================
    // ROUND 6 — MEDIUM — decimal mean (one decimal place)
    // Numbers: 10, 13, 17, 11, 14  →  Sum = 65, n = 5, Mean = 13
    // Wait — 65/5 = 13 (whole number). Use: 11, 14, 17, 10, 13 = 65 → 13. Same.
    // Use: 10, 13, 17, 12, 13 → Sum = 65 → 13. Mode = 13 = mean. Bad.
    // Use: 10, 11, 14, 17, 13 = 65/5 = 13. Try different: 7, 11, 15, 9, 13 = 55/5 = 11.
    // Good medium: 7, 11, 15, 9, 13 → Sum=55, n=5, Mean=11. Mode=none. Median=sorted:7,9,11,13,15→11=mean.
    // Use decimal: 8, 11, 15, 9, 12 → Sum=55, n=5, Mean=11. Same issue.
    // Go for decimal: 9, 11, 14, 12, 9 → Sum=55, n=5, Mean=11. Mode=9. Median=sorted:9,9,11,12,14→11=mean.
    // Good: 8, 10, 14, 11, 12 → Sum=55, n=5, Mean=11. Median=sorted:8,10,11,12,14→11. Mode=none.
    // Better decimal: 6, 9, 13, 11, 11 → Sum=50, n=5, Mean=10. Mode=11. Median=sorted:6,9,11,11,13→11.
    // Excellent: Mean≠median≠mode: Correct=10, D-mode=11, D-median=11 (same — bad).
    // Use: 4, 8, 12, 10, 11 → Sum=45, n=5, Mean=9. Median=sorted:4,8,10,11,12→10. Mode=none. D1=45, D2=10, D3=4 (min). Good!
    // NCERT Ex 14.4 Q2 context: marks in a test
    // ============================================================
    {
      numbers: [4, 8, 12, 10, 11],
      question: 'Five students scored 4, 8, 12, 10, and 11 marks (out of 15) in a quiz. What is the mean score?',
      correctAnswer: '9',
      options: ['9', '10', '11', '45'],
      difficulty: 'medium',
      distractorNotes: 'D1=45 (forgot to divide), D2=10 (median of sorted 4,8,10,11,12), D3=11 (4th value / positional confusion). Correct=9. Sum=45, n=5.',
      misconceptionTags: ['M-forget-divide', 'M-median-confusion', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (4+8+12+10+11) ÷ 5 = 45 ÷ 5 = 9 marks.',
      feedbackWrong: 'Mean = (4+8+12+10+11) ÷ 5 = 45 ÷ 5 = 9. The middle value (10) is the median — the mean requires adding all values and dividing.'
    },

    // ============================================================
    // ROUND 7 — HARD — repeated values, strong mode distractor
    // Numbers: 3, 3, 7, 9, 3  →  Sum = 25, n = 5, Mean = 5
    // Mode = 3 (appears 3 times) — VERY plausible distractor
    // Median = sorted: 3, 3, 3, 7, 9 → 3rd value = 3 — same as mode! Use 7 as additional distractor.
    // Sorted: 3,3,3,7,9. Median=3. Mode=3. Mean=5.
    // D1=3 (mode AND median — most common value confusion), D2=25 (forgot divide), D3=7 (4th value)
    // Research: Pollatsek et al. 1981 — "treating all items equally regardless of frequency" = picking mode.
    // ============================================================
    {
      numbers: [3, 3, 7, 9, 3],
      question: 'What is the mean of: 3, 3, 7, 9, 3?',
      correctAnswer: '5',
      options: ['3', '5', '7', '25'],
      difficulty: 'hard',
      distractorNotes: 'D1=3 (mode=3 appears 3 times AND median=3 — strongest distractor; targets M-mode-confusion and M-median-confusion), D2=25 (forgot to divide — M-forget-divide), D3=7 (4th value in sorted list). Correct=5. Sum=25, n=5.',
      misconceptionTags: ['M-mode-confusion', 'M-median-confusion', 'M-forget-divide'],
      feedbackCorrect: 'Correct! (3+3+7+9+3) ÷ 5 = 25 ÷ 5 = 5. Even though 3 appears most often, the mean includes every value.',
      feedbackWrong: 'Mean = (3+3+7+9+3) ÷ 5 = 25 ÷ 5 = 5. The most common value (3) is the mode — the mean must include 7 and 9 as well.'
    },

    // ============================================================
    // ROUND 8 — HARD — 7 numbers, real-world context, decimal mean
    // Numbers: 5, 8, 6, 9, 5, 7, 5  →  Sum = 45, n = 7, Mean = 45/7 ≈ 6.4
    // Mode = 5 (appears 3 times). Median = sorted: 5,5,5,6,7,8,9 → 4th value = 6.
    // Mean = 6.4 (one decimal). D1=5 (mode), D2=6 (median), D3=45 (forgot divide)
    // Context: number of plants per house (NCERT Ex 14.1 Q1 spirit)
    // Research: Cai 1998 — "contextualized average problem" tests transfer of algorithm
    // ============================================================
    {
      numbers: [5, 8, 6, 9, 5, 7, 5],
      question: 'A survey counted plants in 7 houses: 5, 8, 6, 9, 5, 7, 5. What is the mean number of plants?',
      correctAnswer: '6.4',
      options: ['5', '6', '6.4', '45'],
      difficulty: 'hard',
      distractorNotes: 'D1=5 (mode — appears 3 times, M-mode-confusion), D2=6 (median of sorted 5,5,5,6,7,8,9 = 4th value, M-median-confusion), D3=45 (forgot to divide by 7, M-forget-divide). Correct=6.4. Sum=45, n=7.',
      misconceptionTags: ['M-mode-confusion', 'M-median-confusion', 'M-forget-divide'],
      feedbackCorrect: 'Correct! (5+8+6+9+5+7+5) ÷ 7 = 45 ÷ 7 ≈ 6.4 plants.',
      feedbackWrong: 'Mean = (5+8+6+9+5+7+5) ÷ 7 = 45 ÷ 7 ≈ 6.4. The most common value (5) is the mode; 6 is the median. The mean uses all 7 values.'
    },

    // ============================================================
    // ROUND 9 — HARD — repeated values, wrong-n distractor
    // Numbers: 6, 9, 6, 15, 9  →  Sum = 45, n = 5, Mean = 9
    // Mode = 6 and 9 (bimodal). Median = sorted: 6,6,9,9,15 → 3rd = 9 = mean.
    // Since median = mean, use bimodal mode (6) and wrong-n distractor (45÷4=11.25≈11) and 15 (max value).
    // D1=6 (mode of 6 — appears twice, M-mode-confusion), D2=11 (divided by 4 instead of 5, M-wrong-n),
    // D3=15 (selected maximum, M-median-confusion)
    // Research: Cambridge Assessment — "dividing by wrong number of classes"
    // ============================================================
    {
      numbers: [6, 9, 6, 15, 9],
      question: 'Ravi scored 6, 9, 6, 15, and 9 in five spelling tests. What is his mean score?',
      correctAnswer: '9',
      options: ['6', '9', '11', '15'],
      difficulty: 'hard',
      distractorNotes: 'D1=6 (mode — appears twice, M-mode-confusion), D2=11 (divided by 4 instead of 5 → 45/4=11.25≈11, M-wrong-n; Cambridge Assessment documented error), D3=15 (maximum value — positional confusion). Correct=9. Sum=45, n=5.',
      misconceptionTags: ['M-mode-confusion', 'M-wrong-n', 'M-median-confusion'],
      feedbackCorrect: 'Correct! (6+9+6+15+9) ÷ 5 = 45 ÷ 5 = 9. Both 6 and 9 appear twice — the mean is 9, not either mode value.',
      feedbackWrong: 'Mean = (6+9+6+15+9) ÷ 5 = 45 ÷ 5 = 9. Count all 5 values carefully before dividing.'
    }
  ]
};
```

---

## 5. HTML Structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mean Machine</title>
  <!-- PART-002: Package Scripts -->
  <script src="https://unpkg.com/@hw-app/cdn-games@latest/dist/bundle.js"></script>
  <style>
    /* CSS defined in Section 10 */
  </style>
</head>
<body>
  <div id="app">
    <!-- ScreenLayout injects: progress bar slot (mathai-progress-slot) + transition screen slot + game area -->

    <!-- Game Area (visible during 'playing' phase) -->
    <div id="game-area" class="screen" style="display:none;">

      <!-- Timer slot -->
      <div id="timer-container"></div>

      <!-- Dataset display -->
      <div id="dataset-card" class="dataset-card">
        <div id="dataset-display" class="dataset-box" aria-label="Data set" data-testid="dataset-display"></div>
      </div>

      <!-- Question + MCQ Options -->
      <div id="question-panel">
        <p id="question-text" class="question-text" data-testid="question-text"></p>

        <!-- 4 MCQ option buttons — rendered dynamically in loadQuestion() -->
        <div id="options-grid" class="options-grid" data-testid="options-grid">
          <!-- Buttons injected here: 4 .option-btn elements -->
        </div>
      </div>

      <!-- Answer feedback (aria-live — screen-reader compatible) -->
      <div
        id="answer-feedback"
        class="answer-feedback hidden"
        aria-live="polite"
        role="status"
        data-testid="answer-feedback"
      ></div>

    </div>

    <!-- Results Screen (PART-019) — position:fixed to overlay all content -->
    <div id="results-screen" class="results-screen" style="display:none;" data-testid="results-screen">
      <!-- Populated dynamically by showResultsScreen() -->
    </div>

  </div>
</body>
</html>
```

**Key structural rules:**
- `#app` is the root — `data-phase`, `data-lives`, `data-score`, `data-round` attributes live here.
- `#timer-container` is the anchor for TimerComponent; it must be present in the DOM before `new TimerComponent('timer-container', ...)` is called.
- `#answer-feedback` MUST have `aria-live="polite"` and `role="status"` — tests assert this attribute.
- `#results-screen` MUST have `position: fixed; z-index: 100` in CSS (see Section 10).

---

## 6. Screen Flow + Phase State Machine

```
                    ┌─────────────────────────────────────┐
                    │         page loads                  │
                    │  gameState.phase = 'start'          │
                    │  syncDOMState()                     │
                    │  transitionScreen.show({...start...}) │
                    └───────────────┬─────────────────────┘
                                    │ [Play button clicked]
                                    ▼
                    ┌─────────────────────────────────────┐
                    │  startGame()                        │
                    │  gameState.phase = 'playing'        │
                    │  syncDOMState()                     │
                    │  transitionScreen.hide()            │
                    │  loadQuestion(1)                    │
                    └──────┬──────────────────────┬───────┘
                           │                      │
                [Correct or wrong answer]    [Timer expires]
                           │                      │
                    ┌──────▼──────────────────────▼───────┐
                    │  handleOptionSelect(index)          │
                    │  OR handleTimeout()                 │
                    │  lives-- (on wrong/timeout)         │
                    │  syncDOMState()                     │
                    └──────┬──────────────────────┬───────┘
                           │                      │
                    [lives > 0]             [lives === 0]
                    [round < 9]                   │
                           │              endGame(false)
                    [round === 9]          phase='game_over'
                           │              syncDOMState()
                    endGame(true)          transitionScreen.show({...game_over...})
                    phase='results'               │
                    syncDOMState()         [Restart button]
                    transitionScreen       restartGame()
                    .show({...victory...})
```

### syncDOMState() — MANDATORY (GEN-PHASE-001)

Every phase change MUST call `syncDOMState()` immediately after setting `gameState.phase`. Defines BEFORE any function that calls it.

```javascript
function syncDOMState() {
  const app = document.getElementById('app');
  if (!app) return;
  app.dataset.phase = gameState.phase;
  app.dataset.lives = gameState.lives;
  app.dataset.score = gameState.score || 0;
  app.dataset.round = gameState.currentRound;
}
```

**Phase transitions (ALL MANDATORY):**
- Page loads → `gameState.phase = 'start'` → `syncDOMState()` (before transitionScreen.show({...start object...}))
- `startGame()` → `gameState.phase = 'playing'` → `syncDOMState()` (before transitionScreen.hide())
- `endGame(true)` → `gameState.phase = 'results'` → `syncDOMState()` (before transitionScreen.show({...victory object...}))
- `endGame(false)` → `gameState.phase = 'game_over'` → `syncDOMState()` (before transitionScreen.show({...game_over object...}))
- Life lost (wrong or timeout) → `gameState.lives--` → `syncDOMState()` (before checking game_over condition)

---

## 7. Core Logic

### 7.1 startGame()

```javascript
function startGame() {
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.lives = 3;
  gameState.score = 0;
  gameState.correctAnswers = 0;
  gameState.incorrectAnswers = 0;
  gameState.attempts = [];
  gameState.events = [];
  gameState.gameEnded = false;
  gameState.isProcessing = false;
  gameState.phase = 'playing';
  syncDOMState();                   // GEN-PHASE-001 MANDATORY
  transitionScreen.hide();
  document.getElementById('game-area').style.display = 'block';
  progressBar.setLives(3);
  loadQuestion(1);
}
```

### 7.2 loadQuestion(roundNumber)

```javascript
function loadQuestion(roundNumber) {
  const round = gameState.content.rounds[roundNumber - 1];
  gameState.currentRound = roundNumber;
  gameState.isProcessing = false;

  // Update dataset display
  const datasetEl = document.getElementById('dataset-display');
  datasetEl.textContent = round.numbers.join(', ');

  // Update question text
  document.getElementById('question-text').textContent = round.question;

  // Render 4 option buttons (always generate dynamically — never hardcoded HTML)
  const grid = document.getElementById('options-grid');
  grid.innerHTML = '';
  round.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.setAttribute('data-testid', 'option-' + i);
    btn.setAttribute('data-value', opt);
    btn.textContent = opt;
    btn.addEventListener('click', () => handleOptionSelect(i, opt));
    grid.appendChild(btn);
  });

  // Hide feedback
  const feedbackEl = document.getElementById('answer-feedback');
  feedbackEl.textContent = '';
  feedbackEl.classList.add('hidden');

  // Update progress bar
  progressBar.setRound(roundNumber);
  syncDOMState();

  // (Re)start timer
  timer.reset();
  timer.start();
}
```

### 7.3 handleOptionSelect(index, selectedOption)

```javascript
function handleOptionSelect(index, selectedOption) {
  // Guard: prevent double-fire
  if (gameState.isProcessing || gameState.gameEnded) return;
  gameState.isProcessing = true;

  // Stop timer immediately
  timer.pause();

  // Disable all buttons
  document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);

  const round = gameState.content.rounds[gameState.currentRound - 1];
  const isCorrect = (String(selectedOption).trim() === String(round.correctAnswer).trim());

  // Visual: mark selected button + reveal correct
  const buttons = document.querySelectorAll('.option-btn');
  buttons[index].classList.add(isCorrect ? 'correct' : 'incorrect');
  if (!isCorrect) {
    buttons.forEach(btn => {
      if (btn.getAttribute('data-value') === round.correctAnswer) {
        btn.classList.add('correct');
      }
    });
  }

  // Feedback text (aria-live — screen reader friendly)
  const feedbackEl = document.getElementById('answer-feedback');
  feedbackEl.textContent = isCorrect ? round.feedbackCorrect : round.feedbackWrong;
  feedbackEl.classList.remove('hidden');

  // Track
  gameState.attempts.push({
    round: gameState.currentRound,
    selected: selectedOption,
    correct: round.correctAnswer,
    isCorrect,
    timestamp: Date.now()
  });

  if (isCorrect) {
    gameState.score += 10;
    gameState.correctAnswers++;
    FeedbackManager.sound('correct');
    FeedbackManager.playDynamicFeedback('correct', gameState.score);
  } else {
    gameState.lives--;
    gameState.incorrectAnswers++;
    progressBar.loseLife();
    syncDOMState();
    FeedbackManager.sound('incorrect');
  }

  // Advance after brief delay
  setTimeout(() => {
    feedbackEl.classList.add('hidden');
    feedbackEl.textContent = '';
    gameState.isProcessing = false;
    advanceGame();
  }, 1200);
}
```

### 7.4 handleTimeout()

```javascript
function handleTimeout() {
  if (gameState.isProcessing || gameState.gameEnded) return;
  gameState.isProcessing = true;

  // Disable all buttons
  document.querySelectorAll('.option-btn').forEach(btn => btn.disabled = true);

  const round = gameState.content.rounds[gameState.currentRound - 1];

  // Reveal correct answer
  document.querySelectorAll('.option-btn').forEach(btn => {
    if (btn.getAttribute('data-value') === round.correctAnswer) {
      btn.classList.add('correct');
    }
  });

  // Feedback
  const feedbackEl = document.getElementById('answer-feedback');
  feedbackEl.textContent = 'Time\'s up! ' + round.feedbackWrong;
  feedbackEl.classList.remove('hidden');

  gameState.lives--;
  gameState.incorrectAnswers++;
  progressBar.loseLife();
  syncDOMState();
  FeedbackManager.sound('incorrect');

  gameState.attempts.push({
    round: gameState.currentRound,
    selected: null,
    correct: round.correctAnswer,
    isCorrect: false,
    timeout: true,
    timestamp: Date.now()
  });

  setTimeout(() => {
    feedbackEl.classList.add('hidden');
    feedbackEl.textContent = '';
    gameState.isProcessing = false;
    advanceGame();
  }, 1200);
}
```

### 7.5 advanceGame()

```javascript
function advanceGame() {
  // Check lives first
  if (gameState.lives <= 0) {
    endGame(false);
    return;
  }

  // Check rounds
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame(true);
    return;
  }

  loadQuestion(gameState.currentRound + 1);
}
```

### 7.6 showGameOver() — called via endGame(false)

Game-over is handled through `endGame(false)` → `transitionScreen.show({...game_over object...})`. No separate `showGameOver()` function needed. `endGame` manages both paths.

### 7.7 restartGame()

```javascript
function restartGame() {
  // MANDATORY: destroy old timer before recreating
  if (timer) {
    timer.destroy();
    timer = null;
  }
  timer = new TimerComponent('timer-container', {
    timerType: 'decrease',
    format: 'sec',
    startTime: 45,
    endTime: 0,
    autoStart: false,
    onEnd: () => handleTimeout()
  });

  startGame();
}
```

**Why destroy + recreate:** Calling `timer.destroy()` without recreating leaves `timer` pointing to a destroyed object. Calling `startGame()` → `loadQuestion()` → `timer.reset(); timer.start()` on a destroyed timer is a no-op — the countdown never starts. Always recreate before `startGame()`.

### 7.8 Timer Configuration

```javascript
timer = new TimerComponent('timer-container', {
  timerType: 'decrease',
  format: 'sec',
  startTime: 45,
  endTime: 0,
  autoStart: false,
  onEnd: () => handleTimeout()
});
```

**Timer is created once in DOMContentLoaded, then destroyed + recreated in `restartGame()`.**

---

## 8. Validation

```javascript
function validateAnswer(userAnswer, correctAnswer) {
  return String(userAnswer).trim() === String(correctAnswer).trim();
}
```

String equality only — no numeric tolerance. `correctAnswer` in the schema is always a string ('6', '6.4') and `selectedOption` is pulled from `data-value` (also a string). The comparison is exact.

---

## 9. EndGame Metrics

```javascript
function endGame(isVictory) {
  if (gameState.gameEnded) return;
  gameState.gameEnded = true;
  gameState.isActive = false;

  // Stop timer
  timer.pause();

  // Set phase
  gameState.phase = isVictory ? 'results' : 'game_over';
  syncDOMState();   // MANDATORY on BOTH paths

  // Compute stars
  const correct = gameState.correctAnswers;
  let stars = 0;
  if (correct === 9) stars = 3;
  else if (correct >= 6) stars = 2;
  else if (correct >= 3) stars = 1;
  else stars = 0;

  const accuracy = Math.round((gameState.correctAnswers / gameState.totalRounds) * 100);

  // PostMessage — game_complete on BOTH victory AND game_over (MANDATORY)
  window.parent.postMessage({
    type: 'game_complete',
    gameId: 'stats-mean-direct',
    score: gameState.score,
    stars: stars,
    correctAnswers: gameState.correctAnswers,
    incorrectAnswers: gameState.incorrectAnswers,
    totalRounds: gameState.totalRounds,
    accuracy: accuracy,
    roundsCompleted: gameState.currentRound,
    livesRemaining: gameState.lives,
    isVictory: isVictory,
    duration: Date.now() - gameState.startTime,
    attempts: gameState.attempts,
    events: gameState.events
  }, '*');

  // Show transition screen
  if (isVictory) {
    transitionScreen.show({
      title: 'Well done!',
      subtitle: 'You calculated every mean correctly.',
      icons: ['🌟'],
      buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
    });
  } else {
    transitionScreen.show({
      title: 'Game Over',
      subtitle: 'Keep practising — mean calculation gets easier with practice.',
      icons: ['💔'],
      buttons: [{ label: 'Try again', action: 'restart', style: 'primary' }]
    });
  }
}

// MANDATORY window assignments — must appear at the BOTTOM of DOMContentLoaded callback:
window.endGame = endGame;
window.restartGame = restartGame;
window.gameState = gameState;   // also set at module scope above
// REQUIRED for test harness __ralph.jumpToRound():
window.loadQuestion = function(n) {
  gameState.currentRound = n - 1;
  gameState.gameEnded = false;
  gameState.isProcessing = false;
  loadQuestion(n);
};
```

---

## 10. CSS

```css
/* === Base Layout === */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: var(--mathai-background, #f8fafc);
  color: #1e293b;
  min-height: 100vh;
}

#app {
  max-width: 480px;
  margin: 0 auto;
  padding: 0 16px 24px;
}

/* === Game Area === */
#game-area {
  padding-top: 8px;
}

/* === Dataset Card === */
.dataset-card {
  background: #fff;
  border: 2px solid #cbd5e1;
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.dataset-box {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 0.06em;
  line-height: 1.6;
}

/* === Question Text === */
.question-text {
  font-size: 1.1rem;
  font-weight: 600;
  color: #334155;
  text-align: center;
  margin-bottom: 18px;
  line-height: 1.4;
}

/* === MCQ Options Grid (2×2) === */
.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.option-btn {
  min-height: 52px;
  min-width: 44px;
  padding: 12px 16px;
  font-size: 1.15rem;
  font-weight: 700;
  color: #1e40af;
  background: #fff;
  border: 2.5px solid #3b82f6;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  outline: none;
}

.option-btn:hover:not(:disabled) {
  background: #eff6ff;
  border-color: #2563eb;
}

.option-btn:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.option-btn.correct {
  background: #22c55e;
  border-color: #16a34a;
  color: #fff;
}

.option-btn.incorrect {
  background: #ef4444;
  border-color: #dc2626;
  color: #fff;
}

/* === Answer Feedback === */
.answer-feedback {
  font-size: 0.95rem;
  font-weight: 600;
  color: #0f172a;
  text-align: center;
  background: #f1f5f9;
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 8px;
  border-left: 4px solid #3b82f6;
  line-height: 1.5;
  transition: opacity 0.2s;
}

.answer-feedback.hidden {
  display: none;
}

/* === Results Screen — MANDATORY position:fixed z-index:100 === */
#results-screen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: rgba(255, 255, 255, 0.97);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
}

.results-title {
  font-size: 2rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 12px;
}

.results-stars {
  font-size: 2.5rem;
  margin-bottom: 16px;
  letter-spacing: 0.1em;
}

.results-stat {
  font-size: 1.1rem;
  color: #475569;
  margin-bottom: 8px;
}

.results-stat strong {
  color: #1e293b;
}
```

---

## 11. PostMessage Protocol

### Incoming: `game_init`

```json
{
  "type": "game_init",
  "data": {
    "rounds": [ ... ]
  }
}
```

Handler sets `gameState.content = data`, then shows start TransitionScreen.

### Outgoing: `game_complete` — MANDATORY on BOTH victory AND game-over paths

```javascript
// Sent in endGame(isVictory) — called on BOTH victory and game_over:
window.parent.postMessage({
  type: 'game_complete',
  gameId: 'stats-mean-direct',
  score: gameState.score,
  stars: stars,                        // 0–3
  correctAnswers: gameState.correctAnswers,
  incorrectAnswers: gameState.incorrectAnswers,
  totalRounds: gameState.totalRounds,
  accuracy: accuracy,                  // 0–100 integer
  roundsCompleted: gameState.currentRound,
  livesRemaining: gameState.lives,
  isVictory: isVictory,
  duration: Date.now() - gameState.startTime,
  attempts: gameState.attempts,
  events: gameState.events
}, '*');
```

**Contract requirement:** The message type MUST be `'game_complete'` (not `'game_end'` or `'GAME_COMPLETE'`). Contract tests assert this exact string on both the victory path AND the game_over path.

---

## 12. ScreenLayout Configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    progressBar: true,
    transitionScreen: true
  }
});
```

---

## 13. ProgressBar Configuration

```javascript
progressBar = new ProgressBarComponent({
  slotId: 'mathai-progress-slot',
  totalRounds: 9,
  totalLives: 3
});
```

**`slotId: 'mathai-progress-slot'` is MANDATORY.** The CDN injects the progress bar into the DOM slot with this ID. A missing or wrong `slotId` causes the progress bar to never render, and `progressBar.loseLife()` / `progressBar.setRound()` to throw.

---

## 13b. TransitionScreen Configuration (GEN-TRANSITION-API — object form MANDATORY)

**NEVER use `transitionScreen.show('string')` — the CDN has NO string-mode support. Always pass an object.**

```javascript
// Initialization (inside waitForPackages callback):
transitionScreen = new TransitionScreenComponent({
  onRestart: restartGame
});

// Show start screen (after content loaded):
transitionScreen.show({
  title: 'Find the Mean',
  subtitle: 'Calculate the average of each dataset — 9 rounds, 3 lives',
  icons: ['🔢'],
  buttons: [{ label: 'Play', action: 'restart', style: 'primary' }]
});

// Show in endGame(true) — victory:
transitionScreen.show({
  title: 'Well done!',
  subtitle: 'You calculated every mean correctly.',
  icons: ['🌟'],
  buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
});

// Show in endGame(false) — game over:
transitionScreen.show({
  title: 'Game Over',
  subtitle: 'Keep practising — mean calculation gets easier with practice.',
  icons: ['💔'],
  buttons: [{ label: 'Try again', action: 'restart', style: 'primary' }]
});
```

**`action: 'restart'` triggers `onRestart` (restartGame). Icons must be emoji strings only — never SVG.**

---

## 14. Test Scenarios (15 rows)

| # | Category | Scenario | Steps | Expected |
|---|---|---|---|---|
| TC-001 | game-flow | start-screen | Navigate to game URL. Do not click anything. | `document.getElementById('app').dataset.phase === 'start'` AND start button visible. |
| TC-002 | game-flow | game-start | Click the Play button. | `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND 4 buttons with `data-testid="option-0/1/2/3"` visible. |
| TC-003 | game-flow | correct-answer-advances | Start game. Click the button whose `data-value` matches round 1 `correctAnswer`. | `[data-testid="answer-feedback"]` becomes visible with correct feedback text. After 1200ms, `window.gameState.currentRound === 2`. |
| TC-004 | game-flow | wrong-answer-loses-life | Start game. Click a button whose `data-value` does NOT match `correctAnswer`. | `window.gameState.lives === 2`. `[data-testid="answer-feedback"]` shows wrong feedback. Incorrect button gets `.incorrect` class. Correct button gets `.correct` class. |
| TC-005 | game-flow | timeout-loses-life | Start game. Wait 46 seconds without clicking. | `window.gameState.lives === 2`. Correct button gets `.correct` class. `[data-testid="answer-feedback"]` shows "Time's up!" message. |
| TC-006 | game-flow | victory-after-9-rounds | Complete all 9 rounds without losing all lives. | `data-phase === 'results'` AND `game_complete` postMessage sent with `isVictory: true`. |
| TC-007 | game-flow | game-over-on-zero-lives | Lose 3 lives before completing all 9 rounds. | `data-phase === 'game_over'` AND `game_complete` postMessage sent with `isVictory: false`. |
| TC-008 | game-flow | restart-from-game-over | Reach game-over, click Restart button. | `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND `window.gameState.lives === 3`. |
| TC-009 | mechanics | correct-answer-scores-10 | Start game. Answer round 1 correctly. | `window.gameState.score === 10`. |
| TC-010 | mechanics | three-star-threshold | Answer all 9 rounds correctly. | `game_complete` message has `stars === 3` AND `correctAnswers === 9`. |
| TC-011 | mechanics | zero-star-threshold | Answer 0–2 rounds correctly (lose all lives or reach game-over early). | `game_complete` message has `stars === 0`. |
| TC-012 | mechanics | isprocessing-guard | Start game. Call `handleOptionSelect` twice in rapid succession (<50ms). | `window.gameState.attempts.length === 1` (not 2). Lives deducted only once. |
| TC-013 | state-sync | data-phase-playing | After clicking Play. | `document.getElementById('app').dataset.phase === 'playing'`. |
| TC-014 | contract | option-buttons-testid-and-value | Start game (round 1). | `[data-testid="option-0"]` exists AND all 4 buttons have `data-value` matching one of the round's options strings. |
| TC-015 | contract | game-complete-on-both-paths | Trigger both victory (complete 9 rounds) and game-over (lose 3 lives) in separate runs. | Both runs produce a `postMessage` with `type === 'game_complete'` (not 'game_end'). |

---

## 15. Anti-Pattern Checklist (PART-026)

The LLM generating this game MUST verify each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks Playwright tests. Use `.sound()` and `.playDynamicFeedback()` only.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame`** — assign at the bottom of DOMContentLoaded after function definitions. Also add `window.loadQuestion = function(n) { ... }` for test harness `__ralph.jumpToRound()`.
4. **Do NOT hardcode option button text in HTML** — all 4 buttons MUST be generated dynamically in `loadQuestion()` from `round.options[]`. Static HTML buttons that don't update between rounds is a bug.
5. **Do NOT forget `data-testid="option-N"` (positional) AND `data-value="<option>"` on every button** — tests use both selectors. Missing either causes all contract tests to fail.
6. **Do NOT forget `data-testid="answer-feedback"` on the feedback div** — and `aria-live="polite"` and `role="status"`. Tests assert the attribute. Screen readers require it.
7. **Do NOT reuse the destroyed timer in restartGame()** — ALWAYS call `timer.destroy()` then `timer = new TimerComponent(...)` before `startGame()`. A destroyed timer is a no-op and the countdown never starts.
8. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionSelect` twice. Set `isProcessing = true` at entry and `false` in the `setTimeout` callback BEFORE calling `advanceGame()`.
9. **Do NOT forget `gameState.phase = 'playing'` + `syncDOMState()` in `startGame()`** — and phase = 'results'/'game_over' + `syncDOMState()` in `endGame()`. Both paths must call syncDOMState. Tests rely on `data-phase` to wait for transitions.
10. **Do NOT set `gameState.phase` without immediately calling `syncDOMState()`** — there must be no code between the phase assignment and the syncDOMState call.
11. **Do NOT send `type: 'game_end'` in the postMessage** — the contract requires `type: 'game_complete'`. Verify the exact string.
12. **Do NOT forget `#results-screen { position: fixed; z-index: 100 }`** — without this the results screen renders behind other elements and is invisible to Playwright.
13. **Do NOT reset `gameState.gameEnded = false` without also resetting all other state** — `restartGame()` calls `startGame()` which must reset ALL fields (lives, score, currentRound, correctAnswers, incorrectAnswers, attempts, events, gameEnded).
14. **Do NOT call `timer.start()` before the timer is attached to the DOM** — `#timer-container` must exist in the DOM at the point `new TimerComponent('timer-container', ...)` is called. In this game, the timer is initialised in DOMContentLoaded after `waitForPackages`, so the container is always present.
15. **Do NOT forget `progressBar.setRound(roundNumber)` in `loadQuestion()`** — if omitted, the progress bar never advances and tests asserting round count in the progress bar will fail.
