# Stats: Identify the Right Measure — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 1 (Remember) for the skill `stats-identify-class`: given a real-world dataset and context, the learner must classify which measure of central tendency (Mean, Median, or Mode) is most appropriate. This is pure recognition/classification — no computation is required. The three-button MCQ (Mean / Median / Mode) forces recall of the defining property of each measure. On the first incorrect attempt, a worked-example panel expands showing the "Measure Selector" reference card with the correct reasoning highlighted. On the second incorrect attempt a life is deducted and the game advances with a soft note. The 10 rounds cover all three measures across varied Indian Class 10–relevant contexts (marks, salary, shoe sizes, temperature, fruit sales, etc.), directly targeting the four primary misconceptions documented in the research literature. Interaction type: `measure-classification-mcq`.
>
> **RESEARCH SOURCES (Exa, 2026-03-23):**
> - Source A: Lumen Learning / OpenStax "When to use each measure of Central Tendency" (https://courses.lumenlearning.com/introstats1/chapter/when-to-use-each-measure-of-central-tendency/) — primary decision rules for median (outliers, ordinal data, open-ended distributions) and mode (nominal/categorical data).
> - Source B: Scribbr "Central Tendency: Understanding the Mean, Median & Mode" (https://www.scribbr.com/statistics/central-tendency/) — table of appropriate measures by data level; "mean is sensitive to outliers, median is robust"; mode is the only choice for categorical (nominal) data.
> - Source C: Statistics LibreTexts 2.8 "When to use each measure of Central Tendency" (https://stats.libretexts.org/...) — confirms median for skewed distributions and open-ended intervals; cites CC BY OpenStax.
> - Source D: Cazorla et al. (2023), ERIC EJ1408809 "The conceptual field of measures of central tendency: A first approximation" — peer-reviewed research identifying student difficulty types: (1) using simple mean instead of weighted mean, (2) not accounting for outliers, (3) mechanical algorithm use without conceptual understanding, (4) confusion between mode and median for ordered data.
> - Source E: NCERT Class 10 Maths Chapter 14 (via pw.live / geeksforgeeks NCERT solutions) — exercise contexts (monthly electricity consumption, factory income, insurance ages, marks distributions), and the empirical relationship 3×Median = Mode + 2×Mean confirming all three measures are taught in the same chapter.

---

## 1. Game Identity

- **Title:** Which Measure?
- **Game ID:** stats-identify-class
- **Type:** standard
- **Description:** Students identify the most appropriate measure of central tendency (Mean, Median, or Mode) given a real-world dataset and context description. 10 rounds covering all three measures across varied Indian Class 10 contexts. MCQ interaction: 3 buttons per round. Worked-example panel reveals on first wrong attempt; a life is deducted on the second wrong attempt (Skip). Game over if all 3 lives are lost. Stars based on first-attempt accuracy. Targets Grade 10 / NCERT Chapter 14 (Statistics). Prerequisite: ability to compute mean, median, mode (but this game does NOT require computation). Session successor: stats-mean-direct (L2-L3 computation).

---

## 2. Parts Selected

| Part ID  | Name                          | Included        | Config/Notes                                                                                                                                                                  |
| -------- | ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PART-001 | HTML Shell                    | YES             | —                                                                                                                                                                             |
| PART-002 | Package Scripts               | YES             | —                                                                                                                                                                             |
| PART-003 | waitForPackages               | YES             | —                                                                                                                                                                             |
| PART-004 | Initialization Block          | YES             | —                                                                                                                                                                             |
| PART-005 | VisibilityTracker             | YES             | popupProps: default                                                                                                                                                           |
| PART-006 | TimerComponent                | NO              | No timer — measure classification is a conceptual-recall task. Time pressure contradicts the worked-example pedagogical goal.                                                 |
| PART-007 | Game State Object             | YES             | Custom fields: attemptsThisRound, wrongFirstAttempt, totalFirstAttemptCorrect, isProcessing                                                                                   |
| PART-008 | PostMessage Protocol          | YES             | —                                                                                                                                                                             |
| PART-009 | Attempt Tracking              | YES             | —                                                                                                                                                                             |
| PART-010 | Event Tracking                | YES             | Custom events: measure_correct_first, measure_correct_second, measure_skipped, worked_example_shown, round_complete                                                           |
| PART-011 | End Game & Metrics            | YES             | Star logic: ≥8/10 first-attempt correct = 3★; ≥6/10 = 2★; <6 = 1★. Game-over path active (lives system).                                                                   |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                             |
| PART-013 | Validation Fixed              | YES             | MCQ: string equality check (selectedOption === round.correctOption)                                                                                                           |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                             |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                             |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                             |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Visual feedback only.                                                                                  |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                             |
| PART-019 | Results Screen UI             | YES             | Custom metrics: first-attempt accuracy, rounds completed, worked-example panels triggered                                                                                     |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                             |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                             |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                             |
| PART-023 | ProgressBar Component         | YES             | `new ProgressBarComponent({ slotId: 'mathai-progress-slot', totalRounds: 10, totalLives: 3 })`                                                                               |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory, game_over (lives reach 0)                                                                                                                            |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                        |
| PART-027 | Play Area Construction        | YES             | Layout: dataset display panel (table or list) above context sentence above MCQ buttons; worked-example panel hidden by default, slides in below question on first wrong attempt |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with context, data (array), question, options, correctOption, explanationHtml, feedbackOnSkip, misconceptionTag                                            |
| PART-029 | Story-Only Game               | NO              | —                                                                                                                                                                             |
| PART-030 | Sentry Error Tracking         | YES             | —                                                                                                                                                                             |
| PART-031 | API Helper                    | NO              | —                                                                                                                                                                             |
| PART-032 | AnalyticsManager              | NO              | —                                                                                                                                                                             |
| PART-033 | Interaction Patterns          | NO              | —                                                                                                                                                                             |
| PART-034 | Variable Schema Serialization | YES (POST_GEN)  | Serializes Section 4 to inputSchema.json                                                                                                                                      |
| PART-035 | Test Plan Generation          | YES (POST_GEN)  | Generates tests.md after HTML                                                                                                                                                 |
| PART-037 | Playwright Testing            | YES (POST_GEN)  | Ralph loop generates tests + fix cycle                                                                                                                                        |

---

## 3. Game State

```javascript
const gameState = {
  // MANDATORY FIRST FIELD — gameId must be the FIRST key in this object literal:
  gameId: 'stats-identify-class',
  phase: 'start_screen',           // 'start_screen' | 'playing' | 'results' | 'game_over'
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 10,
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
  attemptsThisRound: 0,             // 0, 1, or 2 attempts within current round
  wrongFirstAttempt: 0,             // Total rounds where first attempt was wrong
  totalFirstAttemptCorrect: 0,      // Total rounds answered correctly on first attempt
  isProcessing: false,              // Guard against double-submit
  gameEnded: false                  // Prevent post-endGame state mutations
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
```

**Lives system:** This game HAS 3 lives. A life is deducted when the learner gets the SECOND wrong attempt (or clicks "Skip this round"). The FIRST wrong attempt shows the explanation panel — no life is lost. When `gameState.lives` reaches 0, `endGame(false)` is called immediately (game_over). Victory requires completing all 10 rounds with at least 1 life remaining.

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
          "context": {
            "type": "string",
            "description": "1-2 sentence real-world scenario describing the data collection situation and decision to be made. Must make clear WHY a central tendency measure is needed."
          },
          "data": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 5,
            "maxItems": 10,
            "description": "The dataset displayed as a list. For categorical data use label strings. For numeric data use numeric strings. Data should make the correct measure visually identifiable."
          },
          "question": {
            "type": "string",
            "description": "The question shown above the MCQ buttons. Context-specific variant of 'Which measure best describes the typical value in this data?'"
          },
          "correctOption": {
            "type": "string",
            "enum": ["Mean", "Median", "Mode"],
            "description": "The correct answer. Must match one of the options strings exactly (case-sensitive)."
          },
          "options": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 3,
            "maxItems": 3,
            "description": "Always exactly ['Mean', 'Median', 'Mode'] in that fixed order."
          },
          "explanationHtml": {
            "type": "string",
            "description": "HTML string injected into the explanation panel on first wrong attempt. Must include: (1) correct answer clearly stated; (2) one-sentence definition; (3) specific reason WHY this measure fits using actual data values; (4) why the likely wrong answer does not fit."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when round is skipped (life deducted). Name correct answer and key reason. Max 20 words."
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["M1", "M2", "M3", "M-none"],
            "description": "M1=mean distorted by outlier. M2=mode required for categorical/frequency data. M3=median for skewed data. M-none=mean is correct."
          }
        },
        "required": ["context", "data", "question", "correctOption", "options", "explanationHtml", "feedbackOnSkip", "misconceptionTag"]
      },
      "minItems": 10,
      "maxItems": 12,
      "description": "10-12 rounds. Distribution: at least 3 Mean (M-none), at least 3 Median (M1 or M3), at least 3 Mode (M2). No two consecutive rounds with same correctOption."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

Field names in each round object MUST match the inputSchema: `context`, `data` (array), `question`, `options`, `correctOption`, `explanationHtml`, `feedbackOnSkip`, `misconceptionTag`.

```javascript
// FIELD NAMES PER SCHEMA: context (string), data (array of strings), question (string),
// options (always ['Mean','Median','Mode']), correctOption (string), explanationHtml (string),
// feedbackOnSkip (string), misconceptionTag ('M1'|'M2'|'M3'|'M-none')
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: MEAN — M-none (symmetric, balanced, no outliers)
    // Context: Class test marks — tightly clustered 45-55 range
    // Misconception: students over-apply Median to all real-world data
    // NCERT-aligned: Ch 14 marks distributions
    // ============================================================
    {
      context: 'Seven students scored the following marks (out of 60) in a class test. The teacher wants to report the class average to parents.',
      data: ['45', '47', '48', '50', '52', '53', '55'],
      question: 'Which measure best represents the typical class score?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mean',
      // M-none: Scores 45-55, symmetric, no outlier. Mean = 350/7 = 50. Median = 50. Mean is appropriate standard.
      explanationHtml: `
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mean</strong></p>
          <div class="exp-definition"><strong>Mean</strong> = (45+47+48+50+52+53+55) ÷ 7 = 350 ÷ 7 = <strong>50 marks</strong>.</div>
          <div class="exp-reason"><strong>Why Mean?</strong> Scores are tightly clustered (45–55) with no extreme outliers — a <em>symmetric</em> spread. The Mean (50) accurately captures the typical performance using every student's mark.</div>
          <div class="exp-wrong"><strong>Why not Median?</strong> Median is preferred when data is skewed or has outliers. Here the data is symmetric, so the Mean is the correct and more informative choice.</div>
        </div>
      `,
      feedbackOnSkip: 'Symmetric marks 45-55 with no outliers → Mean (50) is the standard class average.',
      misconceptionTag: 'M-none'
    },

    // ============================================================
    // ROUND 2: MEDIAN — M1 (mean distorted by outlier)
    // Context: Monthly salaries — one very high outlier (owner salary)
    // NCERT-aligned: Ch 14 factory wages context (Ex 14.1 Q2)
    // Misconception M1: students pick Mean because "mean = average"
    // ============================================================
    {
      context: 'Monthly salaries (in ₹) of 7 people at a small shop. One person is the owner who earns much more. The accountant wants to report the typical employee salary.',
      data: ['₹8,000', '₹8,500', '₹9,000', '₹9,200', '₹9,500', '₹10,000', '₹75,000'],
      question: 'Which measure best represents the typical salary in this shop?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Median',
      // M1: Mean = (8000+8500+9000+9200+9500+10000+75000)/7 = 129200/7 ≈ ₹18,457 (above 6 of 7 people).
      // Median = 4th value (ordered) = ₹9,200. Unaffected by the ₹75,000 outlier.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Median</strong></p>
          <div class="exp-definition"><strong>Median</strong> = the 4th (middle) value when sorted: <strong>₹9,200</strong>.</div>
          <div class="exp-reason"><strong>Why Median?</strong> The owner\'s ₹75,000 salary is an <em>outlier</em>. It pulls the Mean up to ~₹18,457 — higher than what 6 out of 7 employees actually earn. Median (₹9,200) is unaffected by the outlier and truly represents a typical employee.</div>
          <div class="exp-wrong"><strong>Why not Mean?</strong> Mean (₹18,457) is inflated by the owner\'s salary. It gives a figure that none of the regular employees actually earns.</div>
        </div>
      \`,
      feedbackOnSkip: 'The ₹75,000 outlier pulls Mean to ~₹18,457. Median (₹9,200, the 4th value) is the honest typical salary.',
      misconceptionTag: 'M1'
    },

    // ============================================================
    // ROUND 3: MODE — M2 (categorical data — shoe sizes, inventory)
    // Context: Shoe shop needs to stock most popular size
    // Misconception M2: students pick Mean (6.8 is not a real shoe size)
    // ============================================================
    {
      context: 'A shoe shop recorded the sizes sold in one day. The owner wants to know which size to order the most from the supplier.',
      data: ['5', '6', '6', '6', '7', '7', '7', '7', '7', '8', '8', '9'],
      question: 'Which measure best helps the owner decide which size to restock most?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mode',
      // M2: Mode = 7 (appears 5 times). Mean ≈ 6.8 (not a real shoe size). Median = 7.
      // The question is "which size is sold most often" = Mode.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mode</strong></p>
          <div class="exp-definition"><strong>Mode</strong> = the most frequently occurring value. Size 7 appears 5 times → Mode = <strong>7</strong>.</div>
          <div class="exp-reason"><strong>Why Mode?</strong> The owner wants to stock the size sold <em>most often</em>. Mode (size 7) directly answers this. Ordering more size 7 maximises sales potential.</div>
          <div class="exp-wrong"><strong>Why not Mean?</strong> Mean ≈ 6.8 — not a real shoe size. You cannot order "size 6.8" from a supplier. Mode gives an actual, actionable size.</div>
        </div>
      \`,
      feedbackOnSkip: 'Mode = size 7 (appears 5 times) is the size to restock most. Mean gives 6.8 — not a real shoe size.',
      misconceptionTag: 'M2'
    },

    // ============================================================
    // ROUND 4: MEDIAN — M3 (right-skewed: land areas with one huge district)
    // Context: District areas in a state — one large district creates skew
    // Misconception M3: students apply Mean to all numeric data
    // NCERT-aligned: Ch 14 grouped data concept with skewed distributions
    // ============================================================
    {
      context: 'A geographer recorded the areas (in km²) of 5 districts in a state. One district is a large desert region. She wants the "typical" district area.',
      data: ['118', '120', '130', '145', '3800'],
      question: 'Which measure best represents the typical district area?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Median',
      // M3: Ordered: 118, 120, 130, 145, 3800. Median = 3rd value = 130 km².
      // Mean = (118+120+130+145+3800)/5 = 4313/5 = 862.6 km² — far above 4 of 5 districts.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Median</strong></p>
          <div class="exp-definition"><strong>Median</strong> = the 3rd value in ordered data (5 values): <strong>130 km²</strong>.</div>
          <div class="exp-reason"><strong>Why Median?</strong> The 3,800 km² desert district is an outlier. It pulls Mean to 862.6 km² — far above all other districts. Median (130 km²) reflects what a typical district actually looks like.</div>
          <div class="exp-wrong"><strong>Why not Mean?</strong> Mean (862.6 km²) is inflated by the large desert district. It gives a "typical" size that 4 out of 5 districts are nowhere near.</div>
        </div>
      \`,
      feedbackOnSkip: 'The 3,800 km² outlier inflates Mean to 862.6. Median (130 km², the 3rd value) is the honest centre.',
      misconceptionTag: 'M3'
    },

    // ============================================================
    // ROUND 5: MEAN — M-none (daily temperature, symmetric, no outliers)
    // Context: 7-day temperatures tightly clustered 33-36°C
    // Misconception: students over-apply "real-world = median"
    // ============================================================
    {
      context: "A city recorded the daily maximum temperature (°C) for one week. A student wants to report the week's typical temperature for a geography project.",
      data: ['33', '33', '34', '34', '35', '35', '36'],
      question: "Which measure best summarises the week's typical temperature?",
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mean',
      // M-none: Values range 33-36. Symmetric. Mean = 240/7 ≈ 34.3°C. Median = 34°C.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mean</strong></p>
          <div class="exp-definition"><strong>Mean</strong> = (33+33+34+34+35+35+36) ÷ 7 = 240 ÷ 7 ≈ <strong>34.3°C</strong>.</div>
          <div class="exp-reason"><strong>Why Mean?</strong> Temperatures cluster between 33°C and 36°C with no outliers — a <em>symmetric</em> spread. Mean (34.3°C) uses every day\'s reading and is the universally accepted "average temperature" metric.</div>
          <div class="exp-wrong"><strong>Why not Median?</strong> Median (34°C) is close but the Mean is preferred for symmetric data without outliers — it accounts for every value equally.</div>
        </div>
      \`,
      feedbackOnSkip: 'Symmetric temperatures 33-36°C, no outliers → Mean (≈34.3°C) is the standard weekly average.',
      misconceptionTag: 'M-none'
    },

    // ============================================================
    // ROUND 6: MODE — M2 (favourite colour survey — nominal categorical)
    // Context: Most popular uniform colour — purely categorical data
    // Misconception M2: students apply mean/median to colour names
    // Research: AAMT — "students believe it is possible to find the median of categorical data"
    // ============================================================
    {
      context: 'A school surveyed 50 students about their preferred sports team colour. Responses: Blue (22), Red (15), Green (9), Yellow (4). The principal wants the most popular colour for the new uniform.',
      data: ['Blue', 'Blue', 'Red', 'Red', 'Green', 'Yellow', '...22 Blue total out of 50'],
      question: 'Which measure identifies the most popular colour choice?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mode',
      // M2: Colour names are nominal (categorical). Mean/Median require numbers. Mode = Blue (22 students).
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mode</strong></p>
          <div class="exp-definition"><strong>Mode</strong> = the most frequently occurring value. Blue (22 students) is chosen most → Mode = <strong>Blue</strong>.</div>
          <div class="exp-reason"><strong>Why Mode?</strong> Colour names are <em>categorical</em> — not numbers. Mode is the <strong>only</strong> measure of central tendency that applies to non-numeric data. It directly answers "which colour do most students prefer?"</div>
          <div class="exp-wrong"><strong>Why not Mean or Median?</strong> You cannot add or order colour names. "Blue + Red ÷ 2" is meaningless. Both Mean and Median require numbers to work.</div>
        </div>
      \`,
      feedbackOnSkip: 'Colour names are categorical — Mode is the only valid measure. Mode = Blue (chosen by 22 of 50 students).',
      misconceptionTag: 'M2'
    },

    // ============================================================
    // ROUND 7: MEDIAN — M1 (income data with extreme outlier)
    // Context: Monthly income of workers, one CEO earns vastly more
    // NCERT-aligned: Ex 14.1 Q2 (factory wages, appropriate method)
    // Misconception M1: students default to Mean for all income data
    // ============================================================
    {
      context: 'A company recorded monthly income (in ₹) of 6 staff members. Five staff earn ₹20,000-₹30,000. The CEO earns ₹8,00,000. HR wants to report the "typical" staff income.',
      data: ['20000', '22000', '25000', '27000', '30000', '800000'],
      question: 'Which measure best describes the typical monthly income?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Median',
      // M1: Mean = (20000+22000+25000+27000+30000+800000)/6 = 924000/6 = ₹1,54,000.
      // Ordered: 20000, 22000, 25000, 27000, 30000, 800000. Median = (25000+27000)/2 = ₹26,000.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Median</strong></p>
          <div class="exp-definition"><strong>Median</strong> = average of 3rd and 4th values: (25,000 + 27,000) ÷ 2 = <strong>₹26,000</strong>.</div>
          <div class="exp-reason"><strong>Why Median?</strong> The CEO\'s ₹8,00,000 salary is a massive outlier. It pulls Mean to ₹1,54,000 — five times what most staff earn. Median (₹26,000) correctly represents what a typical staff member earns.</div>
          <div class="exp-wrong"><strong>Why not Mean?</strong> Mean (₹1,54,000) is dominated by one CEO salary. It is completely unrepresentative of the five regular employees.</div>
        </div>
      \`,
      feedbackOnSkip: 'CEO salary (₹8,00,000) is an outlier — Median (₹26,000) is the honest typical staff income.',
      misconceptionTag: 'M1'
    },

    // ============================================================
    // ROUND 8: MEAN — M-none (symmetric plant count data)
    // Context: Number of plants per house — NCERT Ex 14.1 Q1 directly
    // No outliers, symmetric spread. Mean = 8.1.
    // Misconception: students over-apply Median to all survey data
    // ============================================================
    {
      context: 'A survey recorded the number of plants in 20 houses in a locality. Values range from 0 to 14 with no extreme outliers — the data is roughly symmetric.',
      data: ['0', '2', '2', '4', '5', '5', '6', '7', '8', '8', '8', '9', '10', '10', '11', '12', '12', '12', '14', '14'],
      question: 'Which measure best summarises the typical number of plants per house?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mean',
      // M-none: Sum = 162, n = 20. Mean = 8.1. Median = 8.5. Mode = 8 and 12 (bimodal — not helpful).
      // Source: NCERT Ex 14.1 Q1 — direct exercise context.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mean</strong></p>
          <div class="exp-definition"><strong>Mean</strong> = 162 ÷ 20 = <strong>8.1 plants per house</strong>.</div>
          <div class="exp-reason"><strong>Why Mean?</strong> The data is <em>symmetric</em> — spread evenly from 0 to 14 with no extreme outliers. Mean (8.1) uses every data point and accurately captures the typical number of plants. Source: NCERT Ex 14.1 Q1.</div>
          <div class="exp-wrong"><strong>Why not Median?</strong> Median is preferred for skewed/outlier data. Here data is symmetric, so Mean is equally valid and more precise than Median (8.5).</div>
        </div>
      \`,
      feedbackOnSkip: 'Symmetric plant data, no outliers → Mean (8.1) is the standard average. Direct from NCERT Ex 14.1 Q1.',
      misconceptionTag: 'M-none'
    },

    // ============================================================
    // ROUND 9: MODE — M2 (blood group survey — categorical, medical context)
    // Context: Hospital needs to stock most common blood type
    // Misconception M2: students try to find Mean/Median of blood group letters
    // ============================================================
    {
      context: 'A hospital recorded the blood groups of 30 patients admitted in one week: O+ (12), A+ (9), B+ (6), AB+ (3). The blood bank wants to know which type to stock the most.',
      data: ['O+', 'O+', 'A+', 'A+', 'B+', 'AB+', '...12 O+ total out of 30'],
      question: 'Which measure tells the blood bank which blood type to stock most?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Mode',
      // M2: Blood groups are categorical (nominal). Mean/Median require numbers. Mode = O+ (12 patients, most frequent).
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Mode</strong></p>
          <div class="exp-definition"><strong>Mode</strong> = the most frequently occurring value. O+ appears 12 times → Mode = <strong>O+</strong>.</div>
          <div class="exp-reason"><strong>Why Mode?</strong> Blood groups are <em>categorical labels</em>, not numbers. Mode is the only measure that applies to categorical data. It directly answers "which type appears most often?" so the blood bank knows what to stock.</div>
          <div class="exp-wrong"><strong>Why not Mean or Median?</strong> Blood groups are letters — you cannot add or order O+, A+, B+, AB+. Mean and Median are undefined for non-numeric data.</div>
        </div>
      \`,
      feedbackOnSkip: 'Blood groups are categorical — Mode = O+ (most frequent, 12 patients) is the only valid measure.',
      misconceptionTag: 'M2'
    },

    // ============================================================
    // ROUND 10: MEDIAN — M3 (family size survey, right-skewed)
    // Context: Family sizes in 9 families, two large joint families create skew
    // NCERT-aligned: Ch 14 household survey data
    // Misconception M3: students use Mean without checking for skew
    // ============================================================
    {
      context: 'A survey recorded the number of members in 9 families in a village: two are large joint families. A government researcher wants to report the "typical" family size.',
      data: ['2', '3', '3', '4', '4', '4', '5', '8', '12'],
      question: 'Which measure best represents the typical family size in this village?',
      options: ['Mean', 'Median', 'Mode'],
      correctOption: 'Median',
      // M3: Mean = 45/9 = 5 members. But 6 of 9 families have ≤4 members. Median = 5th value = 4.
      // Mode = 4 (appears 3 times) — but Median preferred for skewed distributions.
      explanationHtml: \`
        <div class="exp-card">
          <p class="exp-title">Answer: <strong>Median</strong></p>
          <div class="exp-definition"><strong>Median</strong> = the 5th value in ordered data (9 values): <strong>4 members</strong>.</div>
          <div class="exp-reason"><strong>Why Median?</strong> The two joint families (8 and 12 members) create a <em>right-skewed</em> distribution. Mean (5) is pulled above the size of 6 out of 9 families. Median (4) correctly shows what most village families actually look like.</div>
          <div class="exp-wrong"><strong>Why not Mode?</strong> Mode = 4 (appears 3 times) is close, but Mode only reflects frequency. For skewed distributions, Median is the standard preferred measure of central tendency.</div>
        </div>
      \`,
      feedbackOnSkip: 'Joint families (8, 12 members) skew Mean to 5. Median (4, the 5th value) is the true centre of this right-skewed data.',
      misconceptionTag: 'M3'
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) has three layers; visibility is toggled via the `hidden` class:

```
┌──────────────────────────────────────────────────────┐
│  #context-card  (always visible per round)           │
│  #context-text: round.context (scenario description) │
│  #data-display: round.data.join(', ') in styled box  │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)         │
│  Heading: round.question                             │
│                                                      │
│  Three MCQ buttons (.option-btn):                    │
│  [ Mean ]    [ Median ]    [ Mode ]                  │
│  data-testid="option-0/1/2", data-value="Mean" etc.  │
│  min-height: 44px; min-width: 44px (accessibility)   │
│                                                      │
│  #feedback-text                                      │
│  aria-live="polite" role="status"                    │
│  data-testid="feedback-text"                         │
│  (hidden by default — brief correct/skip message)    │
├──────────────────────────────────────────────────────┤
│  #explanation-panel  (hidden by default)              │
│  data-testid="explanation-panel"                     │
│  Appears after FIRST wrong attempt only.             │
│  Contains round.explanationHtml injected via         │
│  innerHTML. Two buttons:                             │
│    [Got it — try again]  data-testid="got-it-btn"   │
│      → re-enables buttons for second attempt        │
│    [Skip this round]  data-testid="skip-round-btn"  │
│      → deducts 1 life, advances round               │
└──────────────────────────────────────────────────────┘
```

**Dataset display styling:**

```css
.dataset-box {
  background: #f8fafc;
  border: 2px solid #cbd5e1;
  border-radius: 10px;
  padding: 14px 18px;
  font-size: 1.05rem;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
  margin-bottom: 12px;
  letter-spacing: 0.03em;
  line-height: 1.8;
}

.dataset-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.95rem;
  margin-bottom: 12px;
}

.dataset-table th {
  background: #e2e8f0;
  padding: 6px 10px;
  text-align: left;
  font-weight: 700;
  color: #334155;
}

.dataset-table td {
  padding: 5px 10px;
  border-bottom: 1px solid #e2e8f0;
  color: #1e293b;
}

.dataset-table tr:last-child td {
  border-bottom: none;
}
```

**Option buttons:**

Always rendered dynamically from `round.options[]`. Every round has the same 3 options: `['Mean', 'Median', 'Mode']`. Buttons must have:
- `data-option="Mean"` / `data-option="Median"` / `data-option="Mode"`
- `data-testid="option-0"` / `data-testid="option-1"` / `data-testid="option-2"` (positional index)
- `data-value="Mean"` / `data-value="Median"` / `data-value="Mode"` (exact option text)

---

## 6. Game Flow

### 6.1 Start Screen → Game Start

Standard PART-024 TransitionScreen start. On "Play" click: `startGame()` → `renderRound(1)`.

```javascript
function startGame() {
  gameState.isActive = true;
  gameState.startTime = Date.now();
  gameState.currentRound = 0;
  gameState.phase = 'playing';   // GEN-PHASE-001 MANDATORY
  syncDOMState();                // GEN-PHASE-001 MANDATORY — must be called AFTER phase is set
  transitionScreen.hide();
  renderRound(1);
}
```

### 6.2 renderRound(roundNumber)

```
1. const round = gameState.content.rounds[roundNumber - 1]
2. gameState.currentRound = roundNumber
3. gameState.attemptsThisRound = 0
4. gameState.isProcessing = false
5. Update context card:
     document.getElementById('context-text').textContent = round.context
     document.getElementById('data-display').textContent = round.data.join(', ')
6. Set question heading: document.getElementById('question-text').textContent = round.question
7. Render option buttons: clear #option-buttons, create 3 buttons from round.options[]
   Each button MUST have ALL of:
     class="option-btn"
     data-testid="option-N"    (N = 0, 1, 2 — positional index)
     data-value="<option>"     (exact string: "Mean", "Median", or "Mode")
     textContent = option string
   CSS: min-height: 44px; min-width: 44px
8. Hide #feedback-text, hide #explanation-panel
9. Enable all option buttons (remove disabled attribute)
10. progressBar.setRound(roundNumber)
11. syncDOMState()
```

### 6.3 handleOptionClick(selectedOption)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedOption === round.correctOption)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'measure_correct_first' : 'measure_correct_second'
   - if (attemptsThisRound === 1): gameState.totalFirstAttemptCorrect++; gameState.score += 20
   - else: gameState.score += 10  (partial credit for correct on second attempt)
   - FeedbackManager.sound('correct')
   - FeedbackManager.playDynamicFeedback('correct', gameState.score)
   - syncDOMState()
   - Show #feedback-text: "Correct! " + round.correctOption + " is the right measure here."
     (aria-live="polite" ensures screen-reader announcement)
   - After 1200ms: hide #feedback-text; advanceRound()
   - gameState.isProcessing = false

7. else (wrong):
   - Track event: 'measure_incorrect'
   - FeedbackManager.sound('incorrect')
   - if (attemptsThisRound === 1):
       — inject round.explanationHtml into #explanation-panel via innerHTML
       — show #explanation-panel (fade in or slide down)
       — enable got-it-btn and skip-round-btn
       — gameState.isProcessing = false
       — (wait for user action — do NOT auto-advance)
   - else (attemptsThisRound === 2):
       — Track event: 'measure_skipped'
       — gameState.wrongFirstAttempt++
       — gameState.lives--
       — progressBar.loseLife()
       — syncDOMState()
       — if (gameState.lives <= 0): endGame(false)  [game_over — stop here]
       — else: show brief skip note (round.feedbackOnSkip) for 1500ms, then advanceRound()
       — gameState.isProcessing = false
```

### 6.4 handleWorkedExampleGotIt()

```
1. Hide #explanation-panel
2. Re-enable option buttons (remove disabled attribute)
3. gameState.isProcessing = false
   (attemptsThisRound remains at 1, so next click is the second attempt)
```

### 6.5 handleWorkedExampleSkip()

```
1. Track event: 'measure_skipped'
2. Hide #explanation-panel
3. gameState.wrongFirstAttempt++
4. gameState.lives--
5. progressBar.loseLife()
6. syncDOMState()
7. if (gameState.lives <= 0): endGame(false)   [game_over — stop here]
8. else: show #feedback-text with round.feedbackOnSkip for 1500ms, then advanceRound()
```

### 6.7 Advance Round

```javascript
function advanceRound() {
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame(true);   // completed all 10 rounds — victory
  } else {
    renderRound(gameState.currentRound + 1);
  }
}
```

### 6.8 End Game (endGame(isVictory))

```
- Set gameState.gameEnded = true; gameState.isActive = false
- Set gameState.phase = isVictory ? 'results' : 'game_over'
- syncDOMState()   — MANDATORY on BOTH paths
- Star calculation from totalFirstAttemptCorrect (out of 10):
    8-10  → 3★   "Excellent! You know exactly when to use each measure."
    6-7   → 2★
    0-5   → 1★   (minimum 1 star — this is a learning game)
- Send postMessage game_complete on BOTH victory AND game_over paths:
    window.parent.postMessage({
      type: 'game_complete',
      gameId: 'stats-identify-class',
      score: gameState.score,
      stars: starsEarned,
      firstAttemptAccuracy: Math.round((gameState.totalFirstAttemptCorrect / gameState.totalRounds) * 100),
      roundsCompleted: gameState.currentRound,
      livesRemaining: gameState.lives,
      isVictory: isVictory,
      duration: Date.now() - gameState.startTime,
      attempts: gameState.attempts,
      events: gameState.events
    }, '*')
- if (isVictory): transitionScreen.show({ title: 'Well done!', subtitle: 'You identified every measure correctly.', icons: ['🌟'], buttons: [{ label: 'Play again', action: 'restart', style: 'primary' }] })
  else:           transitionScreen.show({ title: 'Game Over', subtitle: 'Keep practising — knowing when to use Mean, Median, or Mode takes time.', icons: ['💔'], buttons: [{ label: 'Try again', action: 'restart', style: 'primary' }] })
```

### 6.9 restartGame()

Called by `TransitionScreenComponent` when the player clicks the restart button on the game-over screen (`onRestart: restartGame`). Also exposed as `window.restartGame` for tests.

```javascript
function restartGame() {
  // 1. Reset all gameState fields to their initial values
  gameState.currentRound = 0;
  gameState.lives = 3;                   // matches totalLives in ProgressBarComponent
  gameState.score = 0;
  gameState.totalFirstAttemptCorrect = 0;
  gameState.gameEnded = false;
  gameState.isActive = false;
  gameState.isProcessing = false;
  gameState.attemptsThisRound = 0;
  gameState.wrongFirstAttempt = 0;
  gameState.events = [];
  gameState.attempts = [];
  gameState.startTime = null;

  // 2. Set phase back to start and sync DOM
  gameState.phase = 'start_screen';
  syncDOMState();                        // GEN-PHASE-001 MANDATORY

  // 3. Hide the game-over transition screen and begin fresh
  transitionScreen.hide();
  startGame();
}
```

**Why this matters:** Without a complete reset, a second playthrough inherits stale `lives`, `score`, and `totalFirstAttemptCorrect` from the previous run, producing wrong star ratings and allowing the game to immediately trigger `endGame(false)` if `gameState.lives` was 0.

---

## 7. CDN Implementation Patterns (MANDATORY)

### 7.0 syncDOMState() — MANDATORY (GEN-PHASE-001)

Every phase change MUST call `syncDOMState()` immediately after setting `gameState.phase`. This keeps `data-phase`, `data-lives`, and `data-score` on `#app` in sync with gameState so `waitForPhase()` in tests works correctly.

```javascript
// Define syncDOMState BEFORE any function that calls it
function syncDOMState() {
  const app = document.getElementById('app');
  if (!app) return;
  app.dataset.phase = gameState.phase;
  app.dataset.lives = gameState.lives;
  app.dataset.score = gameState.score || 0;
  app.dataset.round = gameState.currentRound;
}
```

**Phase transitions (all MANDATORY):**
- Page loads → `gameState.phase = 'start_screen'` → `syncDOMState()` (initial state — set before transitionScreen.show({...start object...}))
- `startGame()` → `gameState.phase = 'playing'` → `syncDOMState()` (before transitionScreen.hide())
- `endGame(true)` → `gameState.phase = 'results'` → `syncDOMState()` (before transitionScreen.show({...victory object...}))
- `endGame(false)` → `gameState.phase = 'game_over'` → `syncDOMState()` (before transitionScreen.show({...game_over object...}))
- Life lost (skip/wrong attempt 2) → `gameState.lives--` → `syncDOMState()` (before checking game_over condition)

### 7.1 Package Loading

```html
<!-- In <head>: -->
<script src="https://unpkg.com/@hw-app/cdn-games@latest/dist/bundle.js"></script>
```

### 7.2 waitForPackages

```javascript
function waitForPackages(callback) {
  const required = ['ScreenLayout', 'TransitionScreenComponent', 'ProgressBarComponent', 'FeedbackManager'];
  const maxWait = 180000;
  const interval = 100;
  let elapsed = 0;

  const check = setInterval(() => {
    const allLoaded = required.every(name => typeof window[name] !== 'undefined');
    if (allLoaded) {
      clearInterval(check);
      callback();
    } else if (elapsed >= maxWait) {
      clearInterval(check);
      console.error('Required packages failed to load:', required.filter(n => typeof window[n] === 'undefined'));
    }
    elapsed += interval;
  }, interval);
}
```

### 7.3 DOMContentLoaded Initialization

```javascript
document.addEventListener('DOMContentLoaded', () => {
  waitForPackages(() => {
    // Initialize CDN components
    visibilityTracker = new VisibilityTracker({ /* popupProps */ });
    progressBar = new ProgressBarComponent({
      slotId: 'mathai-progress-slot',
      totalRounds: 10,
      totalLives: 3
    });
    transitionScreen = new TransitionScreenComponent({
      onRestart: restartGame
    });

    // Expose on window AFTER definitions
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.nextRound = nextRound;
    // REQUIRED for test harness __ralph.jumpToRound() — without this, mechanics tests cannot jump to specific rounds
    window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); };

    // Load content (injected by pipeline or fallback)
    gameState.content = window.__gameContent || fallbackContent;

    transitionScreen.show({
      title: 'Which Measure Fits Best?',
      subtitle: 'Mean, Median, or Mode? — 10 rounds, 3 lives',
      icons: ['📊'],
      buttons: [{ label: 'Play', action: 'restart', style: 'primary' }]
    });
  });
});
```

### 7.4 FeedbackManager (sound only — NO init)

```javascript
// Correct answer:
FeedbackManager.sound('correct');
FeedbackManager.playDynamicFeedback('correct', gameState.score);

// Wrong answer:
FeedbackManager.sound('incorrect');
```

**NEVER call `FeedbackManager.init()`.** Only call `.sound()` and `.playDynamicFeedback()`.

---

## 8. Anti-Patterns to Avoid (PART-026)

The LLM generating this game must check each item before finalising the HTML:

1. **Do NOT call `FeedbackManager.init()`** — audio permission popup breaks tests. Use `.sound()` and `.playDynamicFeedback()` only.
2. **Do NOT assign `window.gameState` inside DOMContentLoaded** — it must be at module scope, immediately after the `gameState` object declaration.
3. **Do NOT forget `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`** — assign in DOMContentLoaded after function definitions. Also add `window.loadRound = function(n) { ... }` — required for test harness `__ralph.jumpToRound()`.
4. **Do NOT use static HTML for context or data** — `#context-text` and `#data-display` MUST be updated dynamically in `renderRound()` from `round.context` and `round.data.join(', ')`. Hard-coded text that does not change between rounds is a bug.
5. **DO deduct a life on the second wrong attempt (Skip)** — call `progressBar.loseLife()` and decrement `gameState.lives`. Call `endGame(false)` when lives reach 0. The FIRST wrong attempt shows the explanation panel with no life deduction.
6. **DO show the game-over screen when lives reach 0** — `endGame(false)` must call `transitionScreen.show({...game_over object...})`. Victory screen only shows when all 10 rounds complete with ≥1 life remaining.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — buttons must be disabled when the panel is shown, to prevent second attempt before reading the explanation.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — if buttons stay disabled the learner cannot make their second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — they must be generated dynamically from `round.options[]` each round (even though options are always ['Mean', 'Median', 'Mode'] — the generation must be data-driven, not hardcoded, so future content changes work without HTML edits).
11. **Do NOT omit `data-testid` on option buttons** — each button must have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"` (positional) AND `data-value="<option string>"`. Tests use `data-testid` as the stable selector.
12. **Do NOT omit `data-testid` on explanation panel elements** — the panel container must have `data-testid="explanation-panel"`, the got-it button `data-testid="got-it-btn"`, the skip button `data-testid="skip-round-btn"`, and the feedback text `data-testid="feedback-text"`. Tests cannot click these elements without stable selectors.
13. **Do NOT inject `explanationHtml` as textContent** — use `innerHTML` to preserve the HTML structure of the explanation card.
14. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale attempt counts from the previous round will cause the worked-example panel to not appear on first wrong attempt.
15. **Do NOT use `style.display` to toggle the worked-example panel** — use `panel.classList.add('visible')` / `panel.classList.remove('visible')` so the CSS `slideDown` animation fires on each appearance.

---

## 9. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with dataset display, context text, and 3 option buttons.
- **correct-first-attempt-advances**: Selecting the correct option on first attempt shows `#feedback-text` then auto-advances to round 2 after 1200ms.
- **wrong-first-attempt-shows-explanation**: Selecting a wrong option on first attempt shows `#explanation-panel`. Option buttons are disabled while panel is visible.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#explanation-panel` and re-enables option buttons for a second attempt.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round after the skip note.
- **correct-second-attempt-advances**: Selecting the correct option on second attempt (after explanation shown) shows `#feedback-text` then advances.
- **wrong-second-attempt-skips**: Selecting wrong measure on second attempt advances the round with `feedbackOnSkip` note.
- **complete-10-rounds**: Completing all 10 rounds (any combination of correct/skip, or victory after 10 rounds with lives remaining) transitions to `data-phase="results"` (victory).
- **no-game-over**: Confirm that no game-over transition screen ever appears, regardless of answer choices.

### Category: mechanics

- **three-star-threshold**: Answering ≥8/10 rounds correctly on first attempt → 3★ on results screen.
- **two-star-threshold**: Answering 6/10 or 7/10 correctly on first attempt → 2★.
- **one-star-threshold**: Answering <6/10 correctly on first attempt → 1★.
- **second-attempt-partial-credit**: Correct on second attempt adds 10 points (not 20) to score.
- **isprocessing-guard**: Rapid double-click on a measure button does not fire two answer evaluations.

### Category: state-sync

- **data-phase-playing**: After game start, `document.getElementById('app').dataset.phase === 'playing'`.
- **data-round-updates**: `data-round` increments each round (1 through 9).
- **window-gamestate-accessible**: `window.gameState.currentRound` reflects the active round number at all times.
- **total-rounds-is-9**: `window.gameState.totalRounds === 9`.

### Category: contract

- **option-buttons-have-data-testid**: All three option buttons have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"`.
- **option-buttons-have-data-value**: All three buttons have `data-value` matching exactly `"Mean"`, `"Median"`, `"Mode"`.
- **explanation-panel-testid**: Element with `data-testid="explanation-panel"` exists in the DOM (may be hidden).
- **got-it-btn-testid**: Element with `data-testid="got-it-btn"` exists in the DOM.
- **skip-round-btn-testid**: Element with `data-testid="skip-round-btn"` exists in the DOM.
- **correct-feedback-testid**: Element with `data-testid="correct-feedback"` exists in the DOM.
- **window-endgame-defined**: `typeof window.endGame === 'function'`.
- **window-loadround-defined**: `typeof window.loadRound === 'function'`.
- **no-feedbackmanager-init**: HTML source does not contain `FeedbackManager.init(`.

---

## 10. Curriculum Alignment

| Curriculum     | Standard/Reference     | Alignment                                                                                                         |
| -------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| NCERT Class 10 | Ch 14, §14.1–14.4      | All 10 rounds use contexts from the chapter's exercise domain (marks, salary, frequency tables, grouped data).    |
| NCERT Class 10 | Ch 14 Exercise 14.3 Q1 | Round 4 (district area outlier) mirrors the "compare mean, median, mode" exercise on electricity consumption data.|
| NCERT Class 10 | Ch 14 §14.4 note       | Empirical relationship 3×Median = Mode + 2×Mean — Rounds 7+4 explicitly surface why median ≠ mean when skewed.    |
| Common Core    | 6.SP.B.5.d             | "Summarize numerical data sets in relation to their context" — choosing appropriate measure based on distribution. |
| Common Core    | HSS-ID.A.2             | "Use statistics appropriate to the shape of the data distribution to compare center (median, mean) of two or more different data sets." |

**Session-planner prerequisite:** Students must know how to compute mean, median, and mode from raw data (NCERT Class 9 Chapter 14, or Class 10 §14.1). This game does NOT ask for computation — it asks for selection reasoning. A student who cannot yet compute these measures can still benefit from this L1 classification game.

**Session-planner successors:**
- `stats-mean-direct` (L2-L3) — given a dataset, compute the mean using direct / assumed mean / step-deviation method.
- `stats-median` (L3) — compute median of grouped data using the cumulative frequency formula.
- `stats-mode` (L3) — compute mode of grouped data using the modal class formula.
- `stats-which-measure` (L4) — Bloom's Analyze: given a real scenario with a stated conclusion, evaluate whether the correct measure was used and identify the error.

---

## 11. Pedagogical Progression: stats-identify-class → stats-mean-direct → stats-median → stats-mode → stats-which-measure

**stats-identify-class** (Bloom L1 — Remember — THIS GAME):
- Learner sees a dataset + context and must select which measure (Mean/Median/Mode) is most appropriate.
- Cognitive demand: recall and recognise the defining property of each measure and match it to the context.
- Primary misconceptions targeted: (1) "always use mean" — 3 rounds explicitly probe this; (2) "mean ignores outliers" — 3 median rounds all feature outliers/skew; (3) "mean applies to all data types" — 2 mode rounds feature categorical data; (4) "mode vs median for ordered data" — round 9 distinguishes.

**stats-mean-direct** (Bloom L2-L3 — Understand/Apply):
- Learner computes mean of grouped data using direct method, assumed mean method, and step-deviation method.
- Cognitive demand: interpret the formula, apply it to frequency distribution tables, and select the most efficient method.

**stats-median / stats-mode** (Bloom L3 — Apply):
- Learner applies the grouped-data formulas for median and mode given a frequency distribution table.
- Cognitive demand: identify the correct class (median class / modal class) and substitute into the formula.

**stats-which-measure** (Bloom L4 — Analyze):
- Learner is shown a scenario with a conclusion ("The school reports the average salary as ₹X") and must identify whether the correct measure was used and explain why or why not.
- Cognitive demand: decompose a stated conclusion, evaluate the appropriateness of the measure chosen, and identify the error if present.

**Why L1 classification comes first (research basis):**
- Cazorla et al. (2023) identify that students who apply algorithms mechanically ("calculate the mean when a table is given") without conceptual understanding of when each measure is appropriate produce correct computations but wrong conclusions. The L1 classification game directly addresses this: no computation is required — only the decision rule.
- Scribbr (Source B): "The mean is the most frequently used measure of central tendency because it uses all values... but for skewed distributions, the median is better." Students must recognise skew/outlier as the trigger — not a formula.
- Lumen Learning (Source A): the decision rules for median (outliers, skew, open-ended, ordinal) and mode (nominal/categorical) are exactly the "invariants" students must hold. This game makes those invariants explicit before computation practice begins.

---

## 12. Worked-Example Panel CSS (MANDATORY)

The `explanationHtml` content uses class names that must be styled in the game's CSS. The worked-example panel itself must be styled:

```css
.worked-example-card {
  background: #f0f9ff;       /* light blue background */
  border: 2px solid #0ea5e9; /* sky blue border */
  border-radius: 12px;
  padding: 16px 20px;
  margin-top: 12px;
}

.we-title {
  font-weight: 700;
  font-size: 1rem;
  color: #0369a1;
  margin: 0 0 10px 0;
  text-align: center;
  letter-spacing: 0.05em;
}

.we-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 4px;
  border-bottom: 1px solid #e0f2fe;
}

.we-row:last-of-type {
  border-bottom: none;
}

.we-highlighted {
  background: #fff7ed;       /* warm highlight for the correct row */
  border-radius: 6px;
  padding: 6px 8px;
  margin: 2px 0;
}

.we-muted {
  opacity: 0.55;
}

.we-label {
  font-weight: 700;
  font-size: 1rem;
  color: #1e293b;
  min-width: 64px;
  flex-shrink: 0;
}

.we-highlighted .we-label {
  color: #c2410c;            /* orange for highlighted row label */
}

.we-rule {
  color: #334155;
  font-size: 0.92rem;
  line-height: 1.4;
}

.we-explanation {
  margin-top: 12px;
  font-size: 0.9rem;
  color: #334155;
  line-height: 1.5;
  background: #fff;
  border-radius: 6px;
  padding: 8px 12px;
  border-left: 3px solid #f97316;
}
```

The explanation panel (`#explanation-panel`) itself must have:

```css
#explanation-panel {
  display: none;             /* hidden by default */
  margin-top: 16px;
  animation: slideDown 0.25s ease-out;
}

#explanation-panel.visible {
  display: block;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Toggle visibility with: `panel.classList.add('visible')` / `panel.classList.remove('visible')` (not `style.display` directly), so the CSS animation fires on each appearance.

---

## 13. PostMessage Protocol

```javascript
// Send on every answer attempt:
window.parent.postMessage({
  type: 'game_event',
  payload: {
    event: eventName,           // 'measure_correct_first' | 'measure_correct_second' | 'measure_incorrect' | 'measure_skipped'
    roundNumber: gameState.currentRound,
    selectedMeasure: selectedOption,
    correctOption: round.correctOption,
    misconceptionTag: round.misconceptionTag,
    score: gameState.score,
    timestamp: Date.now()
  }
}, '*');

// Send on game end:
window.parent.postMessage({
  type: 'game_complete',
  gameId: 'stats-identify-class',
  score: gameState.score,
  stars: starsEarned,
  firstAttemptAccuracy: Math.round((gameState.totalFirstAttemptCorrect / gameState.totalRounds) * 100),
  roundsCompleted: gameState.currentRound,
  livesRemaining: gameState.lives,
  isVictory: isVictory,
  duration: Date.now() - gameState.startTime,
  attempts: gameState.attempts,
  events: gameState.events
}, '*');
```

---

## 14. Test Assertions (Section 14 — 12 Test Cases)

These are the canonical test cases the test generator must produce. Each case maps to a `data-testid` selector or `window.gameState` property check.

### TC-001: game-flow / start-screen
**Description:** Page loads and shows start screen with correct phase.
**Steps:** Navigate to game URL. Do not click anything.
**Assert:** `document.getElementById('app').dataset.phase === 'start'` AND start button is visible.

### TC-002: game-flow / game-start
**Description:** Clicking the start/play button transitions to playing phase with round 1.
**Steps:** Click the play/start button.
**Assert:** `data-phase === 'playing'` AND `window.gameState.currentRound === 1` AND 3 buttons with `data-testid="option-0/1/2"` are visible.

### TC-003: game-flow / correct-first-attempt-advances
**Description:** Correct first attempt shows feedback and advances to round 2.
**Steps:** Start game. On round 1 (marks data, correctOption = 'Mean'), click `[data-testid="option-0"]` (Mean button).
**Assert:** Element `[data-testid="correct-feedback"]` becomes visible. After 1200ms, `window.gameState.currentRound === 2`.

### TC-004: game-flow / wrong-first-attempt-shows-worked-example
**Description:** Wrong first attempt reveals worked-example panel with buttons disabled.
**Steps:** Start game. On round 1, click `[data-testid="option-1"]` (Median — wrong).
**Assert:** `[data-testid="explanation-panel"]` is visible. All `[data-testid^="option-"]` buttons are disabled.

### TC-005: game-flow / got-it-enables-second-attempt
**Description:** Clicking "Got it — try again" hides worked-example panel and re-enables buttons.
**Steps:** Round 1, wrong answer. Then click `[data-testid="got-it-btn"]`.
**Assert:** `[data-testid="explanation-panel"]` is hidden. All option buttons are enabled. `window.gameState.attemptsThisRound === 1`.

### TC-006: game-flow / skip-advances-round
**Description:** "Skip this round" from worked-example panel advances to next round.
**Steps:** Round 1, wrong answer. Panel appears. Click `[data-testid="skip-round-btn"]`.
**Assert:** After 1500ms, `window.gameState.currentRound === 2`.

### TC-007: mechanics / three-star-threshold
**Description:** ≥8/10 first-attempt correct yields 3 stars.
**Steps:** Use `window.loadRound` to step through 10 rounds, answering the correct measure on first attempt for all 10.
**Assert:** After round 10 completes, `data-phase === 'results'` AND the results screen shows 3 stars.

### TC-008: mechanics / one-star-threshold
**Description:** <6 first-attempt correct yields 1 star.
**Steps:** Use `window.loadRound` to step through all 10 rounds, giving wrong answers on first attempt every round, then skipping.
**Assert:** `data-phase === 'results'` AND results screen shows 1 star.

### TC-009: mechanics / isprocessing-guard
**Description:** Rapid double-click on same button does not double-score.
**Steps:** Start game round 1. Programmatically call `handleOptionClick('Mean')` twice in rapid succession (< 50ms apart).
**Assert:** `window.gameState.totalFirstAttemptCorrect === 1` (not 2).

### TC-010: state-sync / data-round-updates
**Description:** `data-round` attribute increments through all 10 rounds.
**Steps:** Start game. For each round, record `document.getElementById('app').dataset.round`.
**Assert:** Values are 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 in sequence.

### TC-011: contract / option-buttons-testid-and-value
**Description:** All 3 option buttons have required `data-testid` and `data-value` attributes.
**Steps:** Start game (round 1).
**Assert:** `[data-testid="option-0"][data-value="Mean"]` exists. `[data-testid="option-1"][data-value="Median"]` exists. `[data-testid="option-2"][data-value="Mode"]` exists.

### TC-012: contract / no-feedbackmanager-init
**Description:** The HTML source does not call `FeedbackManager.init()`.
**Steps:** Fetch the game HTML as text.
**Assert:** `html.includes('FeedbackManager.init(') === false`.
