# Middle Ground — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block (module scope, NOT inside DOMContentLoaded). The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame`. Tests call these directly.

> **CRITICAL — TimerComponent destroy/recreate on restart.** `restartGame()` MUST call `timer.destroy()` then `timer = new TimerComponent(...)` before calling `startGame()`. Reusing the old timer after destroy causes a no-op and the timer never starts.

> **CRITICAL — gameId MUST be the FIRST field in the gameState object literal.** The pipeline validator checks that `gameState.gameId` is set and matches the game directory name. Any other field before gameId causes the contract check to fail.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 3 (Apply) for the skill `stats-median`: given a small dataset of 5–7 numbers, the learner must find the median (middle value of ordered data) and select the correct answer from four options. The four distractors are designed to surface documented student misconceptions about computing median: (1) picking the middle-position value WITHOUT sorting first — the most common error per AAMT Top Drawer; (2) for even-count datasets, picking one of the two middle values instead of averaging them; (3) off-by-one index error (picking the value at position n//2 instead of (n+1)//2); (4) computing the mean instead of the median (confusion between additive and positional measures). Difficulty increases across three tiers: Easy (odd n=5, data already sorted — step 1 trivially done, median is the 3rd value), Medium (even n=6 requiring averaging of two middle values, OR unsorted odd n=5 requiring students to sort first), Hard (unsorted data with repeated values and/or n=7 requiring careful full sort). 45 seconds per round allows mental sorting without feeling rushed. Session predecessor: stats-mean-direct (L2–L3 — compute mean). Session successor: stats-mode (L3 — compute mode for grouped data). Interaction type: `median-computation-mcq`.
>
> **RESEARCH SOURCES (Exa, 2026-03-23):**
> - Source A: NCERT Class 10 Maths Chapter 14 Statistics (via learncbse.in/askiitians.com NCERT Solutions, 2024) — canonical Indian curriculum definition: "Median is a measure of central tendency that gives the value of the middle-most observation in the data. To find the median of ungrouped data, arrange in ascending order. If n is odd, median = value at position (n+1)/2. If n is even, median = average of values at positions n/2 and n/2+1." The empirical formula 3 Median = Mode + 2 Mean is also introduced in this chapter. Round design for this game draws directly from NCERT Class 10 Ch 14 exercise contexts (monthly consumption, ages of policy holders) adapted for small ungrouped datasets. (https://www.learncbse.in/statistics-class-10-notes/, https://www.askiitians.com/school-exams/cbse/ncert-solutions-for-class-10-maths-chapter-14-statistics.html)
> - Source B: AAMT Top Drawer "Misunderstandings of averages" (Australian Association of Mathematics Teachers, topdrawer.aamt.edu.au) — documents two primary difficulties with median: (1) "the data must actually be ordered — students can believe it is possible to find the median without ordering the data set"; (2) students confuse the median with the mean in symmetric distributions where they coincide, making it critical to choose datasets where mean ≠ median for at least the medium and hard tiers. The hard rounds explicitly use skewed datasets (outlier values) where median ≠ mean, directly targeting this conflation. Distractor M-no-sort (pick middle-position value before sorting) is the highest-frequency error documented by AAMT. (https://topdrawer.aamt.edu.au/Statistics/Misunderstandings/Misunderstandings-of-averages)
> - Source C: Bezuidenhout, H. (2014) "Median: The middle of what? Grade 10's misconceptions" (LinkedIn/ResearchGate) — classroom study showing that students interpret "middle" as the spatial midpoint between the minimum and maximum values, not the middle-ranked observation. This spatial confusion is targeted in Hard Round 9: dataset has a large outlier so the spatial midpoint ≠ ranked median, making M-no-sort extra plausible.

---

## 1. Game Identity

| Field | Value |
|---|---|
| **Title** | Middle Ground |
| **Game ID** | `stats-median` |
| **Type** | standard |
| **Session** | Statistics Session 2 — Game 3 of 4 |
| **Bloom Level** | L3 Apply |
| **Description** | Students find the median of a small dataset (5–7 numbers) by sorting and picking the middle value (or averaging the two middle values for even n). MCQ with 4 options. 9 rounds across 3 difficulty tiers. 3 lives — a life is lost on wrong answer OR timeout. Timer: 45 seconds per round. Stars based on correct answers. Session predecessor: stats-mean-direct (L2–L3 — compute mean). Session successor: stats-mode (L3 — grouped data mode formula). Targets NCERT Class 10 Ch 14 Section 14.3 (Median of Ungrouped Data). |

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
| PART-027 | Play Area Construction        | YES             | Layout: dataset display (numbers in a styled card) + question text + 4 MCQ option buttons in 2×2 grid + feedback text div       |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with numbers, sortedNumbers, question, options (4), correctAnswer, distractorNotes, misconceptionTags, difficulty |
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
  gameId: 'stats-median',
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
            "description": "The dataset AS PRESENTED to the learner (may be unsorted). Easy rounds: already sorted, odd n=5. Medium rounds: unsorted OR even n=6. Hard rounds: unsorted, may include repeated values, n=5–7."
          },
          "sortedNumbers": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 5,
            "maxItems": 7,
            "description": "The dataset in ascending sorted order. Used in feedback to show the correct working. Must be the same values as numbers[], just sorted."
          },
          "question": {
            "type": "string",
            "description": "The question shown above the MCQ buttons. Always a variant of 'What is the median of these numbers?' with optional real-world framing."
          },
          "correctAnswer": {
            "type": "string",
            "description": "The correct median as a string. Whole number or one decimal place (for even-n average). Must match one of the options strings exactly."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. One is the correct median. The remaining three target documented misconceptions: (D1) M-no-sort — the value at the middle position of the UNSORTED array; (D2) M-even-median — for even n, one of the two middle values instead of their average; (D3) M-use-mean — the arithmetic mean of the dataset; (D4) M-wrong-middle — value at position n//2 (0-indexed) instead of (n-1)//2. Options must be in shuffled order. For odd-n easy rounds where data is pre-sorted, replace M-no-sort with M-wrong-middle (off-by-one index)."
          },
          "difficulty": {
            "type": "string",
            "enum": ["easy", "medium", "hard"],
            "description": "easy = rounds 1–3 (odd n=5, pre-sorted), medium = rounds 4–6 (even n=6 OR unsorted odd), hard = rounds 7–9 (unsorted, repeated values or n=7)."
          },
          "distractorNotes": {
            "type": "string",
            "description": "Internal note for the LLM explaining what each distractor represents. Not shown to the learner. Example: 'D1=M-no-sort(3rd value of unsorted=7), D2=M-even-median(pick lower middle=6), D3=M-use-mean(mean=7.2)'"
          },
          "misconceptionTags": {
            "type": "array",
            "items": { "type": "string", "enum": ["M-no-sort", "M-even-median", "M-use-mean", "M-wrong-middle"] },
            "description": "Tags for the misconceptions targeted by the distractors in this round. One tag per distractor (up to 3)."
          },
          "feedbackCorrect": {
            "type": "string",
            "description": "One sentence shown briefly on correct answer. Must show the sorted order and the winning value. Example: 'Correct! Sorted: 1, 3, 5, 7, 9 → middle value is 5.' Max 25 words."
          },
          "feedbackWrong": {
            "type": "string",
            "description": "One sentence shown briefly on wrong answer before advancing. Must name the correct answer and show the key step. Example: 'Median = middle of sorted data: 2, 4, 6, 8, 10 → 6.' Max 30 words."
          }
        },
        "required": ["numbers", "sortedNumbers", "question", "correctAnswer", "options", "difficulty", "distractorNotes", "misconceptionTags", "feedbackCorrect", "feedbackWrong"]
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

Field names in each round object MUST match the inputSchema: `numbers` (array), `sortedNumbers` (array), `question` (string), `correctAnswer` (string), `options` (array of 4 strings), `difficulty` (string), `distractorNotes` (string), `misconceptionTags` (array), `feedbackCorrect` (string), `feedbackWrong` (string).

```javascript
// FIELD NAMES PER SCHEMA: numbers (array), sortedNumbers (array), question (string),
// correctAnswer (string), options (array of 4 strings), difficulty ('easy'|'medium'|'hard'),
// distractorNotes (string), misconceptionTags (array), feedbackCorrect (string), feedbackWrong (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1 — EASY — pre-sorted, odd n=5, median = 3rd value
    // Numbers: 1, 3, 5, 7, 9  (already sorted)
    // n=5 (odd) → median = value at position (5+1)/2 = 3rd = 5
    // NCERT formula: position = (n+1)/2 for odd n
    // D1=M-wrong-middle: position 2 (0-indexed 1st) = 3 (off-by-one)
    // D2=M-use-mean: mean = (1+3+5+7+9)/5 = 25/5 = 5 = median (same — use 4th value instead)
    // D3=M-wrong-middle (high): position 4 = 7
    // Correct=5. For symmetric arithmetic progression, mean=median. D2 replaced with D3=7 (4th value).
    // Distractors: 3 (2nd value, off-by-one low), 7 (4th value, off-by-one high), 9 (max/last)
    // ============================================================
    {
      numbers: [1, 3, 5, 7, 9],
      sortedNumbers: [1, 3, 5, 7, 9],
      question: 'What is the median of: 1, 3, 5, 7, 9?',
      correctAnswer: '5',
      options: ['3', '5', '7', '9'],
      difficulty: 'easy',
      distractorNotes: 'D1=3 (2nd value — off-by-one low, M-wrong-middle), D2=7 (4th value — off-by-one high, M-wrong-middle), D3=9 (last/maximum — M-wrong-middle extreme). Correct=5 (3rd value, position (5+1)/2=3). Data pre-sorted so M-no-sort not applicable.',
      misconceptionTags: ['M-wrong-middle', 'M-wrong-middle', 'M-wrong-middle'],
      feedbackCorrect: 'Correct! Sorted: 1, 3, 5, 7, 9 → 5 values, middle is 3rd = 5.',
      feedbackWrong: 'Median = middle of sorted data: 1, 3, 5, 7, 9. With 5 values, the 3rd value is 5.'
    },

    // ============================================================
    // ROUND 2 — EASY — pre-sorted, odd n=5, different values
    // Numbers: 4, 8, 12, 16, 20  (already sorted)
    // n=5 → median = 3rd value = 12
    // mean = (4+8+12+16+20)/5 = 60/5 = 12 = median (AP again)
    // D1=8 (2nd value, M-wrong-middle), D2=16 (4th value, M-wrong-middle), D3=60 (sum, M-use-mean no-divide)
    // Use D3=60 to catch student who sums without dividing (sum confusion)
    // ============================================================
    {
      numbers: [4, 8, 12, 16, 20],
      sortedNumbers: [4, 8, 12, 16, 20],
      question: 'Find the median of: 4, 8, 12, 16, 20',
      correctAnswer: '12',
      options: ['8', '12', '16', '60'],
      difficulty: 'easy',
      distractorNotes: 'D1=8 (2nd value — off-by-one low, M-wrong-middle), D2=16 (4th value — off-by-one high, M-wrong-middle), D3=60 (sum of all values — confuses median with sum, M-use-mean). Correct=12 (3rd value). Data pre-sorted.',
      misconceptionTags: ['M-wrong-middle', 'M-wrong-middle', 'M-use-mean'],
      feedbackCorrect: 'Correct! With 5 sorted values, the median is the 3rd: 4, 8, 12, 16, 20 → 12.',
      feedbackWrong: 'Median = middle value of sorted data. 5 values → 3rd value = 12, not the sum (60).'
    },

    // ============================================================
    // ROUND 3 — EASY — pre-sorted, odd n=5, real-world context
    // Numbers: 2, 5, 8, 11, 14  (already sorted)
    // Context: marks scored in 5 quizzes
    // n=5 → median = 3rd value = 8
    // mean = (2+5+8+11+14)/5 = 40/5 = 8 = median (AP — symmetric)
    // D1=5 (2nd, M-wrong-middle), D2=11 (4th, M-wrong-middle), D3=8 is correct — use D3=40 (sum)
    // D3=40 (sum without dividing) as M-use-mean variant
    // ============================================================
    {
      numbers: [2, 5, 8, 11, 14],
      sortedNumbers: [2, 5, 8, 11, 14],
      question: 'A student scored 2, 5, 8, 11, and 14 in five quizzes (already in order). What is the median score?',
      correctAnswer: '8',
      options: ['5', '8', '11', '40'],
      difficulty: 'easy',
      distractorNotes: 'D1=5 (2nd value, M-wrong-middle), D2=11 (4th value, M-wrong-middle), D3=40 (sum of scores, M-use-mean). Correct=8 (3rd value). Data pre-sorted. NCERT context: test scores.',
      misconceptionTags: ['M-wrong-middle', 'M-wrong-middle', 'M-use-mean'],
      feedbackCorrect: 'Correct! 5 scores sorted: 2, 5, 8, 11, 14. The middle (3rd) is 8.',
      feedbackWrong: 'Median = 3rd value when 5 scores are sorted: 2, 5, 8, 11, 14 → 8. Don\'t add them up!'
    },

    // ============================================================
    // ROUND 4 — MEDIUM — UNSORTED, odd n=5 (must sort first)
    // Numbers: 9, 3, 7, 1, 5  (unsorted)
    // Sorted: 1, 3, 5, 7, 9 → median = 3rd = 5
    // mean = (9+3+7+1+5)/5 = 25/5 = 5 = median (symmetric again — use M-no-sort)
    // D1=M-no-sort: middle position of UNSORTED = index 2 = 7 (3rd element of [9,3,7,1,5])
    // D2=M-wrong-middle: 4th of sorted = 7 — same as D1; use 3 (2nd of sorted) instead
    // D3=M-use-mean: mean=5=correct — same; use 9 (max) as M-wrong-middle
    // Distractors: 7 (M-no-sort — 3rd of unsorted), 3 (2nd of sorted, M-wrong-middle), 9 (max, M-wrong-middle)
    // AAMT Top Drawer: "data must actually be ordered" — most common medium-level error
    // ============================================================
    {
      numbers: [9, 3, 7, 1, 5],
      sortedNumbers: [1, 3, 5, 7, 9],
      question: 'What is the median of: 9, 3, 7, 1, 5?',
      correctAnswer: '5',
      options: ['3', '5', '7', '9'],
      difficulty: 'medium',
      distractorNotes: 'D1=7 (3rd value of UNSORTED array [9,3,7,1,5] — M-no-sort, AAMT Top Drawer primary error), D2=3 (2nd of sorted [1,3,5,7,9] — off-by-one low, M-wrong-middle), D3=9 (last of sorted — maximum, M-wrong-middle). Correct=5 (3rd of sorted). Must sort before finding middle.',
      misconceptionTags: ['M-no-sort', 'M-wrong-middle', 'M-wrong-middle'],
      feedbackCorrect: 'Correct! First sort: 1, 3, 5, 7, 9 → middle (3rd) value = 5.',
      feedbackWrong: 'Always sort first! 9, 3, 7, 1, 5 → sorted: 1, 3, 5, 7, 9 → median = 5 (3rd value).'
    },

    // ============================================================
    // ROUND 5 — MEDIUM — EVEN n=6, must average two middle values
    // Numbers: 4, 10, 2, 8, 6, 12  (unsorted)
    // Sorted: 2, 4, 6, 8, 10, 12
    // n=6 (even) → median = average of 3rd and 4th = (6+8)/2 = 7
    // mean = (4+10+2+8+6+12)/6 = 42/6 = 7 = median (symmetric AP again; use D-no-sort)
    // D1=M-even-median (lower): pick 3rd value only = 6 (not average)
    // D2=M-even-median (upper): pick 4th value only = 8 (not average)
    // D3=M-no-sort: middle-ish of unsorted — position 3 (0-indexed) of [4,10,2,8,6,12] = 8. Same as D2.
    //   Use M-no-sort → position 2 (0-indexed) of unsorted = 2. Too small. Use position 3 = 8. Same as D2.
    //   Use mean of unsorted middle two (positions 2,3 of unsorted = 2,8) → (2+8)/2 = 5. Distinct.
    // Distractors: 6 (lower middle only, M-even-median), 8 (upper middle only, M-even-median), 5 (wrong pair, M-no-sort)
    // NCERT: "If n is even, median = average of (n/2)th and (n/2+1)th observations"
    // ============================================================
    {
      numbers: [4, 10, 2, 8, 6, 12],
      sortedNumbers: [2, 4, 6, 8, 10, 12],
      question: 'Find the median of: 4, 10, 2, 8, 6, 12',
      correctAnswer: '7',
      options: ['5', '6', '7', '8'],
      difficulty: 'medium',
      distractorNotes: 'D1=6 (3rd value of sorted only, M-even-median — picked lower middle), D2=8 (4th value of sorted only, M-even-median — picked upper middle), D3=5 (averaged positions 2,3 of unsorted [2,8] without sorting, M-no-sort). Correct=7 = (6+8)/2. NCERT even-n formula: average of 3rd and 4th of sorted.',
      misconceptionTags: ['M-even-median', 'M-even-median', 'M-no-sort'],
      feedbackCorrect: 'Correct! Sorted: 2, 4, 6, 8, 10, 12. Even n=6 → average middle two: (6+8)÷2 = 7.',
      feedbackWrong: 'n=6 is even: sort first (2,4,6,8,10,12), then average 3rd and 4th: (6+8)÷2 = 7.'
    },

    // ============================================================
    // ROUND 6 — MEDIUM — EVEN n=6, real-world context, median ≠ mean
    // Numbers: 15, 9, 21, 3, 27, 9  (unsorted, repeated value 9)
    // Sorted: 3, 9, 9, 15, 21, 27
    // n=6 (even) → median = average of 3rd and 4th = (9+15)/2 = 12
    // mean = (15+9+21+3+27+9)/6 = 84/6 = 14 ≠ median (key distinction)
    // D1=M-even-median (lower): 3rd of sorted = 9
    // D2=M-even-median (upper): 4th of sorted = 15
    // D3=M-use-mean: mean = 14
    // Distractors: 9 (lower middle, M-even-median), 14 (mean, M-use-mean), 15 (upper middle, M-even-median)
    // median ≠ mean — directly targets mean/median conflation (AAMT Top Drawer)
    // ============================================================
    {
      numbers: [15, 9, 21, 3, 27, 9],
      sortedNumbers: [3, 9, 9, 15, 21, 27],
      question: 'A shop recorded daily sales (units) over 6 days: 15, 9, 21, 3, 27, 9. What is the median?',
      correctAnswer: '12',
      options: ['9', '12', '14', '15'],
      difficulty: 'medium',
      distractorNotes: 'D1=9 (3rd value of sorted [3,9,9,15,21,27] — lower of two middles, M-even-median), D2=15 (4th value of sorted — upper of two middles, M-even-median), D3=14 (mean=84/6=14, M-use-mean). Correct=12=(9+15)/2. Skewed data: mean(14)≠median(12). Targets AAMT mean/median conflation.',
      misconceptionTags: ['M-even-median', 'M-use-mean', 'M-even-median'],
      feedbackCorrect: 'Correct! Sorted: 3,9,9,15,21,27. Average 3rd and 4th: (9+15)÷2 = 12.',
      feedbackWrong: 'Sort: 3,9,9,15,21,27. Even n=6 → average 3rd+4th: (9+15)÷2=12. Mean(14) ≠ median(12).'
    },

    // ============================================================
    // ROUND 7 — HARD — UNSORTED, repeated values, odd n=7
    // Numbers: 8, 3, 5, 3, 9, 3, 7  (unsorted, 3 appears 3 times)
    // Sorted: 3, 3, 3, 5, 7, 8, 9
    // n=7 (odd) → median = 4th value = 5
    // mean = (8+3+5+3+9+3+7)/7 = 38/7 ≈ 5.4 ≠ median
    // D1=M-no-sort: 4th of UNSORTED [8,3,5,3,9,3,7] = index 3 = 3
    // D2=M-use-mean: ≈5.4 (one decimal) — distinct from correct 5
    // D3=M-wrong-middle: 3rd of sorted = 3 (same as D1 — use 7 instead, 5th of sorted)
    //   Revised: D3=7 (5th value of sorted — off-by-one high, M-wrong-middle)
    // Distractors: 3 (M-no-sort), 5.4 (M-use-mean), 7 (M-wrong-middle)
    // Research: Bezuidenhout (2014) — "spatial midpoint between min and max" confusion
    //   spatial mid = (3+9)/2 = 6 — could use as D3. Use 6 as D3=M-wrong-middle (spatial).
    //   Replace 7 with 6.
    // Final distractors: 3 (M-no-sort), 5.4 (M-use-mean), 6 (spatial-middle, M-wrong-middle)
    // ============================================================
    {
      numbers: [8, 3, 5, 3, 9, 3, 7],
      sortedNumbers: [3, 3, 3, 5, 7, 8, 9],
      question: 'What is the median of: 8, 3, 5, 3, 9, 3, 7?',
      correctAnswer: '5',
      options: ['3', '5', '5.4', '6'],
      difficulty: 'hard',
      distractorNotes: 'D1=3 (4th of UNSORTED [8,3,5,3,9,3,7] = index 3 = 3, M-no-sort), D2=5.4 (mean=38/7≈5.4, M-use-mean), D3=6 (spatial midpoint between min=3 and max=9 → (3+9)/2=6, M-wrong-middle — Bezuidenhout 2014). Correct=5 (4th of sorted [3,3,3,5,7,8,9]).',
      misconceptionTags: ['M-no-sort', 'M-use-mean', 'M-wrong-middle'],
      feedbackCorrect: 'Correct! Sort: 3,3,3,5,7,8,9 → 7 values, 4th = 5. Mode (3) and mean (5.4) are different!',
      feedbackWrong: 'Sort first: 3,3,3,5,7,8,9 → median = 4th value = 5. Don\'t pick 3 (the mode) or 5.4 (the mean).'
    },

    // ============================================================
    // ROUND 8 — HARD — UNSORTED, odd n=7, outlier creates mean≠median
    // Numbers: 6, 2, 4, 30, 4, 8, 4  (unsorted, outlier=30, 4 appears 3 times)
    // Sorted: 2, 4, 4, 4, 6, 8, 30
    // n=7 (odd) → median = 4th value = 4
    // mean = (6+2+4+30+4+8+4)/7 = 58/7 ≈ 8.3 (outlier pulls mean up)
    // D1=M-no-sort: 4th of UNSORTED [6,2,4,30,4,8,4] = index 3 = 30 (very plausible trap)
    // D2=M-use-mean: ≈8.3 (outlier inflated mean — directly demonstrates why median preferred for skewed data)
    // D3=M-wrong-middle: 5th of sorted = 6 (off-by-one high) OR spatial=(2+30)/2=16
    //   Use spatial=16 (Bezuidenhout confusion) as D3
    // Final distractors: 30 (M-no-sort), 8.3 (M-use-mean), 16 (M-wrong-middle spatial)
    // Context: daily rainfall with one extreme storm day — NCERT real-world spirit
    // ============================================================
    {
      numbers: [6, 2, 4, 30, 4, 8, 4],
      sortedNumbers: [2, 4, 4, 4, 6, 8, 30],
      question: 'Daily rainfall (mm) recorded for 7 days: 6, 2, 4, 30, 4, 8, 4. Find the median.',
      correctAnswer: '4',
      options: ['4', '8.3', '16', '30'],
      difficulty: 'hard',
      distractorNotes: 'D1=30 (4th of UNSORTED [6,2,4,30,4,8,4] = index 3 = 30, M-no-sort — very compelling trap since 30 is in the middle position of unsorted data), D2=8.3 (mean=58/7≈8.3, M-use-mean — outlier inflates mean above median), D3=16 (spatial midpoint (2+30)/2=16, M-wrong-middle — Bezuidenhout 2014). Correct=4 (4th of sorted). Demonstrates why median is robust to outliers.',
      misconceptionTags: ['M-no-sort', 'M-use-mean', 'M-wrong-middle'],
      feedbackCorrect: 'Correct! Sort: 2,4,4,4,6,8,30 → 4th = 4. The outlier (30) barely affects median but skews mean to 8.3!',
      feedbackWrong: 'Sort first: 2,4,4,4,6,8,30 → median = 4th value = 4. The extreme 30 is at position 7, not the middle.'
    },

    // ============================================================
    // ROUND 9 — HARD — UNSORTED, even n=6, repeated values, mean≠median, spatial trap
    // Numbers: 7, 19, 7, 11, 3, 13  (unsorted, 7 appears twice)
    // Sorted: 3, 7, 7, 11, 13, 19
    // n=6 (even) → median = average of 3rd and 4th = (7+11)/2 = 9
    // mean = (7+19+7+11+3+13)/6 = 60/6 = 10 ≠ median
    // D1=M-no-sort: average of positions 3,4 of UNSORTED [7,19,7,11,3,13] = (7+11)/2 = 9 — same as correct!
    //   Try: positions 2,3 of unsorted (0-indexed) = (7, 7) → average = 7. Distinct. Use D1=7.
    //   Actually M-no-sort for even-n: take middle two of unsorted directly.
    //   Unsorted: [7,19,7,11,3,13]. Middle two of 6 items = positions 3,4 (1-indexed) = 11, 3 → (11+3)/2=7.
    // D1=7 (M-no-sort — average of middle two positions of unsorted array)
    // D2=M-even-median: pick lower of sorted middles = 3rd of sorted = 7. Same as D1.
    //   Use upper: 4th of sorted = 11. D2=11 (M-even-median — picked upper middle only).
    // D3=M-use-mean: mean=10
    // Final distractors: 7 (M-no-sort), 10 (M-use-mean), 11 (M-even-median)
    // Spatial midpoint = (3+19)/2 = 11. Same as D3. Keep D3=11 but tag as both.
    // Bezuidenhout 2014: spatial middle of [3..19] = 11 — same as upper-middle value, strong trap.
    // ============================================================
    {
      numbers: [7, 19, 7, 11, 3, 13],
      sortedNumbers: [3, 7, 7, 11, 13, 19],
      question: 'What is the median of: 7, 19, 7, 11, 3, 13?',
      correctAnswer: '9',
      options: ['7', '9', '10', '11'],
      difficulty: 'hard',
      distractorNotes: 'D1=7 (average of middle two of UNSORTED: positions 3,4 of [7,19,7,11,3,13] = (11+3)/2=7, M-no-sort), D2=10 (mean=60/6=10, M-use-mean), D3=11 (4th of sorted [3,7,7,11,13,19] — picked upper middle only without averaging, M-even-median; also equals spatial midpoint (3+19)/2=11). Correct=9=(7+11)/2. Data unsorted, even n, repeated values, skewed.',
      misconceptionTags: ['M-no-sort', 'M-use-mean', 'M-even-median'],
      feedbackCorrect: 'Correct! Sort: 3,7,7,11,13,19. Even n=6 → average 3rd and 4th: (7+11)÷2 = 9.',
      feedbackWrong: 'Sort: 3,7,7,11,13,19. n=6 → average 3rd+4th: (7+11)÷2=9. Mean(10) and upper-middle(11) are wrong.'
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
  <title>Middle Ground</title>
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

String equality only — no numeric tolerance. `correctAnswer` in the schema is always a string ('5', '7', '9', '12') and `selectedOption` is pulled from `data-value` (also a string). The comparison is exact. Note: Round 5 correct answer is '7' (whole number from averaging 6+8), Round 7 is '5.4' distractor only — correct is '5'. Round 8 has '8.3' as a distractor string — correct is '4'. All correctAnswer values in the fallback content are whole numbers or one-decimal strings.

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
    gameId: 'stats-median',
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
      subtitle: 'You found every median correctly.',
      icons: ['🌟'],
      buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
    });
  } else {
    transitionScreen.show({
      title: 'Game Over',
      subtitle: 'Keep practising — finding the median gets easier with practice.',
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

/* === MCQ Options Grid (2x2) === */
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
  color: #7c3aed;
  background: #fff;
  border: 2.5px solid #8b5cf6;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  outline: none;
}

.option-btn:hover:not(:disabled) {
  background: #f5f3ff;
  border-color: #7c3aed;
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
  background: #f5f3ff;
  border-radius: 8px;
  padding: 10px 14px;
  margin-top: 8px;
  border-left: 4px solid #8b5cf6;
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
  gameId: 'stats-median',
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
  title: 'Find the Median',
  subtitle: 'Order each dataset and pick the middle value — 9 rounds, 3 lives',
  icons: ['📊'],
  buttons: [{ label: 'Play', action: 'restart', style: 'primary' }]
});

// Show in endGame(true) — victory:
transitionScreen.show({
  title: 'Well done!',
  subtitle: 'You found every median correctly.',
  icons: ['🌟'],
  buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
});

// Show in endGame(false) — game over:
transitionScreen.show({
  title: 'Game Over',
  subtitle: 'Keep practising — finding the median gets easier with practice.',
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
