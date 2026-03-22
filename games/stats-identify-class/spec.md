# Stats: Identify the Right Measure — Game-Specific Template (Assembly Book)

> **Self-contained template.** An LLM reading ONLY this file should produce a working HTML file. No need to re-read the warehouse.

> **CRITICAL — PART-017 is NO (Feedback Integration NOT included).** Do NOT call `FeedbackManager.init()` in this game. Calling it triggers an audio permission popup that causes non-deterministic test failures in Playwright. The game uses `FeedbackManager.sound` and `FeedbackManager.playDynamicFeedback` directly (which do not require init). Omit `FeedbackManager.init()` entirely.

> **CRITICAL — window.gameState MUST be set.** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase` / `data-lives` / `data-score`. If omitted, `waitForPhase()` will always timeout.

> **CRITICAL — window.endGame, window.restartGame, window.nextRound MUST be set.** These must be assigned in DOMContentLoaded after the functions are defined: `window.endGame = endGame; window.restartGame = restartGame; window.nextRound = nextRound`. Tests call these directly.

> **PEDAGOGICAL DESIGN NOTE.** This game implements Bloom's Level 1 (Remember) for the skill `stats-identify-class`: given a real-world dataset and context, the learner must classify which measure of central tendency (Mean, Median, or Mode) is most appropriate. This is pure recognition/classification — no computation is required. The three-button MCQ (Mean / Median / Mode) forces recall of the defining property of each measure. On the first incorrect attempt, a worked-example panel expands showing the "Measure Selector" reference card with the correct reasoning highlighted. On the second incorrect attempt the game advances with a soft note — no lives are deducted (this is a learning game, not a drill). The 9 rounds cover all three measures across varied Indian Class 10–relevant contexts (marks, salary, shoe sizes, temperature, fruit sales, etc.), directly targeting the four primary misconceptions documented in the research literature. Interaction type: `measure-classification-mcq`.
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
- **Description:** Students identify the most appropriate measure of central tendency (Mean, Median, or Mode) given a real-world dataset and context description. 9 rounds covering all three measures across varied Indian Class 10 contexts. MCQ interaction: 3 buttons per round. Worked-example panel reveals on first wrong attempt; round skipped on second wrong attempt. No lives deducted — this is a learning-first game. Stars based on first-attempt accuracy. Targets Grade 10 / NCERT Chapter 14 (Statistics). Prerequisite: ability to compute mean, median, mode (but this game does NOT require computation). Session successor: stats-mean-direct (L2-L3 computation).

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
| PART-011 | End Game & Metrics            | YES             | Star logic: ≥7/9 first-attempt correct = 3★; ≥5/9 = 2★; <5 = 1★. No game-over state (no lives system).                                                                     |
| PART-012 | Debug Functions               | YES             | —                                                                                                                                                                             |
| PART-013 | Validation Fixed              | YES             | MCQ: string equality check (selected measure === correctMeasure)                                                                                                              |
| PART-014 | Validation Function           | NO              | —                                                                                                                                                                             |
| PART-015 | Validation LLM                | NO              | —                                                                                                                                                                             |
| PART-016 | StoriesComponent              | NO              | —                                                                                                                                                                             |
| PART-017 | Feedback Integration          | NO              | Not included — FeedbackManager.init() triggers audio permission popup. Visual feedback only.                                                                                  |
| PART-018 | Case Converter                | NO              | —                                                                                                                                                                             |
| PART-019 | Results Screen UI             | YES             | Custom metrics: first-attempt accuracy, rounds completed, worked-example panels triggered                                                                                     |
| PART-020 | CSS Variables & Colors        | YES             | —                                                                                                                                                                             |
| PART-021 | Screen Layout CSS             | YES             | —                                                                                                                                                                             |
| PART-022 | Game Buttons                  | YES             | —                                                                                                                                                                             |
| PART-023 | ProgressBar Component         | YES             | totalRounds: 9, totalLives: 0 (no lives — progress bar shows rounds only, no hearts)                                                                                         |
| PART-024 | TransitionScreen Component    | YES             | Screens: start, victory only (no game-over — the game cannot end in failure)                                                                                                  |
| PART-025 | ScreenLayout Component        | YES             | slots: progressBar=true, transitionScreen=true                                                                                                                                |
| PART-026 | Anti-Patterns                 | YES (REFERENCE) | Verification checklist                                                                                                                                                        |
| PART-027 | Play Area Construction        | YES             | Layout: dataset display panel (table or list) above context sentence above MCQ buttons; worked-example panel hidden by default, slides in below question on first wrong attempt |
| PART-028 | InputSchema Patterns          | YES             | Schema type: rounds with datasetDisplay, contextText, correctMeasure, options, workedExampleHtml, feedbackOnSkip, misconceptionTag                                            |
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
  // MANDATORY (from PART-007):
  currentRound: 0,
  totalRounds: 9,
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
  attemptsThisRound: 0,         // 0, 1, or 2 attempts within current round
  wrongFirstAttempt: 0,         // Total rounds where first attempt was wrong
  totalFirstAttemptCorrect: 0,  // Total rounds answered correctly on first attempt
  isProcessing: false           // Guard against double-submit
};

window.gameState = gameState;   // MANDATORY: test harness reads window.gameState

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
```

**IMPORTANT — No lives system:** This game has NO lives and NO game-over state. The progress bar shows only round progress (9 segments), no hearts. `totalLives` in the ProgressBar config must be `0` or omitted. Never deduct lives in this game.

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
          "datasetDisplay": {
            "type": "string",
            "description": "HTML string showing the dataset. For small datasets: a comma-separated list in a styled box. For frequency/grouped data: a compact HTML table. Must be self-contained (inline style ok). Maximum 5–8 data values or 4 frequency rows to keep it readable on mobile."
          },
          "contextText": {
            "type": "string",
            "description": "One sentence giving the real-world context and the question. E.g., 'The monthly salaries (in ₹) of 7 employees at a small shop are listed above. Which measure best represents the typical salary?' Always ends with 'Which measure of central tendency is most appropriate here?'"
          },
          "correctMeasure": {
            "type": "string",
            "enum": ["Mean", "Median", "Mode"],
            "description": "The correct answer. One of the three string values exactly as shown."
          },
          "options": {
            "type": "array",
            "items": { "type": "string", "enum": ["Mean", "Median", "Mode"] },
            "minItems": 3,
            "maxItems": 3,
            "description": "Always exactly ['Mean', 'Median', 'Mode'] in this order. All three options appear every round."
          },
          "workedExampleHtml": {
            "type": "string",
            "description": "HTML string injected into the worked-example panel on first wrong attempt. Must show the 'Measure Selector' reference card with the correct measure's row highlighted. Must include: (1) a three-row table with Mean / Median / Mode and their 'best used when' rule; (2) the correct row highlighted in orange/warm colour; (3) a one-sentence explanation connecting the dataset's key feature (outlier / skew / categorical / typical value) to the correct choice."
          },
          "feedbackOnSkip": {
            "type": "string",
            "description": "One-sentence note shown when the round is skipped after two wrong attempts. Should name the correct measure and the key reason. E.g., 'Here the salary data has an outlier (₹50,000) that pulls the mean up — Median is the fairer summary.'"
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["always-use-mean", "mean-ignores-outlier", "mode-vs-median-ordered", "mean-for-categorical", "mode-means-most-frequent-always"],
            "description": "Which documented misconception this round primarily targets. Used for analytics and test-gen category tagging."
          }
        },
        "required": ["datasetDisplay", "contextText", "correctMeasure", "options", "workedExampleHtml", "feedbackOnSkip", "misconceptionTag"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds. Distribution: at least 3 rounds per measure (Mean ×3, Median ×3, Mode ×3). No two consecutive rounds test the same measure. misconceptionTag must be varied — no two consecutive rounds share the same tag."
    }
  },
  "required": ["rounds"]
}
```

### Fallback Test Content

```javascript
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1: MEAN
    // Context: Class test marks — balanced, no outliers
    // Misconception targeted: "always-use-mean" (mean IS correct here — reinforces when mean is appropriate)
    // Source A: "Use mean when data is symmetrical and has no outliers" (Lumen Learning)
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">45, 52, 48, 55, 50, 47, 53</div>`,
      contextText: 'The marks scored by 7 students in a class test (out of 60) are listed above. Which measure of central tendency best represents the typical score?',
      correctMeasure: 'Mean',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mean</strong></span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Best when data has outliers or is skewed.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">These marks (45–55) are closely clustered with no extreme values. The <strong>Mean</strong> uses every score and gives a fair "balance point" — it is the right choice here.</p>
        </div>
      `,
      feedbackOnSkip: 'Here all marks are close together (45–55) with no outliers — Mean gives the fairest summary of the whole group.',
      misconceptionTag: 'always-use-mean'
    },

    // ============================================================
    // ROUND 2: MEDIAN
    // Context: Monthly salaries — one very high outlier (CEO salary)
    // Misconception targeted: "mean-ignores-outlier"
    // Source B: "For skewed distributions the median is better — it isn't influenced by extremely large values" (Scribbr)
    // Source D: Cazorla et al. 2023 — "not considering outliers" is documented student difficulty #2
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">₹8,000 &nbsp; ₹9,500 &nbsp; ₹10,000 &nbsp; ₹9,000 &nbsp; ₹8,500 &nbsp; ₹9,200 &nbsp; ₹75,000</div>`,
      contextText: 'Monthly salaries (in ₹) of 7 employees at a small shop are listed above. One employee is the owner. Which measure best represents what a typical employee earns?',
      correctMeasure: 'Median',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Median</strong></span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">The owner's salary (₹75,000) is an <strong>outlier</strong> — it pulls the mean far above what any regular employee earns. The <strong>Median</strong> (middle value when sorted) is unaffected by this outlier and better represents a "typical" salary.</p>
        </div>
      `,
      feedbackOnSkip: 'The ₹75,000 owner salary is an outlier — it drags the mean up to ~₹19,900, far above what 6 of the 7 employees earn. Median is the fairer summary.',
      misconceptionTag: 'mean-ignores-outlier'
    },

    // ============================================================
    // ROUND 3: MODE
    // Context: Shoe sizes sold at a shop — categorical/discrete, need most popular
    // Misconception targeted: "always-use-mean" (mean of shoe sizes is meaningless for stocking decisions)
    // Source A: Lumen Learning — "Mode is preferred when data are measured on a nominal (or ordinal) scale"
    // Source B: Scribbr — "mode is most meaningful for nominal and ordinal levels"
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">5, 6, 7, 7, 8, 7, 6, 8, 7, 9, 6, 7</div>`,
      contextText: 'A shoe shop recorded the sizes sold in one day (listed above). The owner wants to know which size to stock the most. Which measure of central tendency should she use?',
      correctMeasure: 'Mode',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mode</strong></span>
            <span class="we-rule">→ Best for finding the most frequently occurring value — especially useful for discrete/categorical data.</span>
          </div>
          <p class="we-explanation">The owner needs to know which size sells <em>most often</em> to decide what to stock. Size 7 appears 5 times — it is the <strong>Mode</strong>. The mean (≈6.8) is not a real shoe size and does not help with stocking decisions.</p>
        </div>
      `,
      feedbackOnSkip: 'The owner needs the most popular size to stock. Size 7 appears 5 times — that is the Mode. Mean (≈6.8) is not even a real shoe size.',
      misconceptionTag: 'always-use-mean'
    },

    // ============================================================
    // ROUND 4: MEDIAN
    // Context: Land area of districts — highly skewed distribution (NCERT-style grouped data context)
    // Misconception targeted: "mean-ignores-outlier"
    // Source E: NCERT Ch 14 Exercise 14.3 Q1 — electricity consumption data, comparing mean/median/mode on skewed data
    // ============================================================
    {
      datasetDisplay: `
        <table class="dataset-table">
          <tr><th>District</th><th>Area (km²)</th></tr>
          <tr><td>A</td><td>120</td></tr>
          <tr><td>B</td><td>145</td></tr>
          <tr><td>C</td><td>130</td></tr>
          <tr><td>D</td><td>3,800</td></tr>
          <tr><td>E</td><td>118</td></tr>
        </table>`,
      contextText: 'The areas of 5 districts in a state are shown above. Which measure best represents the "typical" district area?',
      correctMeasure: 'Median',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Median</strong></span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">District D (3,800 km²) is an <strong>outlier</strong> — it pulls the mean to ~861 km², far larger than the other 4 districts (118–145 km²). Sorted: 118, 120, 130, 145, 3800. The <strong>Median</strong> is 130 km² — a much more representative "typical" district size.</p>
        </div>
      `,
      feedbackOnSkip: 'District D (3,800 km²) is an extreme outlier — mean becomes ~861 km², unrepresentative. Median (130 km²) is the middle value after sorting and is unaffected by the outlier.',
      misconceptionTag: 'mean-ignores-outlier'
    },

    // ============================================================
    // ROUND 5: MEAN
    // Context: Daily temperature in a city — stable readings, arithmetic average needed
    // Misconception targeted: "always-use-mean" (confirming mean when data is well-behaved)
    // Source A: "In a symmetric distribution the mean is robust and reliable" (Lumen Learning)
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">28°C &nbsp; 30°C &nbsp; 29°C &nbsp; 31°C &nbsp; 28°C &nbsp; 30°C &nbsp; 29°C</div>`,
      contextText: 'A weather station recorded the maximum temperature each day for a week (above). A student wants to report the average temperature for the week. Which measure is most appropriate?',
      correctMeasure: 'Mean',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mean</strong></span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">All temperatures are close together (28–31°C) — no outliers, no skew. This is exactly when <strong>Mean</strong> works best: it uses every reading to give a single "balance point" for the week. Meteorologists use the mean temperature for this reason.</p>
        </div>
      `,
      feedbackOnSkip: 'Temperatures range from 28–31°C — tight and symmetric, no outliers. Mean uses all 7 readings to give the fairest single summary: (28+30+29+31+28+30+29)/7 = 29.3°C.',
      misconceptionTag: 'always-use-mean'
    },

    // ============================================================
    // ROUND 6: MODE
    // Context: Favourite fruit survey — categorical/nominal data, no numeric meaning
    // Misconception targeted: "mean-for-categorical"
    // Source B: Scribbr — "The mean can only be used on interval and ratio levels of measurement"; "mode can be used for any level of measurement"
    // Source D: Cazorla et al. 2023 — "mechanical algorithm use without conceptual understanding" — students try to compute mean on non-numeric data
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">Mango, Apple, Mango, Banana, Mango, Apple, Banana, Mango, Apple, Mango</div>`,
      contextText: 'A class of 10 students was asked to name their favourite fruit. The responses are listed above. The teacher wants to know which fruit is most popular. Which measure of central tendency is appropriate here?',
      correctMeasure: 'Mode',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Requires numeric data. Cannot be calculated for categories like fruit names.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Requires data that can be ordered numerically. Fruit names have no numeric order.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mode</strong></span>
            <span class="we-rule">→ The ONLY measure that works for categorical (nominal) data. Simply count which value appears most often.</span>
          </div>
          <p class="we-explanation">Fruit names are <strong>categorical data</strong> — you cannot add or order them numerically. Mean and Median both need numbers. Only <strong>Mode</strong> applies: Mango appears 5 times (most frequent), so Mango is the mode and the most popular fruit.</p>
        </div>
      `,
      feedbackOnSkip: 'Fruit names are categorical — you cannot calculate a mean or median of words. Only Mode works: Mango appears 5 times, making it the most popular choice.',
      misconceptionTag: 'mean-for-categorical'
    },

    // ============================================================
    // ROUND 7: MEDIAN
    // Context: House prices — severely right-skewed, one luxury property
    // Misconception targeted: "mean-ignores-outlier"
    // Source C: LibreTexts — "in a skewed distribution the bulk of scores are bunched at one end; the tail throws off the mean"
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">₹25L &nbsp; ₹28L &nbsp; ₹30L &nbsp; ₹27L &nbsp; ₹29L &nbsp; ₹2.5Cr</div>`,
      contextText: 'Six houses in a colony were sold at the prices listed above (L = lakhs, Cr = crore). A journalist wants to report the "typical" house price in the colony. Which measure should she use?',
      correctMeasure: 'Median',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Median</strong></span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">The ₹2.5 Cr luxury house is an extreme <strong>outlier</strong>. Sorted: ₹25L, ₹27L, ₹28L, ₹29L, ₹30L, ₹2.5Cr. The median (average of 3rd and 4th values) = ₹28.5L — representative of the five affordable houses. The mean would be ~₹69L, misleadingly high.</p>
        </div>
      `,
      feedbackOnSkip: 'The ₹2.5 Cr property is an outlier — the mean becomes ~₹69L, far above five of the six actual prices. Median (₹28.5L) gives the fairer picture of a "typical" house.',
      misconceptionTag: 'mean-ignores-outlier'
    },

    // ============================================================
    // ROUND 8: MODE
    // Context: Blood groups of students — nominal categorical data, medical relevance
    // Misconception targeted: "mode-means-most-frequent-always"
    // Note: This round IS correctly Mode — reinforcing when mode is appropriate with a health context
    // Source B: Scribbr — "mode can be used for any level of measurement, but it's most meaningful for nominal"
    // ============================================================
    {
      datasetDisplay: `
        <table class="dataset-table">
          <tr><th>Blood Group</th><th>Number of Students</th></tr>
          <tr><td>A</td><td>8</td></tr>
          <tr><td>B</td><td>12</td></tr>
          <tr><td>O</td><td>15</td></tr>
          <tr><td>AB</td><td>5</td></tr>
        </table>`,
      contextText: 'A school nurse recorded the blood groups of 40 students (above). The school hospital wants to stock the most needed blood type. Which measure of central tendency should guide the decision?',
      correctMeasure: 'Mode',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-muted">
            <span class="we-label">Mean</span>
            <span class="we-rule">→ Requires numeric data. Blood groups (A, B, O, AB) are categories — no arithmetic possible.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Requires ordered numeric data. Blood groups cannot be meaningfully ordered.</span>
          </div>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mode</strong></span>
            <span class="we-rule">→ The only measure for categorical data. Identifies the most frequent category.</span>
          </div>
          <p class="we-explanation">Blood groups are <strong>categorical data</strong> — labels, not numbers. Mean and Median are undefined here. <strong>Mode</strong> is the most frequent blood group: O (15 students). The hospital should stock blood type O most — the modal category.</p>
        </div>
      `,
      feedbackOnSkip: 'Blood groups are categories — Mean and Median do not apply. Mode identifies the most common: O (15 students). The hospital stocks Type O most.',
      misconceptionTag: 'mean-for-categorical'
    },

    // ============================================================
    // ROUND 9: MEAN
    // Context: Runs scored by a cricketer — balanced performance data, mean = batting average
    // Misconception targeted: "mode-vs-median-ordered" (students sometimes default to median for any numeric data)
    // Source A: Lumen Learning — "Use mean... when you want the most informative measure and data is interval/ratio without outliers"
    // Note: Cricket batting average is explicitly computed as mean — reinforces real-world use of mean
    // ============================================================
    {
      datasetDisplay: `<div class="dataset-box">45 &nbsp; 62 &nbsp; 38 &nbsp; 71 &nbsp; 55 &nbsp; 48 &nbsp; 60 &nbsp; 52</div>`,
      contextText: 'A cricketer scored the runs listed above in 8 innings. A sports journalist wants to report the player\'s "batting average." Which measure of central tendency should be used?',
      correctMeasure: 'Mean',
      options: ['Mean', 'Median', 'Mode'],
      workedExampleHtml: `
        <div class="worked-example-card">
          <p class="we-title">Measure Selector</p>
          <div class="we-row we-highlighted">
            <span class="we-label"><strong>Mean</strong></span>
            <span class="we-rule">→ Best when data is balanced with no extreme outliers. Uses every value. This is what "average" means in sports.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Median</span>
            <span class="we-rule">→ Best when data has outliers or is skewed. Ignores extreme values.</span>
          </div>
          <div class="we-row we-muted">
            <span class="we-label">Mode</span>
            <span class="we-rule">→ Best for categorical data or finding the most common value.</span>
          </div>
          <p class="we-explanation">Scores range from 38–71 — no extreme outliers, no skew. A "batting average" is defined as total runs ÷ innings = (45+62+38+71+55+48+60+52)/8 = 431/8 = <strong>53.9</strong>. The <strong>Mean</strong> is the correct measure — it accounts for every innings played.</p>
        </div>
      `,
      feedbackOnSkip: 'Batting average is always the Mean: total runs ÷ number of innings = 431÷8 = 53.9. All scores are balanced (38–71), so Mean is the right and standard choice.',
      misconceptionTag: 'mode-vs-median-ordered'
    }
  ]
};
```

---

## 5. Play Area Layout

The play area (`#gameContent`) has three layers; visibility is toggled via the `hidden` class:

```
┌──────────────────────────────────────────────────────┐
│  #dataset-display  (always visible per round)        │
│  Renders round.datasetDisplay (HTML) — a styled box  │
│  for list data or a compact table for frequency data │
├──────────────────────────────────────────────────────┤
│  #question-panel  (always visible per round)         │
│  Paragraph: round.contextText                        │
│                                                      │
│  Three MCQ buttons (data-option attribute):          │
│  [ Mean ]   [ Median ]   [ Mode ]                   │
│  (always the same three options, every round)        │
│                                                      │
│  #correct-feedback  data-testid="correct-feedback"   │
│  (hidden by default)                                 │
│  Brief green confirmation: "Correct! [Measure] is    │
│  the right choice here."                             │
│  Auto-advances after 1200ms                          │
├──────────────────────────────────────────────────────┤
│  #worked-example-panel  (hidden by default)          │
│  data-testid="worked-example-panel"                  │
│  Appears after FIRST wrong attempt only.             │
│  Contains round.workedExampleHtml (injected via      │
│  innerHTML). Two buttons:                            │
│    [Got it — try again]  data-testid="got-it-btn"   │
│      → allows second attempt                        │
│    [Skip this round]     data-testid="skip-round-btn"│
│      → advances immediately                         │
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
5. Render dataset: document.getElementById('dataset-display').innerHTML = round.datasetDisplay
6. Set context text: document.getElementById('context-text').textContent = round.contextText
7. Render option buttons: clear #option-buttons, create 3 buttons from round.options[]
   Each button: data-option="<option string>", textContent = option string
   Each button MUST ALSO have: data-testid="option-N" (N=0,1,2, positional index) AND data-value="<option string>" (exact option text).
   Tests use data-testid as the stable selector.
8. Show #dataset-display and #question-panel, hide #correct-feedback, hide #worked-example-panel
9. Enable all option buttons (remove disabled attribute)
10. Update progress bar: progressBar.setRound(roundNumber)
```

### 6.3 handleOptionClick(selectedOption)

```
1. Guard: if (gameState.isProcessing) return; gameState.isProcessing = true
2. Disable all option buttons immediately (prevent double-click)
3. gameState.attemptsThisRound++
4. const round = gameState.content.rounds[gameState.currentRound - 1]
5. const isCorrect = (selectedOption === round.correctMeasure)

6. if (isCorrect):
   - Track event: attemptsThisRound === 1 ? 'measure_correct_first' : 'measure_correct_second'
   - if (attemptsThisRound === 1): gameState.totalFirstAttemptCorrect++; gameState.score += 20
   - else: gameState.score += 10  (partial credit for correct on second attempt)
   - FeedbackManager.sound('correct')
   - Show #correct-feedback with text "Correct! [round.correctMeasure] is the right choice here."
   - After 1200ms: hide #correct-feedback; advance round
   - gameState.isProcessing = false

7. else (wrong):
   - Track event: 'measure_incorrect'
   - FeedbackManager.sound('incorrect')
   - if (attemptsThisRound === 1):
       — Show worked example: inject round.workedExampleHtml into #worked-example-panel via innerHTML
       — Show #worked-example-panel (add 'visible' class for CSS animation)
       — Enable "Got it — try again" and "Skip this round" buttons
       — gameState.isProcessing = false
       — (wait for user action on worked example panel)
   - else (attemptsThisRound === 2):
       — Track event: 'measure_skipped'
       — gameState.wrongFirstAttempt++
       — Show brief skip note: inject round.feedbackOnSkip into #skip-note element
       — After 1500ms: hide everything, advance round
       — gameState.isProcessing = false
```

### 6.4 handleWorkedExampleGotIt()

```
1. Hide #worked-example-panel (remove 'visible' class)
2. Re-enable option buttons (remove disabled attribute)
3. gameState.isProcessing = false
   (attemptsThisRound remains at 1, so next click is the second attempt)
```

### 6.5 handleWorkedExampleSkip()

```
1. Track event: 'measure_skipped'
2. Hide #worked-example-panel (remove 'visible' class)
3. gameState.wrongFirstAttempt++
4. Show #skip-note with round.feedbackOnSkip for 1500ms
5. After 1500ms: advance round
```

### 6.6 Advance Round

```javascript
function advanceRound() {
  if (gameState.currentRound >= gameState.totalRounds) {
    endGame(true);  // always victory — no game-over state
  } else {
    renderRound(gameState.currentRound + 1);
  }
}
```

### 6.7 End Game

```
- Always calls endGame(true) — victory screen. No game-over.
- Star calculation based on totalFirstAttemptCorrect (out of 9):
  - ≥7/9 → 3★ ("Excellent!")
  - ≥5/9 → 2★ ("Good work!")
  - <5/9  → 1★ ("Keep practicing!")
- Results screen shows: first-attempt accuracy (X/9), rounds completed (always 9), star rating.
- score: accumulated from correct answers (20 pts first attempt, 10 pts second attempt).
```

---

## 7. CDN Implementation Patterns (MANDATORY)

### 7.1 Package Loading

```html
<!-- In <head>: -->
<script src="https://unpkg.com/@hw-app/cdn-games@latest/dist/bundle.js"></script>
```

### 7.2 waitForPackages

```javascript
function waitForPackages(callback) {
  const required = ['ScreenLayout', 'TransitionScreenComponent', 'ProgressBarComponent', 'FeedbackManager'];
  const maxWait = 10000;
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
      totalRounds: 9,
      totalLives: 0,   // NO lives display — omit hearts
      container: document.getElementById('progress-bar-container')
    });
    transitionScreen = new TransitionScreenComponent({
      screens: {
        start: { /* start screen config */ },
        victory: { /* victory screen config */ }
      },
      onStart: startGame
    });

    // Expose on window AFTER definitions
    window.endGame = endGame;
    window.restartGame = restartGame;
    window.nextRound = nextRound;
    // REQUIRED for test harness __ralph.jumpToRound() — without this, mechanics tests cannot jump to specific rounds
    window.loadRound = function(n) { gameState.currentRound = n - 1; gameState.gameEnded = false; gameState.isProcessing = false; nextRound(); };

    // Load content (injected by pipeline or fallback)
    gameState.content = window.__gameContent || fallbackContent;

    transitionScreen.show('start');
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
4. **Do NOT hardcode the dataset display** — render `round.datasetDisplay` via `innerHTML` (not `textContent`) each round, because rounds mix plain-text boxes and HTML tables.
5. **Do NOT deduct lives** — this game has no lives system. Never call `progressBar.loseLife()` or decrement any lives variable. The game always ends in victory after 9 rounds.
6. **Do NOT show a game-over screen** — there is no game-over in this game. `endGame()` always calls `transitionScreen.show('victory')`.
7. **Do NOT skip the `isProcessing` guard** — fast taps can fire `handleOptionClick` twice. Set `isProcessing = true` at the start and `false` after each async completion.
8. **Do NOT allow option buttons to remain enabled while the worked-example panel is visible** — buttons must be disabled when the panel is shown, to prevent second attempt before reading the explanation.
9. **Do NOT forget to re-enable option buttons when "Got it — try again" is clicked** — if buttons stay disabled the learner cannot make their second attempt.
10. **Do NOT render option buttons as hardcoded HTML** — they must be generated dynamically from `round.options[]` each round (even though options are always ['Mean', 'Median', 'Mode'] — the generation must be data-driven, not hardcoded, so future content changes work without HTML edits).
11. **Do NOT omit `data-testid` on option buttons** — each button must have `data-testid="option-0"`, `data-testid="option-1"`, `data-testid="option-2"` (positional) AND `data-value="<option string>"`. Tests use `data-testid` as the stable selector.
12. **Do NOT omit `data-testid` on worked-example panel elements** — the panel container must have `data-testid="worked-example-panel"`, the got-it button must have `data-testid="got-it-btn"`, the skip button must have `data-testid="skip-round-btn"`, and the correct-feedback element must have `data-testid="correct-feedback"`. Tests cannot click these elements without stable selectors.
13. **Do NOT inject `workedExampleHtml` or `datasetDisplay` as textContent** — use `innerHTML` to preserve HTML structure.
14. **Do NOT skip `gameState.attemptsThisRound` reset in `renderRound()`** — stale attempt counts from the previous round will cause the worked-example panel to not appear on first wrong attempt.
15. **Do NOT use `style.display` to toggle the worked-example panel** — use `panel.classList.add('visible')` / `panel.classList.remove('visible')` so the CSS `slideDown` animation fires on each appearance.

---

## 9. Test Scenarios (for test generation guidance)

### Category: game-flow

- **start-screen**: Page loads, start button is visible, `data-phase="start"`.
- **game-start**: Clicking play transitions to `data-phase="playing"`; round 1 renders with dataset display, context text, and 3 option buttons.
- **correct-first-attempt-advances**: Selecting the correct measure on first attempt shows `#correct-feedback` then auto-advances to round 2 after 1200ms.
- **wrong-first-attempt-shows-worked-example**: Selecting a wrong measure on first attempt shows `#worked-example-panel` with the Measure Selector reference card. Option buttons are disabled.
- **got-it-enables-second-attempt**: Clicking "Got it — try again" hides `#worked-example-panel` and re-enables option buttons for a second attempt.
- **skip-advances-round**: Clicking "Skip this round" hides the worked-example panel and advances to the next round after the skip note.
- **correct-second-attempt-advances**: Selecting the correct measure on second attempt (after worked example shown) shows `#correct-feedback` then advances.
- **wrong-second-attempt-skips**: Selecting wrong measure on second attempt advances the round with `feedbackOnSkip` note.
- **complete-9-rounds**: Completing all 9 rounds (any combination of correct/skip) transitions to `data-phase="results"` (victory).
- **no-game-over**: Confirm that no game-over transition screen ever appears, regardless of answer choices.

### Category: mechanics

- **three-star-threshold**: Answering ≥7/9 rounds correctly on first attempt → 3★ on results screen.
- **two-star-threshold**: Answering 5/9 or 6/9 correctly on first attempt → 2★.
- **one-star-threshold**: Answering <5/9 correctly on first attempt → 1★.
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
- **worked-example-panel-testid**: Element with `data-testid="worked-example-panel"` exists in the DOM (may be hidden).
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
| NCERT Class 10 | Ch 14, §14.1–14.4      | All 9 rounds use contexts from the chapter's exercise domain (marks, salary, frequency tables, grouped data).     |
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

The `workedExampleHtml` content uses class names that must be styled in the game's CSS. Include these styles:

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

The worked-example panel (`#worked-example-panel`) itself must have:

```css
#worked-example-panel {
  display: none;             /* hidden by default */
  margin-top: 16px;
  animation: slideDown 0.25s ease-out;
}

#worked-example-panel.visible {
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
  type: 'GAME_EVENT',
  payload: {
    event: eventName,           // 'measure_correct_first' | 'measure_correct_second' | 'measure_incorrect' | 'measure_skipped'
    roundNumber: gameState.currentRound,
    selectedMeasure: selectedOption,
    correctMeasure: round.correctMeasure,
    misconceptionTag: round.misconceptionTag,
    score: gameState.score,
    timestamp: Date.now()
  }
}, '*');

// Send on game end:
window.parent.postMessage({
  type: 'GAME_COMPLETE',
  payload: {
    score: gameState.score,
    totalRounds: gameState.totalRounds,
    firstAttemptCorrect: gameState.totalFirstAttemptCorrect,
    stars: computeStars(gameState.totalFirstAttemptCorrect),
    duration: Date.now() - gameState.startTime,
    events: gameState.events
  }
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
**Steps:** Start game. On round 1 (marks data, correctMeasure = 'Mean'), click `[data-testid="option-0"]` (Mean).
**Assert:** Element `[data-testid="correct-feedback"]` becomes visible. After 1200ms, `window.gameState.currentRound === 2`.

### TC-004: game-flow / wrong-first-attempt-shows-worked-example
**Description:** Wrong first attempt reveals worked-example panel with buttons disabled.
**Steps:** Start game. On round 1, click `[data-testid="option-1"]` (Median — wrong).
**Assert:** `[data-testid="worked-example-panel"]` is visible. All `[data-testid^="option-"]` buttons are disabled.

### TC-005: game-flow / got-it-enables-second-attempt
**Description:** Clicking "Got it — try again" hides worked-example panel and re-enables buttons.
**Steps:** Round 1, wrong answer. Then click `[data-testid="got-it-btn"]`.
**Assert:** `[data-testid="worked-example-panel"]` is hidden. All option buttons are enabled. `window.gameState.attemptsThisRound === 1`.

### TC-006: game-flow / skip-advances-round
**Description:** "Skip this round" from worked-example panel advances to next round.
**Steps:** Round 1, wrong answer. Panel appears. Click `[data-testid="skip-round-btn"]`.
**Assert:** After 1500ms, `window.gameState.currentRound === 2`.

### TC-007: mechanics / three-star-threshold
**Description:** ≥7/9 first-attempt correct yields 3 stars.
**Steps:** Use `window.loadRound` to step through 9 rounds, answering the correct measure on first attempt for all 9.
**Assert:** After round 9 completes, `data-phase === 'results'` AND the results screen shows 3 stars.

### TC-008: mechanics / one-star-threshold
**Description:** <5 first-attempt correct yields 1 star.
**Steps:** Use `window.loadRound` to step through all 9 rounds, giving wrong answers on first attempt every round, then skipping.
**Assert:** `data-phase === 'results'` AND results screen shows 1 star.

### TC-009: mechanics / isprocessing-guard
**Description:** Rapid double-click on same button does not double-score.
**Steps:** Start game round 1. Programmatically call `handleOptionClick('Mean')` twice in rapid succession (< 50ms apart).
**Assert:** `window.gameState.totalFirstAttemptCorrect === 1` (not 2).

### TC-010: state-sync / data-round-updates
**Description:** `data-round` attribute increments through all 9 rounds.
**Steps:** Start game. For each round, record `document.getElementById('app').dataset.round`.
**Assert:** Values are 1, 2, 3, 4, 5, 6, 7, 8, 9 in sequence.

### TC-011: contract / option-buttons-testid-and-value
**Description:** All 3 option buttons have required `data-testid` and `data-value` attributes.
**Steps:** Start game (round 1).
**Assert:** `[data-testid="option-0"][data-value="Mean"]` exists. `[data-testid="option-1"][data-value="Median"]` exists. `[data-testid="option-2"][data-value="Mode"]` exists.

### TC-012: contract / no-feedbackmanager-init
**Description:** The HTML source does not call `FeedbackManager.init()`.
**Steps:** Fetch the game HTML as text.
**Assert:** `html.includes('FeedbackManager.init(') === false`.
