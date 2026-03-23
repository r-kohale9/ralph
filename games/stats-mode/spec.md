# Most Common — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block (module scope, NOT inside DOMContentLoaded). The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame`. Tests call these directly.

> **CRITICAL — TimerComponent destroy/recreate on restart.** `restartGame()` MUST call `timer.destroy()` then `timer = new TimerComponent(...)` before calling `startGame()`. Reusing the old timer after destroy causes a no-op and the timer never starts.

> **CRITICAL — gameId MUST be the FIRST field in the gameState object literal.** The pipeline validator checks that `gameState.gameId` is set and matches the game directory name. Any other field before gameId causes the contract check to fail.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 3 (Apply) for the skill `stats-mode`: given a small dataset or a grouped frequency table, the learner must find the mode (most frequently occurring value, or modal class plus formula application for grouped data) and select the correct answer from four MCQ options. The four distractors are designed to surface documented student misconceptions about computing mode: (1) M-mean-confusion — student computes the arithmetic mean instead of finding the most frequent value; (2) M-median-confusion — student picks the middle-positioned value (median) instead of the mode; (3) M-multiple-mode — student incorrectly identifies only one mode in a bimodal dataset (failing to report all modes); (4) M-formula-error — for grouped data, student substitutes f₀ and f₂ incorrectly (off-by-one in frequency table rows when reading L, f₁, f₀, f₂, h). Difficulty increases across three tiers: Easy (small ungrouped datasets n=7–9 with one clear mode — median and mean are distractors), Medium (bimodal datasets or careful frequency-counting challenges where the M-multiple-mode misconception is targeted), Hard (grouped frequency table data requiring the empirical formula Mode = L + [(f₁-f₀)/(2f₁-f₀-f₂)]×h). 45 seconds per round. Session predecessor: stats-median (L3 — find median). Session successor: none — terminal game in Statistics Session 2.
>
> **RESEARCH SOURCES (Exa, 2026-03-23):**
> - Source A: NCERT Class 10 Maths Chapter 13 Statistics (ncert.nic.in/textbook/pdf/jemh113.pdf, 2024-25 edition) — canonical Indian curriculum definition and examples for grouped-data mode. Section 13.3 "Mode of Grouped Data": "A mode is a value among the observations which occurs most often, that is, the value of the observation having the maximum frequency." For grouped data with equal class widths, the modal class is the class with the highest frequency. The mode formula: `Mode = L + [(f₁ − f₀) / (2f₁ − f₀ − f₂)] × h` where L = lower limit of modal class, f₁ = frequency of modal class, f₀ = frequency of class PRECEDING modal class, f₂ = frequency of class SUCCEEDING modal class, h = class size. NCERT Example 5: family size data — modal class 3–5 (f₁=8), preceding class 1–3 (f₀=7), succeeding class 5–7 (f₂=2), L=3, h=2 → Mode = 3 + [(8−7)/(16−7−2)]×2 = 3 + (1/7)×2 ≈ 3.286. NCERT Example 6: marks distribution — modal class 40–55 (f₁=7), f₀=3, f₂=6, L=40, h=15 → Mode = 40 + [(7−3)/(14−3−6)]×15 = 40 + 12 = 52.
> - Source B: IASE Statistics Education Research Journal — "Undergraduate students' inconsistent routines when engaging in statistical reasoning concerning mode" (iase-pub.org/ojs/SERJ/article/view/691, 2023). Study of 43 undergraduate students: two key inconsistent routines identified: (a) students describe the dataset display differently depending on how data is presented (list vs frequency table), causing them to apply different (often wrong) procedures; (b) disconnection between routine and endorsed narrative — students know the definition of mode ("most frequent") but execute a different algorithm (e.g., sort and pick middle). This directly informs distractor M-median-confusion: it is not random confusion but a deeply-wired procedural routine. Round design for medium and hard tiers presents data in multiple representations (list and frequency table) to deliberately surface this routine conflict.
> - Source C: Enisoğlu (2014) "Seventh grade students' possible solution strategies, errors and misinterpretations regarding the concepts of mean, median and mode given in bar graph representations" (METU, hdl.handle.net/11511/24256). Study of 233 seventh-grade students: identified mode-specific errors: (1) "inappropriate usage of averaging algorithm" — student averages all values instead of finding the most frequent (M-mean-confusion); (2) "forming incomplete data set" — for bimodal data, student reports only ONE mode, missing the second (M-multiple-mode); (3) "incorrect largest and/or smallest data values" — student picks the maximum or minimum value rather than the most frequent (M-freq-extremum). This last error is used as D4 in medium rounds where the maximum value coincides with a plausible-looking but incorrect answer. Round design explicitly includes bimodal datasets in medium tier to target (2).

---

## 1. Game Identity

| Field | Value |
|---|---|
| **Title** | Most Common |
| **Game ID** | `stats-mode` |
| **Type** | standard |
| **Session** | Statistics Session 2 — Game 4 of 4 |
| **Bloom Level** | L3 Apply |
| **Description** | Students find the mode of a dataset: the most frequently occurring value (ungrouped data, Easy/Medium rounds) or the value from the empirical formula applied to a grouped frequency table (Hard rounds). MCQ with 4 options. 9 rounds across 3 difficulty tiers. 3 lives — a life is lost on wrong answer OR timeout. Timer: 45 seconds per round. Stars based on correct answers. Session predecessor: stats-median (L3 — find median). No successor — terminal game of Statistics Session 2. Targets NCERT Class 10 Ch 13 Section 13.3 (Mode of Grouped Data) and basic ungrouped mode. |

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
| PART-027 | Play Area Construction        | YES             | Easy/Medium: dataset display (numbers in a styled card) + question + 4 MCQ buttons 2×2 grid + feedback div. Hard: frequency table (HTML `<table>`) in dataset card instead of number list. |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with dataType, numbers OR groupedData, question, options (4), correctAnswer, distractorNotes, misconceptionTags, difficulty, feedbackCorrect, feedbackWrong |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                |
| PART-031 | API Helper                    | NO              | —                                                                                                                                |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                         |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                    |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                           |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY FIRST FIELD — gameId must be the FIRST key in this object literal:
  gameId: 'stats-mode',
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
          "dataType": {
            "type": "string",
            "enum": ["ungrouped", "grouped"],
            "description": "ungrouped = Easy/Medium rounds (raw number list). grouped = Hard rounds (frequency table with class intervals)."
          },
          "numbers": {
            "type": "array",
            "items": { "type": "number" },
            "minItems": 7,
            "maxItems": 9,
            "description": "The raw dataset AS PRESENTED to the learner. Only for dataType='ungrouped'. Easy: single clear mode, n=7-9. Medium: bimodal or careful frequency-counting. Omit for grouped rounds."
          },
          "groupedData": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "classInterval": { "type": "string", "description": "e.g. '10-20'" },
                "frequency": { "type": "number" }
              },
              "required": ["classInterval", "frequency"]
            },
            "minItems": 4,
            "maxItems": 6,
            "description": "Frequency table rows for grouped data. Only for dataType='grouped'. Must have exactly one modal class (highest frequency). Omit for ungrouped rounds."
          },
          "question": {
            "type": "string",
            "description": "The question shown above the MCQ buttons. For ungrouped: 'What is the mode of: X, Y, Z, ...?' or context-framed variant. For grouped: 'Find the mode of the data in the frequency table.' or with context."
          },
          "correctAnswer": {
            "type": "string",
            "description": "The correct mode as a string. For ungrouped: the value(s) that appear most often. For bimodal: 'X and Y' format (e.g. '3 and 7'). For grouped: the computed mode value to 1 decimal place as needed (e.g. '52' or '36.8'). Must exactly match one of the options[] strings."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 4,
            "maxItems": 4,
            "description": "Exactly 4 options. One is the correct mode. Three are distractors targeting documented misconceptions. Options in shuffled order (not in ascending numerical order)."
          },
          "difficulty": {
            "type": "string",
            "enum": ["easy", "medium", "hard"],
            "description": "easy = rounds 1-3 (ungrouped, single mode, n=7-9). medium = rounds 4-6 (ungrouped bimodal OR tricky frequency count). hard = rounds 7-9 (grouped frequency table, formula application)."
          },
          "distractorNotes": {
            "type": "string",
            "description": "Internal LLM note explaining what each distractor represents. Not shown to learner. Example: 'D1=M-mean-confusion(mean=5.1), D2=M-median-confusion(median=5), D3=M-freq-extremum(max=9)'"
          },
          "misconceptionTags": {
            "type": "array",
            "items": { "type": "string", "enum": ["M-mean-confusion", "M-median-confusion", "M-multiple-mode", "M-formula-error", "M-freq-extremum"] },
            "description": "One tag per distractor (up to 3). M-mean-confusion: computed mean instead of mode. M-median-confusion: picked middle value (median) instead of mode. M-multiple-mode: identified only one mode in a bimodal set. M-formula-error: substituted f₀/f₂ incorrectly in grouped mode formula. M-freq-extremum: picked max or min value instead of most frequent."
          },
          "feedbackCorrect": {
            "type": "string",
            "description": "One sentence shown on correct answer. For ungrouped: names the mode and how many times it appears. For grouped: names modal class and gives the key formula substitution. Max 28 words."
          },
          "feedbackWrong": {
            "type": "string",
            "description": "One sentence shown on wrong answer before advancing. Names the correct answer and the key step. Max 32 words."
          }
        },
        "required": ["dataType", "question", "correctAnswer", "options", "difficulty", "distractorNotes", "misconceptionTags", "feedbackCorrect", "feedbackWrong"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. Rounds 1-3: easy (ungrouped, single mode). Rounds 4-6: medium (bimodal or tricky). Rounds 7-9: hard (grouped frequency table, formula)."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content (9 rounds)

Field names in each round object MUST match the inputSchema: `dataType`, `numbers` OR `groupedData`, `question`, `correctAnswer`, `options` (array of 4 strings), `difficulty`, `distractorNotes`, `misconceptionTags` (array), `feedbackCorrect`, `feedbackWrong`.

```javascript
// FIELD NAMES PER SCHEMA: dataType ('ungrouped'|'grouped'), numbers (array, ungrouped only),
// groupedData (array of {classInterval, frequency}, grouped only), question (string),
// correctAnswer (string), options (array of 4 strings), difficulty ('easy'|'medium'|'hard'),
// distractorNotes (string), misconceptionTags (array), feedbackCorrect (string), feedbackWrong (string)
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1 — EASY — ungrouped, n=9, single clear mode
    // Data: 3, 7, 3, 5, 3, 9, 7, 1, 3  (3 appears 4 times — dominant mode)
    // Mode = 3
    // mean = (3+7+3+5+3+9+7+1+3)/9 = 41/9 ≈ 4.6
    // median: sorted [1,3,3,3,3,5,7,7,9] → 5th value = 3 (same as mode — use mean as D1 instead)
    // D1=M-mean-confusion: mean≈4.6 → round to 4.6 or 5 (use '5' — rounded mean)
    // D2=M-median-confusion: sorted middle (5th of 9) = 3 — SAME as mode; replace with 7 (2nd most frequent)
    // D2=7 (appears twice — 2nd most frequent, M-freq-extremum variant)
    // D3=M-freq-extremum: maximum value = 9
    // Distractors: 5 (rounded mean, M-mean-confusion), 7 (2nd most frequent, M-freq-extremum), 9 (max, M-freq-extremum)
    // NCERT spirit: frequency count from list
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [3, 7, 3, 5, 3, 9, 7, 1, 3],
      question: 'What is the mode of: 3, 7, 3, 5, 3, 9, 7, 1, 3?',
      correctAnswer: '3',
      options: ['3', '5', '7', '9'],
      difficulty: 'easy',
      distractorNotes: 'D1=5 (rounded mean=41/9≈4.6≈5, M-mean-confusion), D2=7 (appears twice — 2nd most frequent, M-freq-extremum), D3=9 (maximum value, M-freq-extremum). Correct=3 (appears 4 times — most frequent). Median of sorted [1,3,3,3,3,5,7,7,9] is also 3, so median confusion not available as distractor; used mean and max instead.',
      misconceptionTags: ['M-mean-confusion', 'M-freq-extremum', 'M-freq-extremum'],
      feedbackCorrect: 'Correct! 3 appears 4 times — more than any other value. Mode = 3.',
      feedbackWrong: 'Mode = most frequent value. Count: 3 appears 4 times, 7 appears 2 times → mode is 3, not the average or max.'
    },

    // ============================================================
    // ROUND 2 — EASY — ungrouped, n=8, single clear mode, real-world context
    // Data: 4, 6, 4, 8, 4, 2, 6, 4  (4 appears 4 times)
    // Context: number of goals scored by a team in 8 matches
    // Mode = 4
    // mean = (4+6+4+8+4+2+6+4)/8 = 38/8 = 4.75
    // median: sorted [2,4,4,4,4,6,6,8] → average of 4th and 5th = (4+4)/2 = 4 (same as mode; use mean)
    // D1=M-mean-confusion: mean=4.75 → '4.75'
    // D2=M-median-confusion: median=4 — same as correct; use '6' (2nd most frequent, M-freq-extremum)
    // D3=M-freq-extremum: maximum = 8
    // Distractors: 4.75 (mean, M-mean-confusion), 6 (2nd most frequent, M-freq-extremum), 8 (max, M-freq-extremum)
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [4, 6, 4, 8, 4, 2, 6, 4],
      question: 'A football team scored these goals in 8 matches: 4, 6, 4, 8, 4, 2, 6, 4. What is the mode?',
      correctAnswer: '4',
      options: ['4', '4.75', '6', '8'],
      difficulty: 'easy',
      distractorNotes: 'D1=4.75 (mean=38/8=4.75, M-mean-confusion), D2=6 (appears twice — 2nd most frequent, M-freq-extremum), D3=8 (maximum — M-freq-extremum). Correct=4 (appears 4 times). Median=4 same as mode so not usable as distractor.',
      misconceptionTags: ['M-mean-confusion', 'M-freq-extremum', 'M-freq-extremum'],
      feedbackCorrect: 'Correct! 4 appears 4 times in the data — more than any other score. Mode = 4.',
      feedbackWrong: 'Mode = most frequent score. 4 appears 4 times, 6 appears twice → mode is 4, not the mean (4.75) or maximum (8).'
    },

    // ============================================================
    // ROUND 3 — EASY — ungrouped, n=7, single mode, median ≠ mode
    // Data: 2, 9, 2, 5, 2, 7, 9  (2 appears 3 times, 9 appears twice)
    // Mode = 2
    // mean = (2+9+2+5+2+7+9)/7 = 36/7 ≈ 5.1
    // median: sorted [2,2,2,5,7,9,9] → 4th value = 5 (DISTINCT from mode — good distractor)
    // D1=M-mean-confusion: mean≈5.1 → '5.1'
    // D2=M-median-confusion: median=5 — DISTINCT from mode — excellent distractor
    // D3=M-freq-extremum: maximum=9 (also appears twice)
    // Distractors: 5 (median, M-median-confusion), 5.1 (mean, M-mean-confusion), 9 (max / 2nd most frequent, M-freq-extremum)
    // NCERT spirit: marks scored in 7 rounds of a quiz
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [2, 9, 2, 5, 2, 7, 9],
      question: 'A student scored these marks in 7 rounds: 2, 9, 2, 5, 2, 7, 9. What is the mode?',
      correctAnswer: '2',
      options: ['2', '5', '5.1', '9'],
      difficulty: 'easy',
      distractorNotes: 'D1=5 (median of sorted [2,2,2,5,7,9,9] = 4th value = 5, M-median-confusion — distinct from mode=2), D2=5.1 (mean=36/7≈5.1, M-mean-confusion), D3=9 (maximum and 2nd most frequent — M-freq-extremum). Correct=2 (appears 3 times). This is the ideal easy round: mode ≠ median ≠ mean, all three distractors are distinct.',
      misconceptionTags: ['M-median-confusion', 'M-mean-confusion', 'M-freq-extremum'],
      feedbackCorrect: 'Correct! 2 appears 3 times — most frequent. Mode = 2. (Median=5, Mean≈5.1 — all different!)',
      feedbackWrong: 'Count frequencies: 2 appears 3 times, 9 appears twice. Most frequent = 2. Mode is NOT the median (5) or mean (5.1).'
    },

    // ============================================================
    // ROUND 4 — MEDIUM — bimodal dataset
    // Data: 6, 3, 6, 9, 3, 6, 3, 9, 1  (6 appears 3 times, 3 appears 3 times, 9 appears twice)
    // Mode = 3 AND 6 (bimodal — both appear 3 times)
    // D1=M-multiple-mode: student reports only '6' (the larger of the two modes) — ignores 3
    // D2=M-multiple-mode: student reports only '3' — but this is actually correct as part of the answer
    //   For options structure: correctAnswer = '3 and 6'
    //   D1 = '6' (partial — M-multiple-mode, ignores 3)
    //   D2 = '9' (2nd most frequent; M-freq-extremum; appears twice)
    //   D3 = M-mean-confusion: mean=(6+3+6+9+3+6+3+9+1)/9=46/9≈5.1 → '5.1'
    // Options: '3 and 6', '5.1', '6', '9'
    // Research: Enisoğlu 2014 — "forming incomplete data set" for bimodal data
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [6, 3, 6, 9, 3, 6, 3, 9, 1],
      question: 'What is the mode of: 6, 3, 6, 9, 3, 6, 3, 9, 1?',
      correctAnswer: '3 and 6',
      options: ['3 and 6', '5.1', '6', '9'],
      difficulty: 'medium',
      distractorNotes: 'D1=6 (partial answer — 6 appears 3 times, student picks only the larger mode, M-multiple-mode — Enisoğlu 2014 "incomplete data set"), D2=9 (appears twice — 2nd most frequent pair, M-freq-extremum), D3=5.1 (mean=46/9≈5.1, M-mean-confusion). Correct="3 and 6" (both appear 3 times — bimodal dataset). Primary target: M-multiple-mode error.',
      misconceptionTags: ['M-multiple-mode', 'M-freq-extremum', 'M-mean-confusion'],
      feedbackCorrect: 'Correct! Both 3 and 6 appear 3 times — more than any other value. This dataset has TWO modes.',
      feedbackWrong: 'Count: 3 appears 3 times, 6 appears 3 times — both are modes. When two values tie for most frequent, report BOTH: mode = 3 and 6.'
    },

    // ============================================================
    // ROUND 5 — MEDIUM — bimodal, real-world context, careful frequency count required
    // Data: 5, 8, 5, 2, 8, 5, 8, 2, 5, 8  (5 appears 4 times, 8 appears 4 times, 2 appears twice)
    // Context: shoe sizes sold in a store on one day
    // Mode = 5 and 8 (bimodal — both appear 4 times)
    // D1=M-multiple-mode: '8' (student reports only one mode — larger value)
    // D2=M-multiple-mode: '5' (student reports only one mode — smaller value)
    // D3=M-mean-confusion: mean=(5+8+5+2+8+5+8+2+5+8)/10=56/10=5.6 → '5.6'
    // Options: '5 and 8', '5', '5.6', '8'
    // Careful frequency count required: 4 vs 4 vs 2 — no dominant mode
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [5, 8, 5, 2, 8, 5, 8, 2, 5, 8],
      question: 'A shoe shop sold these sizes in a day: 5, 8, 5, 2, 8, 5, 8, 2, 5, 8. What is the mode?',
      correctAnswer: '5 and 8',
      options: ['5', '5 and 8', '5.6', '8'],
      difficulty: 'medium',
      distractorNotes: 'D1=5 (partial — student picks only smaller mode, M-multiple-mode), D2=8 (partial — student picks only larger mode, M-multiple-mode), D3=5.6 (mean=56/10=5.6, M-mean-confusion). Correct="5 and 8" (each appears 4 times). Careful frequency count required — n=10 so count errors are likely. Shoe size context is NCERT-spirit (categorical popular context).',
      misconceptionTags: ['M-multiple-mode', 'M-multiple-mode', 'M-mean-confusion'],
      feedbackCorrect: 'Correct! Size 5 sold 4 times, size 8 sold 4 times — tied for most frequent. Both are modes.',
      feedbackWrong: 'Count carefully: 5 appears 4 times, 8 appears 4 times, 2 appears twice. Both 5 AND 8 are modes — not just one of them.'
    },

    // ============================================================
    // ROUND 6 — MEDIUM — tricky frequency count, median trap, n=9
    // Data: 11, 7, 11, 3, 7, 11, 5, 7, 11  (11 appears 4 times, 7 appears 3 times, others 1 each)
    // Single dominant mode = 11
    // mean = (11+7+11+3+7+11+5+7+11)/9 = 73/9 ≈ 8.1
    // median: sorted [3,5,7,7,7,11,11,11,11] → 5th value = 7 (DISTINCT from mode=11 — excellent trap)
    // D1=M-median-confusion: median=7 — looks like a plausible answer since 7 appears 3 times
    // D2=M-mean-confusion: mean≈8.1 → '8.1'
    // D3=M-freq-extremum: maximum = 11... same as mode; use minimum = 3 (M-freq-extremum low)
    //   Actually mode=11 is correct and max=11 is same. Use D3=3 (minimum, M-freq-extremum) instead.
    // Options: '7', '8.1', '11', '3'
    // Context: daily temperature records — NCERT spirit
    // ============================================================
    {
      dataType: 'ungrouped',
      numbers: [11, 7, 11, 3, 7, 11, 5, 7, 11],
      question: 'Temperature (°C) recorded over 9 days: 11, 7, 11, 3, 7, 11, 5, 7, 11. What is the mode?',
      correctAnswer: '11',
      options: ['3', '7', '8.1', '11'],
      difficulty: 'medium',
      distractorNotes: 'D1=7 (sorted [3,5,7,7,7,11,11,11,11] → median=5th=7, M-median-confusion — 7 appears 3 times so it looks plausible), D2=8.1 (mean=73/9≈8.1, M-mean-confusion), D3=3 (minimum value, M-freq-extremum — appears only once). Correct=11 (appears 4 times — most frequent). Tricky because 7 appears 3 times AND is the median, making D1 very compelling.',
      misconceptionTags: ['M-median-confusion', 'M-mean-confusion', 'M-freq-extremum'],
      feedbackCorrect: 'Correct! 11 appears 4 times — more than 7 (3 times) or any other value. Mode = 11.',
      feedbackWrong: 'Count: 11 appears 4 times, 7 appears 3 times. Most frequent = 11. Don\'t pick the middle value (7) or mean (8.1).'
    },

    // ============================================================
    // ROUND 7 — HARD — grouped frequency table, formula application
    // NCERT Example 6 adapted: marks distribution of 30 students
    // Class intervals: 10-25, 25-40, 40-55, 55-70, 70-85
    // Frequencies:      2,    3,     7,     6,     12
    // Modal class: 70-85 (highest frequency = 12)
    // L=70, f₁=12, f₀=6, f₂=0 (no class after 70-85), h=15
    // Wait — there IS no class after 70-85 so f₂=0
    // Mode = 70 + [(12-6)/(24-6-0)] × 15 = 70 + [6/18]×15 = 70 + 5 = 75
    // D1=M-formula-error: confuse f₀ and f₂ → uses f₀=0 (class before modal, which is first class) and f₂=6
    //   Mode = 70 + [(12-0)/(24-0-6)]×15 = 70 + [12/18]×15 = 70+10=80
    // D2=M-formula-error: uses modal class lower limit only = 70 (forgets formula entirely)
    // D3=M-median-confusion: student confuses modal class with the "middle" class → 40-55 midpoint=47.5 → '47.5'
    // Correct = '75'
    // Options: '47.5', '70', '75', '80'
    // ============================================================
    {
      dataType: 'grouped',
      groupedData: [
        { classInterval: '10-25', frequency: 2 },
        { classInterval: '25-40', frequency: 3 },
        { classInterval: '40-55', frequency: 7 },
        { classInterval: '55-70', frequency: 6 },
        { classInterval: '70-85', frequency: 12 }
      ],
      question: 'Find the mode of the marks scored by 30 students (class size h = 15).',
      correctAnswer: '75',
      options: ['47.5', '70', '75', '80'],
      difficulty: 'hard',
      distractorNotes: 'Modal class = 70-85 (freq=12, highest). L=70, f₁=12, f₀=6 (preceding class 55-70), f₂=0 (no succeeding class), h=15. Correct: Mode=70+[(12-6)/(24-6-0)]×15=70+[6/18]×15=70+5=75. D1=47.5 (midpoint of middle class 40-55 — M-median-confusion: student picks "middle class" instead of modal class), D2=70 (lower limit of modal class only — M-formula-error: forgets to add formula term), D3=80 (M-formula-error: swaps f₀ and f₂ → [12-0]/[24-0-6]=12/18 → 70+10=80). NCERT Ch 13 §13.3 pattern.',
      misconceptionTags: ['M-median-confusion', 'M-formula-error', 'M-formula-error'],
      feedbackCorrect: 'Correct! Modal class 70–85 (freq=12). Mode = 70 + [(12−6)/(24−6−0)]×15 = 70 + 5 = 75.',
      feedbackWrong: 'Modal class = 70–85 (highest freq=12). Mode = L+[(f₁−f₀)/(2f₁−f₀−f₂)]×h = 70+[(12−6)/(24−6−0)]×15 = 75.'
    },

    // ============================================================
    // ROUND 8 — HARD — grouped data, formula, modal class NOT the last class
    // Data: age of patients in a hospital (NCERT Exercise 13.2 Q1 adapted)
    // Age (years): 5-15, 15-25, 25-35, 35-45, 45-55, 55-65
    // Frequency:    6,    11,    21,    23,    14,     5
    // Modal class: 35-45 (highest frequency = 23)
    // L=35, f₁=23, f₀=21 (preceding 25-35), f₂=14 (succeeding 45-55), h=10
    // Mode = 35 + [(23-21)/(46-21-14)]×10 = 35 + [2/11]×10 = 35 + 1.818... ≈ 36.8
    // D1=M-formula-error: student uses f₀=14 and f₂=21 (swaps f₀ and f₂)
    //   Mode = 35 + [(23-14)/(46-14-21)]×10 = 35 + [9/11]×10 = 35 + 8.18 ≈ 43.2
    // D2=M-formula-error: student uses modal class midpoint only = (35+45)/2 = 40
    // D3=M-mean-confusion: student computes approximate mean using midpoints
    //   midpoints: 10, 20, 30, 40, 50, 60; Σfx = 6×10+11×20+21×30+23×40+14×50+5×60
    //   = 60+220+630+920+700+300 = 2830; N=80; mean=2830/80=35.375≈35.4
    // Correct = '36.8'
    // Options: '35.4', '36.8', '40', '43.2'
    // ============================================================
    {
      dataType: 'grouped',
      groupedData: [
        { classInterval: '5-15',  frequency: 6 },
        { classInterval: '15-25', frequency: 11 },
        { classInterval: '25-35', frequency: 21 },
        { classInterval: '35-45', frequency: 23 },
        { classInterval: '45-55', frequency: 14 },
        { classInterval: '55-65', frequency: 5 }
      ],
      question: 'Age (in years) of patients admitted to a hospital. Find the mode (class size h = 10).',
      correctAnswer: '36.8',
      options: ['35.4', '36.8', '40', '43.2'],
      difficulty: 'hard',
      distractorNotes: 'Modal class = 35-45 (freq=23, highest). L=35, f₁=23, f₀=21 (class 25-35), f₂=14 (class 45-55), h=10. Correct: Mode=35+[(23-21)/(46-21-14)]×10=35+[2/11]×10=35+1.818≈36.8. D1=43.2 (M-formula-error: swaps f₀=14 and f₂=21 → [9/11]×10+35≈43.2), D2=40 (M-formula-error: uses modal class midpoint (35+45)/2=40, skips formula), D3=35.4 (M-mean-confusion: approximate mean=2830/80≈35.4). NCERT Exercise 13.2 Q1 context.',
      misconceptionTags: ['M-mean-confusion', 'M-formula-error', 'M-formula-error'],
      feedbackCorrect: 'Correct! Modal class 35–45 (freq=23). Mode = 35 + [(23−21)/(46−21−14)]×10 = 35 + 1.8 ≈ 36.8.',
      feedbackWrong: 'Modal class = 35–45 (highest freq=23). Mode = L+[(f₁−f₀)/(2f₁−f₀−f₂)]×h = 35+[2/11]×10 ≈ 36.8. Don\'t swap f₀ and f₂!'
    },

    // ============================================================
    // ROUND 9 — HARD — grouped data, formula, class size h=20
    // Data: lifetimes of electrical components (adapted from NCERT Exercise 13.2 Q2)
    // Lifetimes (hours): 0-20, 20-40, 40-60, 60-80, 80-100, 100-120
    // Frequency:          10,   35,   52,    61,    38,     29
    // Modal class: 60-80 (highest frequency = 61)
    // L=60, f₁=61, f₀=52 (preceding 40-60), f₂=38 (succeeding 80-100), h=20
    // Mode = 60 + [(61-52)/(122-52-38)]×20 = 60 + [9/32]×20 = 60 + 5.625 ≈ 65.6
    // D1=M-formula-error: student picks f₀=35 (class BEFORE preceding, off-by-one) and f₂=38
    //   Mode = 60 + [(61-35)/(122-35-38)]×20 = 60 + [26/49]×20 = 60 + 10.6 ≈ 70.6
    // D2=M-formula-error: student uses modal class lower limit only = 60 (forgets formula)
    // D3=M-median-confusion: student finds median class instead of modal class
    //   N=225, N/2=112.5 → cumulative freqs: 10,45,97,158 → median class 60-80
    //   median = 60 + [(112.5-97)/61]×20 = 60 + [15.5/61]×20 = 60 + 5.08 ≈ 65.1
    //   (Very close to mode=65.6 — too similar; use a more distinct distractor)
    //   D3=M-mean-confusion: rough mean using midpoints 10,30,50,70,90,110
    //   Σfx=10×10+35×30+52×50+61×70+38×90+29×110=100+1050+2600+4270+3420+3190=14630
    //   N=225; mean=14630/225≈65.0 (also too close to 65.6)
    //   Use D3=70 (modal class midpoint=(60+80)/2=70, M-formula-error variant) for clear distinction
    // Final options: '60', '65.6', '70', '70.6'
    // ============================================================
    {
      dataType: 'grouped',
      groupedData: [
        { classInterval: '0-20',   frequency: 10 },
        { classInterval: '20-40',  frequency: 35 },
        { classInterval: '40-60',  frequency: 52 },
        { classInterval: '60-80',  frequency: 61 },
        { classInterval: '80-100', frequency: 38 },
        { classInterval: '100-120',frequency: 29 }
      ],
      question: 'Lifetimes (in hours) of 225 electrical components. Find the mode (class size h = 20).',
      correctAnswer: '65.6',
      options: ['60', '65.6', '70', '70.6'],
      difficulty: 'hard',
      distractorNotes: 'Modal class = 60-80 (freq=61, highest). L=60, f₁=61, f₀=52 (class 40-60), f₂=38 (class 80-100), h=20. Correct: Mode=60+[(61-52)/(122-52-38)]×20=60+[9/32]×20=60+5.625≈65.6. D1=60 (M-formula-error: uses modal class lower limit only, forgets to add formula term), D2=70 (M-formula-error: uses modal class midpoint (60+80)/2=70 instead of formula), D3=70.6 (M-formula-error: off-by-one — uses f₀=35 instead of 52 → [26/49]×20+60≈70.6). NCERT Exercise 13.2 Q2 adapted.',
      misconceptionTags: ['M-formula-error', 'M-formula-error', 'M-formula-error'],
      feedbackCorrect: 'Correct! Modal class 60–80 (freq=61). Mode = 60 + [(61−52)/(122−52−38)]×20 = 60 + 5.6 ≈ 65.6.',
      feedbackWrong: 'Modal class = 60–80 (freq=61). Mode = L+[(f₁−f₀)/(2f₁−f₀−f₂)]×h = 60+[9/32]×20 ≈ 65.6. f₀=52 (class BEFORE modal), f₂=38 (class AFTER).'
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
  <title>Most Common</title>
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

      <!-- Dataset display — switches between number list (ungrouped) and table (grouped) -->
      <div id="dataset-card" class="dataset-card">
        <!-- Ungrouped: plain text number list -->
        <div id="dataset-display" class="dataset-box" aria-label="Data set" data-testid="dataset-display" style="display:none;"></div>
        <!-- Grouped: HTML frequency table -->
        <div id="frequency-table-container" data-testid="frequency-table-container" style="display:none;"></div>
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
- `#timer-container` must be present in the DOM before `new TimerComponent('timer-container', ...)` is called.
- `#dataset-display` is shown for ungrouped rounds; `#frequency-table-container` is shown for grouped rounds. `loadQuestion()` toggles display based on `round.dataType`.
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
                    │  handleOptionSelect(index, opt)     │
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

Every phase change MUST call `syncDOMState()` immediately after setting `gameState.phase`. Define BEFORE any function that calls it.

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

  // Toggle dataset display based on round type
  const datasetDisplay = document.getElementById('dataset-display');
  const tableContainer = document.getElementById('frequency-table-container');

  if (round.dataType === 'ungrouped') {
    // Show number list, hide table
    datasetDisplay.textContent = round.numbers.join(', ');
    datasetDisplay.style.display = 'block';
    tableContainer.style.display = 'none';
  } else {
    // Show frequency table, hide number list
    datasetDisplay.style.display = 'none';
    tableContainer.style.display = 'block';
    // Build HTML table from groupedData
    let tableHtml = '<table class="freq-table" aria-label="Frequency table"><thead><tr><th>Class Interval</th><th>Frequency</th></tr></thead><tbody>';
    round.groupedData.forEach(row => {
      tableHtml += `<tr><td>${row.classInterval}</td><td>${row.frequency}</td></tr>`;
    });
    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;
  }

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

  // Update progress bar — MANDATORY: progressBar.update(currentRound, lives) NOT totalRounds
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

  // Feedback text (aria-live)
  const feedbackEl = document.getElementById('answer-feedback');
  feedbackEl.textContent = isCorrect ? round.feedbackCorrect : round.feedbackWrong;
  feedbackEl.classList.remove('hidden');

  // Track attempt
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
  feedbackEl.textContent = "Time's up! " + round.feedbackWrong;
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

### 7.6 restartGame()

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

### 7.7 Timer Configuration

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

String equality only — no numeric tolerance. `correctAnswer` in the schema is always a string: whole number ('3', '11', '75'), decimal ('36.8', '65.6'), or bimodal string ('3 and 6', '5 and 8'). `selectedOption` is pulled from `data-value` (also a string). The comparison is exact.

**Bimodal rounds (R4, R5):** The `correctAnswer` is `'3 and 6'` and `'5 and 8'` respectively. The matching button's `data-value` must be exactly those strings — case-sensitive, space-sensitive. The LLM generating this game must set the button text AND data-value to the exact `correctAnswer` string from the schema.

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
    gameId: 'stats-mode',
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
      subtitle: 'You identified every mode correctly.',
      icons: ['🌟'],
      buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
    });
  } else {
    transitionScreen.show({
      title: 'Game Over',
      subtitle: 'Keep practising — spotting the mode gets easier with practice.',
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

/* === Frequency Table (grouped data rounds) === */
.freq-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
}

.freq-table th,
.freq-table td {
  border: 1px solid #e2e8f0;
  padding: 8px 12px;
  text-align: center;
}

.freq-table th {
  background: #f1f5f9;
  font-weight: 700;
  color: #334155;
}

.freq-table td {
  color: #1e293b;
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
  font-size: 1.05rem;
  font-weight: 700;
  color: #7c3aed;
  background: #fff;
  border: 2.5px solid #8b5cf6;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  outline: none;
  word-break: break-word;
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
  gameId: 'stats-mode',
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

**`progressBar.update(currentRound, lives)` — NOT `progressBar.update(totalRounds, lives)`** — pass the current round number, not the total. This is the correct call signature: `progressBar.setRound(roundNumber)` where `roundNumber` is 1-based.

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
  title: 'Find the Mode',
  subtitle: 'Identify the most frequent value — 9 rounds, 3 lives',
  icons: ['📊'],
  buttons: [{ label: 'Play', action: 'restart', style: 'primary' }]
});

// Show in endGame(true) — victory:
transitionScreen.show({
  title: 'Well done!',
  subtitle: 'You identified every mode correctly.',
  icons: ['🌟'],
  buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }]
});

// Show in endGame(false) — game over:
transitionScreen.show({
  title: 'Game Over',
  subtitle: 'Keep practising — spotting the mode gets easier with practice.',
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
| TC-003 | game-flow | correct-answer-advances | Start game. Click the button whose `data-value` matches round 1 `correctAnswer` ('3'). | `[data-testid="answer-feedback"]` becomes visible with correct feedback text. After 1200ms, `window.gameState.currentRound === 2`. |
| TC-004 | game-flow | wrong-answer-loses-life | Start game. Click a button whose `data-value` does NOT match `correctAnswer`. | `window.gameState.lives === 2`. `[data-testid="answer-feedback"]` shows wrong feedback. Incorrect button gets `.incorrect` class. Correct button gets `.correct` class. |
| TC-005 | game-flow | timeout-loses-life | Start game. Wait 46 seconds without clicking. | `window.gameState.lives === 2`. Correct button gets `.correct` class. `[data-testid="answer-feedback"]` shows "Time's up!" message. |
| TC-006 | game-flow | victory-after-9-rounds | Complete all 9 rounds without losing all lives. | `data-phase === 'results'` AND `game_complete` postMessage sent with `isVictory: true`. |
| TC-007 | game-flow | game-over-on-zero-lives | Lose 3 lives before completing all 9 rounds. | `data-phase === 'game_over'` AND `game_complete` postMessage sent with `isVictory: false`. |
| TC-008 | game-flow | restart-from-game-over | Reach game-over, click Restart button. | `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND `window.gameState.lives === 3`. |
| TC-009 | mechanics | correct-answer-scores-10 | Start game. Answer round 1 correctly. | `window.gameState.score === 10`. |
| TC-010 | mechanics | three-star-threshold | Answer all 9 rounds correctly. | `game_complete` message has `stars === 3` AND `correctAnswers === 9`. |
| TC-011 | mechanics | zero-star-threshold | Answer 0–2 rounds correctly (lose all lives early). | `game_complete` message has `stars === 0`. |
| TC-012 | mechanics | isprocessing-guard | Start game. Call `handleOptionSelect` twice in rapid succession (<50ms). | `window.gameState.attempts.length === 1` (not 2). Lives deducted only once. |
| TC-013 | state-sync | data-phase-playing | After clicking Play. | `document.getElementById('app').dataset.phase === 'playing'`. |
| TC-014 | contract | option-buttons-testid-and-value | Start game (round 1). | `[data-testid="option-0"]` exists AND all 4 buttons have `data-value` matching one of the round's options strings. |
| TC-015 | contract | game-complete-on-both-paths | Trigger both victory (complete 9 rounds) and game-over (lose 3 lives) in separate runs. | Both runs produce a `postMessage` with `type === 'game_complete'` (not 'game_end'). |
| TC-016 | mechanics | grouped-table-visible-round-7 | Use `__ralph.jumpToRound(7)`. | `[data-testid="frequency-table-container"]` is visible AND `[data-testid="dataset-display"]` is hidden. `[data-testid="option-0"]` through `option-3` all present. |
| TC-017 | mechanics | ungrouped-display-round-1 | Start game. | `[data-testid="dataset-display"]` is visible AND contains the text "3" (from round 1 numbers). `[data-testid="frequency-table-container"]` is hidden. |

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
13. **Do NOT reset `gameState.gameEnded = false` without also resetting all other state** — `restartGame()` calls `startGame()` which must reset ALL fields (lives, score, currentRound, correctAnswers, incorrectAnswers, attempts, events, gameEnded, isProcessing).
14. **Do NOT call `timer.start()` before the timer is attached to the DOM** — `#timer-container` must exist in the DOM at the point `new TimerComponent('timer-container', ...)` is called.
15. **Do NOT forget `progressBar.setRound(roundNumber)` in `loadQuestion()`** — if omitted, the progress bar never advances.
16. **Do NOT forget to toggle `#dataset-display` vs `#frequency-table-container` in `loadQuestion()`** — ungrouped rounds must show the number list and hide the table; grouped rounds (R7–R9) must show the table and hide the number list. Both must be visible only when appropriate.
17. **Do NOT use numeric comparison for bimodal correctAnswer strings** — `'3 and 6'` must be compared as a string. `String(selectedOption).trim() === String(round.correctAnswer).trim()` is correct. Do not parse or split the answer string for comparison.
18. **Do NOT generate the frequency table as plain text** — grouped rounds (R7–R9) MUST render a proper HTML `<table>` with `<thead>`, `<tbody>`, `<th>` and `<td>` elements. Plain text is not accessible and tests may assert `data-testid="frequency-table-container"` contains a table element.
