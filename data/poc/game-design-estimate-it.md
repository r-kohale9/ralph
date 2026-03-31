# Assembly Book: Estimate It!

---

## 1. Game Identity

```
- Title: Estimate It!
- Game ID: estimate-it
- Type: standard
- Description: See a visual scenario with items to count, enter your best estimate, then explain your reasoning. The game evaluates both how close your estimate is AND the quality of your thinking. 10 rounds across 3 stages (small counts, bigger groups, tricky arrangements). No lives — low-stakes exploratory. Star rating at end based on combined accuracy + reasoning score.
- Learning Goal: Number Sense & Estimation for Grade 5. The kid builds the habit of using strategies (grouping, benchmarking, spatial reasoning) instead of wild guessing. They learn that a good estimate paired with sound reasoning is more valuable than a lucky guess.
- Skills covered: 1 (reasonable estimation within range) & 2 (articulating estimation strategy)
- Grade: 5
- Bloom level: L2 Understand → L4 Analyze
```

---

## 2. Parts Selected

| Part ID | Name | Included | Config/Notes |
|---------|------|----------|-------------|
| PART-001 | HTML Shell | YES | — |
| PART-002 | Package Scripts | YES | — |
| PART-003 | waitForPackages | YES | — |
| PART-004 | Initialization Block | YES | — |
| PART-005 | VisibilityTracker | YES | popupProps: default |
| PART-006 | TimerComponent | NO | No timer — low-stakes exploratory |
| PART-007 | Game State Object | YES | Custom fields: estimateAnswer, reasoningText, accuracyTier, reasoningScore, totalPoints |
| PART-008 | PostMessage Protocol | YES | — |
| PART-009 | Attempt Tracking | YES | — |
| PART-010 | Event Tracking & SignalCollector | YES | Custom events: estimate_submit, reasoning_evaluated, round_complete |
| PART-011 | End Game & Metrics | YES | Star logic based on totalPoints (see Section 8) |
| PART-012 | Debug Functions | YES | — |
| PART-013 | Validation Fixed | NO | — |
| PART-014 | Validation Function | YES | Accuracy tier check (deterministic): within 10% = spot-on, within 25% = close, else = far off |
| PART-015 | Validation LLM | YES | Evaluates reasoning quality via MathAIHelpers.SubjectiveEvaluation |
| PART-016 | StoriesComponent | NO | — |
| PART-017 | Feedback Integration | YES | Audio: correct_tap, wrong_tap. Stickers: correct/incorrect GIFs, trophy Lottie. Dynamic TTS for reasoning feedback + end-game. |
| PART-018 | Case Converter | NO | — |
| PART-019 | Results Screen UI | YES | Custom metrics: total points, accuracy rate, best reasoning |
| PART-020 | CSS Variables & Colors | YES | — |
| PART-021 | Screen Layout CSS | YES | — |
| PART-022 | Game Buttons | YES | Submit Estimate + Submit Reasoning buttons |
| PART-023 | ProgressBar Component | YES | totalRounds: 10, totalLives: 0 (no lives) |
| PART-024 | TransitionScreen Component | YES | Screens: start, stage-transition, victory |
| PART-025 | ScreenLayout Component | YES | slots: progressBar=true, transitionScreen=true |
| PART-026 | Anti-Patterns | YES (REFERENCE) | — |
| PART-027 | Play Area Construction | YES | Layout: scenario card + estimate input + reasoning textarea |
| PART-028 | InputSchema Patterns | YES | Schema type: rounds with scenarios + actual values |
| PART-029 | Story-Only Game | NO | — |
| PART-030 | Sentry Error Tracking | YES | — |
| PART-033 | Interaction Patterns | YES | Patterns: number-input (estimate), textarea (reasoning), buttons |
| PART-034 | Variable Schema Serialization | YES (POST_GEN) | — |
| PART-035 | Test Plan Generation | YES (POST_GEN) | — |
| PART-037 | Playwright Testing | YES (POST_GEN) | — |

---

## 3. Game State

```javascript
window.gameState = {
  // MANDATORY (from PART-007):
  gameId: 'estimate-it',            // GEN-GAMEID: MUST be first property
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  gameEnded: false,               // GEN-ENDGAME-GUARD: used by endGame() guard
  phase: 'start',                 // start | estimating | reasoning | evaluating | feedback | transition | results
  isProcessing: false,            // Prevents overlapping click handlers during feedback
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
  currentStage: 1,                // 1=small counts, 2=bigger groups, 3=tricky arrangements
  totalPoints: 0,                 // Accumulated points (max 3 per round = 30 total)
  estimateAnswer: null,           // Kid's numerical estimate for current round
  reasoningText: '',              // Kid's written reasoning for current round
  accuracyTier: null,             // 'spot-on' | 'close' | 'far-off' — determined after estimate submit
  reasoningScore: 0,              // 0 or 1 — determined by LLM evaluation
  roundData: null,                // Current round's content data
  accuracyPoints: 0,             // Running total of accuracy points
  reasoningPoints: 0,            // Running total of reasoning points
  contentSetId: null,            // Set from game_init postMessage
  signalConfig: null,            // Set from game_init postMessage (flushUrl, playId, etc.)
  sessionHistory: [],            // Accumulated per-session results for restart tracking
};

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
let signalCollector = null;
```

---

## 4. Input Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "EstimateItGameContent",
  "description": "Content schema for the 'Estimate It!' estimation game",
  "type": "object",
  "required": ["gameId", "rounds"],
  "properties": {
    "gameId": {
      "type": "string",
      "const": "estimate-it"
    },
    "rounds": {
      "type": "array",
      "minItems": 10,
      "maxItems": 10,
      "items": {
        "type": "object",
        "required": ["roundNumber", "stage", "scenario", "actualValue", "unit", "acceptableRange", "rubric", "hints", "feedbackSpotOn", "feedbackClose", "feedbackFarOff"],
        "properties": {
          "roundNumber": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10
          },
          "stage": {
            "type": "integer",
            "minimum": 1,
            "maximum": 3,
            "description": "Stage 1 = small counts, Stage 2 = bigger groups, Stage 3 = tricky arrangements"
          },
          "scenario": {
            "type": "object",
            "required": ["title", "description", "emoji", "emojiLayout", "question"],
            "properties": {
              "title": {
                "type": "string",
                "description": "Short title for the scenario (e.g., 'The Marble Jar')"
              },
              "description": {
                "type": "string",
                "description": "Vivid 1-2 sentence description of what the kid sees"
              },
              "emoji": {
                "type": "string",
                "description": "The emoji used for the items (e.g., '🔵')"
              },
              "emojiLayout": {
                "type": "string",
                "description": "A string of emojis arranged to visually represent the scenario. Use spaces and newlines to create spatial patterns. This is rendered in a monospace container."
              },
              "question": {
                "type": "string",
                "description": "The estimation question (e.g., 'How many marbles are in the jar?')"
              }
            },
            "additionalProperties": false
          },
          "actualValue": {
            "type": "integer",
            "minimum": 1,
            "description": "The true count/value that the kid is estimating"
          },
          "unit": {
            "type": "string",
            "description": "Unit label for the answer (e.g., 'marbles', 'birds', 'tiles')"
          },
          "acceptableRange": {
            "type": "object",
            "required": ["spotOn", "close"],
            "properties": {
              "spotOn": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 0.5,
                "description": "Fraction tolerance for 'spot on' tier (e.g., 0.1 = within 10%)"
              },
              "close": {
                "type": "number",
                "minimum": 0.01,
                "maximum": 0.5,
                "description": "Fraction tolerance for 'close' tier (e.g., 0.25 = within 25%)"
              }
            },
            "additionalProperties": false
          },
          "rubric": {
            "type": "string",
            "description": "LLM rubric for evaluating the kid's reasoning. Describes what a good strategy looks like for THIS specific scenario."
          },
          "hints": {
            "type": "object",
            "required": ["strategyHint", "revealExplanation"],
            "properties": {
              "strategyHint": {
                "type": "string",
                "description": "A hint about a good strategy for this scenario (shown after feedback if reasoning was weak)"
              },
              "revealExplanation": {
                "type": "string",
                "description": "Explanation of the actual answer and the best strategy (shown as dynamic TTS feedback)"
              }
            },
            "additionalProperties": false
          },
          "feedbackSpotOn": {
            "type": "string",
            "description": "TTS text for spot-on estimate"
          },
          "feedbackClose": {
            "type": "string",
            "description": "TTS text for close estimate"
          },
          "feedbackFarOff": {
            "type": "string",
            "description": "TTS text for far-off estimate"
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

**Exposed content shape:**
```json
{
  "gameId": "estimate-it",
  "rounds": [
    {
      "roundNumber": 1,
      "stage": 1,
      "scenario": {
        "title": "The Cookie Tray",
        "description": "A baking tray with chocolate chip cookies arranged in neat rows.",
        "emoji": "🍪",
        "emojiLayout": "🍪🍪🍪🍪🍪\n🍪🍪🍪🍪🍪\n🍪🍪🍪🍪🍪",
        "question": "How many cookies are on the tray?"
      },
      "actualValue": 15,
      "unit": "cookies",
      "acceptableRange": { "spotOn": 0.1, "close": 0.25 },
      "rubric": "A good answer mentions counting rows/columns (3 rows of 5) or grouping. Accept any strategy that shows deliberate counting rather than random guessing.",
      "hints": {
        "strategyHint": "Try counting one row and multiplying by the number of rows!",
        "revealExplanation": "There are 3 rows with 5 cookies each. 3 times 5 equals 15 cookies total."
      },
      "feedbackSpotOn": "Amazing! You nailed it!",
      "feedbackClose": "Really close! Great estimating!",
      "feedbackFarOff": "That's a bit off — let's look at a strategy that could help."
    }
  ]
}
```

---

## 5. Fallback Content

All 10 rounds verified — each round has a valid scenario, correct actual value, appropriate rubric, and proper stage assignments.

```javascript
const fallbackContent = {
  "gameId": "estimate-it",
  "rounds": [
    {
      "roundNumber": 1,
      "stage": 1,
      "scenario": {
        "title": "The Cookie Tray",
        "description": "A baking tray with chocolate chip cookies laid out in neat rows.",
        "emoji": "🍪",
        "emojiLayout": "🍪🍪🍪🍪🍪\n🍪🍪🍪🍪🍪\n🍪🍪🍪🍪🍪",
        "question": "How many cookies are on the tray?"
      },
      "actualValue": 15,
      "unit": "cookies",
      "acceptableRange": { "spotOn": 0.1, "close": 0.25 },
      "rubric": "A good answer mentions counting rows or columns (3 rows of 5), grouping, or multiplying. Counting each one individually is acceptable for this small count — but note in feedback that grouping (rows × columns) is faster. Accept any strategy that shows deliberate structure, not just 'I guessed.'",
      "hints": {
        "strategyHint": "Try counting one row and multiplying by the number of rows!",
        "revealExplanation": "There are 3 rows with 5 cookies each. 3 times 5 equals 15 cookies."
      },
      "feedbackSpotOn": "Spot on! You got the exact count!",
      "feedbackClose": "Really close! Your estimate was in the right ballpark.",
      "feedbackFarOff": "That's a bit off. Let's see how you could get closer."
    },
    {
      "roundNumber": 2,
      "stage": 1,
      "scenario": {
        "title": "Stars in the Sky",
        "description": "A small patch of night sky with stars twinkling in a loose cluster.",
        "emoji": "⭐",
        "emojiLayout": "  ⭐   ⭐  ⭐\n⭐  ⭐     ⭐\n  ⭐  ⭐ ⭐\n⭐    ⭐   ⭐",
        "question": "How many stars can you count in this patch of sky?"
      },
      "actualValue": 12,
      "unit": "stars",
      "acceptableRange": { "spotOn": 0.1, "close": 0.25 },
      "rubric": "A good answer mentions counting row by row, scanning left to right, or grouping nearby stars into clusters. Counting each one is acceptable for this small count — but encourage scanning strategies for when counts get bigger. Accept any systematic counting approach.",
      "hints": {
        "strategyHint": "Try scanning from top to bottom, counting each row carefully.",
        "revealExplanation": "There are 12 stars. Scanning row by row: 3 on top, 3 in the second row, 3 in the third, and 3 at the bottom."
      },
      "feedbackSpotOn": "Perfect! You counted every star!",
      "feedbackClose": "Almost! Just a couple off.",
      "feedbackFarOff": "Scattered items are tricky! Try scanning row by row next time."
    },
    {
      "roundNumber": 3,
      "stage": 1,
      "scenario": {
        "title": "Apples in the Basket",
        "description": "A fruit basket with red and green apples piled up together.",
        "emoji": "🍎",
        "emojiLayout": "    🍎🍎\n  🍎🍏🍎🍏\n🍎🍏🍎🍏🍎🍏\n🍎🍎🍏🍎🍎🍏🍎",
        "question": "How many apples (both red and green) are in the basket?"
      },
      "actualValue": 19,
      "unit": "apples",
      "acceptableRange": { "spotOn": 0.1, "close": 0.25 },
      "rubric": "A good answer mentions counting each row and adding them up, noticing the triangular/pyramid shape, or counting by color and adding. Individual counting is acceptable here — but note that row-by-row is faster and scales better. Accept any deliberate approach.",
      "hints": {
        "strategyHint": "Count each row separately: top row, then second row, and so on, then add them up!",
        "revealExplanation": "The basket has rows of 2, 4, 6, and 7 apples. That's 2 plus 4 plus 6 plus 7 equals 19 apples total."
      },
      "feedbackSpotOn": "Incredible! You got the exact count!",
      "feedbackClose": "Nice work! Very close to the actual number.",
      "feedbackFarOff": "Mixed colors can be confusing! Try counting row by row instead."
    },
    {
      "roundNumber": 4,
      "stage": 2,
      "scenario": {
        "title": "The Parking Lot",
        "description": "A busy parking lot seen from above. Cars are parked in rows with some gaps.",
        "emoji": "🚗",
        "emojiLayout": "🚗🚗🚗🚗🚗🚗🚗🚗\n🚗🚗🚗  🚗🚗🚗🚗\n🚗🚗🚗🚗🚗🚗  🚗\n🚗🚗  🚗🚗🚗🚗🚗\n🚗🚗🚗🚗  🚗🚗🚗",
        "question": "How many cars are parked in this lot?"
      },
      "actualValue": 36,
      "unit": "cars",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions counting rows, noting the gaps (empty spaces), or estimating a full grid (5 rows × 8 = 40) then subtracting gaps. Accept any strategy that accounts for the missing cars.",
      "hints": {
        "strategyHint": "Count a full row first (8 cars), multiply by the number of rows (5), then subtract the empty spaces!",
        "revealExplanation": "A full lot would be 5 rows of 8 equals 40 cars. But there are 4 empty gaps (rows 2, 3, 4, and 5 each have one gap), so 40 minus 4 equals 36 cars."
      },
      "feedbackSpotOn": "Excellent! You counted every car perfectly!",
      "feedbackClose": "Great estimate! You were really close.",
      "feedbackFarOff": "With gaps in the rows, try counting a full row and subtracting the empty spots."
    },
    {
      "roundNumber": 5,
      "stage": 2,
      "scenario": {
        "title": "Flowers in the Garden",
        "description": "A garden bed with sunflowers planted in a scattered pattern across the soil.",
        "emoji": "🌻",
        "emojiLayout": "🌻 🌻🌻  🌻 🌻\n 🌻 🌻 🌻🌻  🌻\n🌻🌻 🌻  🌻🌻\n  🌻🌻  🌻  🌻\n🌻  🌻🌻 🌻🌻\n🌻🌻  🌻  🌻",
        "question": "How many sunflowers are growing in this garden?"
      },
      "actualValue": 28,
      "unit": "sunflowers",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions scanning systematically (row by row or column by column), grouping nearby flowers into clusters of 5 or 10, or using a benchmark. Accept any deliberate counting strategy.",
      "hints": {
        "strategyHint": "With scattered items, try grouping them into clusters of 5, then count the clusters!",
        "revealExplanation": "There are 28 sunflowers. Counting row by row: 5, 5, 5, 4, 5, 4 — that adds up to 28."
      },
      "feedbackSpotOn": "Wow, spot on! Your strategy really worked!",
      "feedbackClose": "Very close! Scattered patterns are tricky and you handled it well.",
      "feedbackFarOff": "Scattered items need a system. Try grouping them into fives next time."
    },
    {
      "roundNumber": 6,
      "stage": 2,
      "scenario": {
        "title": "Books on the Shelf",
        "description": "Three bookshelves stacked on top of each other, each with books packed in tightly. Some books are thicker and take more space.",
        "emoji": "📚",
        "emojiLayout": "📕📗📘📙📕📗📘📙📕📗📘\n📘📙📕📗📘📙📕📗📘📙📕📗\n📗📘📙📕📗📘📙📕📗📘",
        "question": "How many books are on all three shelves combined?"
      },
      "actualValue": 33,
      "unit": "books",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions counting each shelf separately and adding, or noticing the shelves hold about 10-12 each and multiplying. Accept estimation by averaging shelf size.",
      "hints": {
        "strategyHint": "Count one shelf, then check if the others have about the same number!",
        "revealExplanation": "Shelf 1 has 11, shelf 2 has 12, and shelf 3 has 10 books. 11 plus 12 plus 10 equals 33 books."
      },
      "feedbackSpotOn": "Perfect count! You really worked through that carefully!",
      "feedbackClose": "Great job! Each shelf has a slightly different number — you were close!",
      "feedbackFarOff": "Try counting one shelf first, then multiply by the number of shelves as a quick estimate."
    },
    {
      "roundNumber": 7,
      "stage": 2,
      "scenario": {
        "title": "Ants on the Picnic Blanket",
        "description": "A picnic blanket seen from above. Ants are marching in several winding trails from the edges toward a sandwich in the middle.",
        "emoji": "🐜",
        "emojiLayout": "🐜  🐜🐜      🐜\n  🐜   🐜  🐜🐜\n🐜  🐜🐜    🐜\n  🐜  🍞🍞  🐜🐜\n🐜🐜  🍞🍞    🐜\n  🐜  🐜  🐜🐜\n🐜  🐜🐜   🐜\n  🐜🐜    🐜  🐜",
        "question": "How many ants are heading toward the sandwich?"
      },
      "actualValue": 30,
      "unit": "ants",
      "acceptableRange": { "spotOn": 0.1, "close": 0.25 },
      "rubric": "A good answer mentions counting by trails/regions, excluding the sandwich emojis from the count, or scanning row by row while skipping the food. Accept any systematic approach that distinguishes ants from food.",
      "hints": {
        "strategyHint": "Divide the blanket into four quadrants around the sandwich and count each section!",
        "revealExplanation": "There are 30 ants (the sandwich doesn't count!). Counting row by row: 4, 4, 4, 3, 3, 4, 4, 4 — that adds up to 30."
      },
      "feedbackSpotOn": "Amazing! You counted every ant even with the sandwich in the way!",
      "feedbackClose": "Really close! The sandwich makes it tricky — nice job.",
      "feedbackFarOff": "When there are distractors (like the sandwich), divide the scene into sections and count each one!"
    },
    {
      "roundNumber": 8,
      "stage": 3,
      "scenario": {
        "title": "The Stadium Crowd",
        "description": "A section of stadium seating filled with spectators. The section has 8 rows and most seats are taken, but a few are empty.",
        "emoji": "👤",
        "emojiLayout": "👤👤👤👤👤👤👤👤👤👤👤👤\n👤👤👤  👤👤👤👤👤👤👤\n👤👤👤👤👤👤👤👤  👤👤\n👤👤👤👤👤👤👤👤👤👤👤👤\n👤👤  👤👤👤👤👤👤👤👤\n👤👤👤👤👤👤  👤👤👤👤\n👤👤👤👤👤👤👤👤👤👤👤👤\n👤👤👤👤👤👤👤👤👤  👤",
        "question": "How many spectators are sitting in this section?"
      },
      "actualValue": 88,
      "unit": "spectators",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions: counting seats per row (about 12), multiplying by rows (8), then subtracting empty seats. Or counting full rows vs partial rows. Accept any strategy that uses multiplication as a shortcut instead of counting one by one.",
      "hints": {
        "strategyHint": "Count one full row, multiply by the total rows, then subtract the empty seats!",
        "revealExplanation": "A full section would be 8 rows times 12 seats equals 96. There are 8 empty seats, so 96 minus 8 equals 88 spectators."
      },
      "feedbackSpotOn": "Incredible! You worked through that huge crowd perfectly!",
      "feedbackClose": "Great estimation! With big numbers, being within a few is impressive.",
      "feedbackFarOff": "For big groups, find the pattern first: rows times seats, then adjust for gaps."
    },
    {
      "roundNumber": 9,
      "stage": 3,
      "scenario": {
        "title": "Tiles on the Floor",
        "description": "A bathroom floor with small square tiles. Some tiles are blue and some are white, forming a checkerboard pattern. You need to count ALL tiles.",
        "emoji": "🟦",
        "emojiLayout": "🟦⬜🟦⬜🟦⬜🟦⬜🟦⬜\n⬜🟦⬜🟦⬜🟦⬜🟦⬜🟦\n🟦⬜🟦⬜🟦⬜🟦⬜🟦⬜\n⬜🟦⬜🟦⬜🟦⬜🟦⬜🟦\n🟦⬜🟦⬜🟦⬜🟦⬜🟦⬜\n⬜🟦⬜🟦⬜🟦⬜🟦⬜🟦\n🟦⬜🟦⬜🟦⬜🟦⬜🟦⬜",
        "question": "How many tiles (blue AND white combined) cover this section of floor?"
      },
      "actualValue": 70,
      "unit": "tiles",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions counting columns times rows (10 × 7 = 70), or recognizing the grid pattern and multiplying dimensions. The checkerboard pattern is a distractor — both colors count. Accept any answer that shows the student recognized this is a simple grid multiplication problem despite the visual complexity.",
      "hints": {
        "strategyHint": "Don't get distracted by the colors! Count how many tiles wide and how many tiles tall, then multiply.",
        "revealExplanation": "The floor is 10 tiles wide and 7 tiles tall. 10 times 7 equals 70 tiles total. The checkerboard pattern is just colors — every square is a tile!"
      },
      "feedbackSpotOn": "Perfect! You saw right through the pattern trick!",
      "feedbackClose": "Almost! The checkerboard can be distracting but you stayed focused.",
      "feedbackFarOff": "The two colors can trick you into counting only one! Remember: ALL squares are tiles. Count width times height."
    },
    {
      "roundNumber": 10,
      "stage": 3,
      "scenario": {
        "title": "The Bead Necklace",
        "description": "A long necklace made of colorful beads uncoiled and laid out flat in rows. The beads follow a repeating pattern: 3 red, 2 blue, 1 gold — over and over.",
        "emoji": "🔴",
        "emojiLayout": "🔴🔴🔴🔵🔵🟡 🔴🔴🔴🔵🔵🟡\n🔴🔴🔴🔵🔵🟡 🔴🔴🔴🔵🔵🟡\n🔴🔴🔴🔵🔵🟡 🔴🔴🔴🔵🔵🟡\n🔴🔴🔴🔵🔵🟡 🔴🔴🔴🔵🔵🟡",
        "question": "How many beads are on this entire necklace?"
      },
      "actualValue": 48,
      "unit": "beads",
      "acceptableRange": { "spotOn": 0.1, "close": 0.2 },
      "rubric": "A good answer mentions finding the repeating pattern (3 red + 2 blue + 1 gold = 6 per group), counting how many complete groups there are, or counting one spiral section and multiplying. Accept any strategy that uses the pattern to avoid counting every bead individually.",
      "hints": {
        "strategyHint": "Find the repeating pattern first: how many beads per repeat? Then count how many repeats!",
        "revealExplanation": "The pattern is 3 red, 2 blue, 1 gold — that's 6 beads per repeat. There are 8 complete repeats: 8 times 6 equals 48 beads total."
      },
      "feedbackSpotOn": "Brilliant! You cracked the pattern and nailed the count!",
      "feedbackClose": "Very close! Finding the repeat pattern is the key — you were right on track.",
      "feedbackFarOff": "With repeating patterns, find the group size first (6 beads), then count how many groups. It's way faster than counting one by one!"
    }
  ]
};
```

### Content Generation Guide

The game receives content via `postMessage` (`game_init` -> `event.data.data.content`). To generate different difficulty levels, vary these parameters:

| Field | Easy | Medium | Hard |
|-------|------|--------|------|
| Rounds | 10 | 10 | 10 |
| Stage 1 rounds | 4 | 3 | 2 |
| Stage 2 rounds | 4 | 4 | 4 |
| Stage 3 rounds | 2 | 3 | 4 |
| Actual values range | 8–25 | 15–50 | 30–120 |
| Spot-on tolerance | 15% | 10% | 10% |
| Close tolerance | 30% | 25% | 20% |
| Visual complexity | Neat rows/grids | Scattered + some gaps | Patterns, spirals, distractors |
| Distractor items | None | 1-2 rounds with mixed items | 3-4 rounds with distractors or patterns |

**Content constraints (MUST be enforced):**
- All emoji layouts must render correctly in monospace — use spaces for gaps, newlines for rows.
- `actualValue` must exactly match the count of target items in `emojiLayout`.
- Distractor items (like the sandwich in the ant round) must NOT be counted — make this clear in the question.
- `rubric` must describe what a good estimation strategy looks like for THAT specific scenario. No generic rubrics.
- `hints.revealExplanation` must walk through the best strategy step by step, mentioning specific numbers.
- `feedbackSpotOn`, `feedbackClose`, `feedbackFarOff` must be scenario-specific, not generic.
- Contexts should be familiar real-world scenarios: food, nature, classroom, sports, crafts, home items.
- Each content set should use unique scenarios — do not repeat the same emoji or context within a set.
- Stage progression must be maintained: Stage 1 first, then Stage 2, then Stage 3.

---

## 6. Screens & HTML Structure

### Body HTML (uses `<template>` for ScreenLayout compatibility — PART-025)

```html
<div id="app"></div>

<template id="game-template">
  <div id="game-screen" class="game-block">
    <!-- Scenario Card -->
    <div class="scenario-card" id="scenario-card">
      <h3 class="scenario-title" id="scenario-title"></h3>
      <div class="scenario-illustration" id="scenario-illustration"></div>
      <p class="scenario-description" id="scenario-description"></p>
      <p class="scenario-question" id="scenario-question"></p>
    </div>

    <!-- Estimate Input Area -->
    <div class="estimate-area" id="estimate-area">
      <label class="input-label" for="estimate-input">Your estimate:</label>
      <div class="estimate-row">
        <input type="number" id="estimate-input" class="estimate-input" min="1" max="999" placeholder="?" data-signal-id="estimate-input">
        <span class="unit-label" id="unit-label"></span>
      </div>
      <button class="game-btn btn-primary" id="btn-submit-estimate" data-signal-id="btn-submit-estimate" onclick="handleEstimateSubmit()">
        <span id="btn-estimate-text">Submit Estimate</span>
      </button>
    </div>

    <!-- Accuracy Feedback (shown after estimate, before reasoning) -->
    <div class="accuracy-feedback" id="accuracy-feedback" style="display:none;">
      <div class="accuracy-badge" id="accuracy-badge"></div>
      <p class="accuracy-text" id="accuracy-text"></p>
    </div>

    <!-- Reasoning Area (shown after estimate submit) -->
    <div class="reasoning-area" id="reasoning-area" style="display:none;">
      <label class="input-label" for="reasoning-input">Why did you pick that number? Explain your thinking:</label>
      <textarea id="reasoning-input" class="reasoning-input" rows="3" maxlength="300" placeholder="I estimated this because..." data-signal-id="reasoning-input"></textarea>
      <div class="char-count"><span id="char-count">0</span>/300</div>
      <button class="game-btn btn-primary" id="btn-submit-reasoning" data-signal-id="btn-submit-reasoning" onclick="handleReasoningSubmit()">
        <span id="btn-reasoning-text">Submit Reasoning</span>
      </button>
    </div>

    <!-- Full Feedback Area (shown after reasoning evaluated) -->
    <div class="feedback-area" id="feedback-area" style="display:none;">
      <div class="feedback-section">
        <p class="feedback-label">Your estimate</p>
        <p class="feedback-value" id="feedback-estimate"></p>
        <p class="feedback-label">Actual answer</p>
        <p class="feedback-value feedback-actual" id="feedback-actual"></p>
      </div>
      <div class="feedback-section" id="reasoning-feedback-section">
        <p class="feedback-label">Your reasoning</p>
        <p class="feedback-reasoning" id="feedback-reasoning"></p>
      </div>
      <div class="feedback-section">
        <p class="feedback-label">Points this round</p>
        <p class="feedback-points" id="feedback-points"></p>
      </div>
      <div class="feedback-hint" id="feedback-hint" style="display:none;">
        <p class="hint-label">💡 Strategy tip:</p>
        <p class="hint-text" id="hint-text"></p>
      </div>
      <button class="game-btn btn-primary feedback-next-btn" id="btn-next-round" data-signal-id="btn-next-round" onclick="handleNextRound()" style="display:none;">Next Round →</button>
    </div>
  </div>

  <div id="results-screen" class="game-block" style="display:none;">
    <div class="results-card">
      <div id="stars-display" class="stars-display"></div>
      <h2 class="results-title">Game Complete!</h2>
      <div class="results-metrics">
        <div class="metric-row">
          <span class="metric-label">Total Points</span>
          <span class="metric-value" id="result-points">0/30</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Accuracy Score</span>
          <span class="metric-value" id="result-accuracy">0/20</span>
        </div>
        <div class="metric-row">
          <span class="metric-label">Reasoning Score</span>
          <span class="metric-value" id="result-reasoning">0/10</span>
        </div>
      </div>
      <button class="game-btn btn-primary" id="btn-restart" data-signal-id="restart-button" onclick="restartGame()">Play Again</button>
    </div>
  </div>
</template>
```

---

## 7. CSS

```css
/* === CSS Variables (PART-020) === */
:root {
  --mathai-green: #219653;
  --mathai-light-green: #D9F8D9;
  --mathai-red: #E35757;
  --mathai-light-red: #FFD9D9;
  --mathai-blue: #2563eb;
  --mathai-light-blue: #EBF0FF;
  --mathai-orange: #F2994A;
  --mathai-light-orange: #FFF3E0;
  --mathai-gray: #828282;
  --mathai-light-gray: #F2F2F2;
  --mathai-border-gray: #E0E0E0;
  --mathai-white: #FFFFFF;
  --mathai-text-primary: #4a4a4a;
  --mathai-font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --mathai-font-size-title: 24px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-label: 14px;
  --mathai-font-size-small: 12px;
}

/* === Reset === */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-light-gray);
  color: var(--mathai-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* === Game Block === */
.game-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
  gap: 16px;
}

/* === Scenario Card === */
.scenario-card {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: fadeIn 0.4s ease;
}

.scenario-title {
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  color: var(--mathai-blue);
  text-align: center;
  margin-bottom: 12px;
}

.scenario-illustration {
  width: 100%;
  min-height: 120px;
  background: var(--mathai-light-blue);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  padding: 16px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 20px;
  line-height: 1.6;
  white-space: pre;
  text-align: center;
  overflow-x: auto;
}

.scenario-description {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  text-align: center;
  margin-bottom: 8px;
  line-height: 1.4;
}

.scenario-question {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-text-primary);
  text-align: center;
  line-height: 1.5;
}

/* === Estimate Input Area === */
.estimate-area {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease;
}

.input-label {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-gray);
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.estimate-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.estimate-input {
  width: 100px;
  height: 52px;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 12px;
  text-align: center;
  font-size: var(--mathai-font-size-title);
  font-weight: 700;
  font-family: var(--mathai-font-family);
  color: var(--mathai-text-primary);
  outline: none;
  transition: border-color 0.2s ease;
}
.estimate-input:focus {
  border-color: var(--mathai-blue);
}

.unit-label {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  color: var(--mathai-text-primary);
}

/* === Accuracy Feedback Badge === */
.accuracy-feedback {
  width: 100%;
  max-width: 360px;
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.3s ease;
}

.accuracy-feedback.spot-on {
  background: var(--mathai-light-green);
  border-left: 4px solid var(--mathai-green);
}
.accuracy-feedback.close {
  background: var(--mathai-light-orange);
  border-left: 4px solid var(--mathai-orange);
}
.accuracy-feedback.far-off {
  background: var(--mathai-light-red);
  border-left: 4px solid var(--mathai-red);
}

.accuracy-badge {
  font-size: 32px;
  margin-bottom: 8px;
}

.accuracy-text {
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  line-height: 1.4;
}

/* === Reasoning Area === */
.reasoning-area {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease;
}

.reasoning-input {
  width: 100%;
  border: 2px solid var(--mathai-border-gray);
  border-radius: 12px;
  padding: 12px;
  font-size: var(--mathai-font-size-body);
  font-family: var(--mathai-font-family);
  color: var(--mathai-text-primary);
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  line-height: 1.5;
  margin-bottom: 4px;
}
.reasoning-input:focus {
  border-color: var(--mathai-blue);
}

.char-count {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  text-align: right;
  margin-bottom: 12px;
}

/* === Buttons (PART-022) === */
.game-btn {
  width: 100%;
  padding: 14px 32px;
  border: none;
  border-radius: 12px;
  font-size: var(--mathai-font-size-body);
  font-weight: 600;
  font-family: var(--mathai-font-family);
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 48px;
}

.btn-primary {
  background: var(--mathai-green);
  color: var(--mathai-white);
}
.btn-primary:hover { filter: brightness(0.9); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.feedback-next-btn {
  margin-top: 16px;
  animation: slideInUp 0.3s ease;
}

/* === Full Feedback Area === */
.feedback-area {
  width: 100%;
  max-width: 360px;
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  animation: slideInUp 0.4s ease;
}

.feedback-section {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--mathai-light-gray);
}
.feedback-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.feedback-label {
  font-size: var(--mathai-font-size-small);
  color: var(--mathai-gray);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.feedback-value {
  font-size: var(--mathai-font-size-body);
  font-weight: 700;
  color: var(--mathai-text-primary);
}

.feedback-actual {
  color: var(--mathai-blue);
}

.feedback-reasoning {
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
  line-height: 1.5;
  font-style: italic;
}

.feedback-points {
  font-size: var(--mathai-font-size-title);
  font-weight: 700;
  color: var(--mathai-green);
}

.feedback-hint {
  background: var(--mathai-light-blue);
  border-radius: 12px;
  padding: 12px;
  margin-top: 12px;
}

.hint-label {
  font-size: var(--mathai-font-size-label);
  font-weight: 700;
  color: var(--mathai-blue);
  margin-bottom: 4px;
}

.hint-text {
  font-size: var(--mathai-font-size-label);
  color: var(--mathai-text-primary);
  line-height: 1.4;
}

/* === Results Screen (PART-019) === */
#results-screen {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 100;
  background: var(--mathai-light-gray);
  overflow-y: auto;
}

.results-card {
  background: var(--mathai-white);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  max-width: 360px;
  width: 100%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.results-title {
  font-size: var(--mathai-font-size-title);
  margin-bottom: 24px;
  color: var(--mathai-text-primary);
}

.stars-display {
  font-size: 40px;
  margin-bottom: 16px;
  display: flex;
  justify-content: center;
  gap: 8px;
}

.results-metrics {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mathai-light-gray);
}

.metric-label {
  color: var(--mathai-gray);
  font-size: var(--mathai-font-size-label);
}

.metric-value {
  font-weight: 700;
  font-size: var(--mathai-font-size-body);
  color: var(--mathai-text-primary);
}

/* === Animations === */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

## 8. Game Flow

### Stage Progression

- **Stage 1 (Rounds 1-3) — Small Counts:** Neatly arranged items in rows/columns. Counts 12–19. Exact counting is possible at this stage — the goal is building confidence and introducing the idea of describing *how* you counted (strategies). The revealExplanation models grouping/multiplication even when counting one-by-one works.
- **Stage 2 (Rounds 4-7) — Bigger Groups:** Scattered arrangements, items with gaps, larger quantities (25–50). Requires more deliberate strategies (grouping by 5s/10s, grid estimation, subtracting gaps).
- **Stage 3 (Rounds 8-10) — Tricky Arrangements:** Large counts (50–120), visual distractors (mixed items, patterns, spirals). Requires sophisticated strategies (multiply dimensions, identify patterns, section the scene).

### Scoring

Each round awards up to 3 points:
- **Accuracy (0-2 points):**
  - 🎯 **Spot on** (within `acceptableRange.spotOn` of actual): **2 points**
  - 👍 **Close** (within `acceptableRange.close` of actual): **1 point**
  - 📐 **Far off** (beyond `close` range): **0 points**
- **Reasoning (0-1 point):**
  - ✅ Good reasoning (LLM evaluates as demonstrating a deliberate strategy): **1 point**
  - ❌ Weak reasoning (guessing, empty, or incoherent): **0 points**

**Max total: 30 points (10 rounds × 3 points)**

**Star calculation:**
- 24-30 points → ⭐⭐⭐ (3 stars)
- 15-23 points → ⭐⭐ (2 stars)
- 1-14 points → ⭐ (1 star)

### Flow Steps

1. **Page loads** → DOMContentLoaded fires:
   - `waitForPackages()`
   - `FeedbackManager.init()`
   - Audio preload: `correct_tap`, `wrong_tap`
   - SignalCollector created (PART-010) and assigned to `window.signalCollector`
   - `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })`
   - Clone `<template id="game-template">` into `#gameContent`
   - ProgressBar created (totalRounds: 10, totalLives: 0)
   - TransitionScreen created
   - VisibilityTracker created
   - Attach `input` listener on `#reasoning-input` to update `#char-count`
   - Register `window.addEventListener('message', handlePostMessage)` for game_init
   - Show start transition screen (with start button disabled until content is loaded)
   - Set a 3-second fallback timer: if no `game_init` arrives, load `fallbackContent`

2. **handlePostMessage(event)** — receives content and signal config from parent:
   - If `event.data.type === 'game_init'`:
     ```javascript
     gameState.content = event.data.data.content || fallbackContent;
     gameState.contentSetId = event.data.data.contentSetId || null;
     gameState.signalConfig = event.data.data.signalConfig || null;

     // Configure SignalCollector flush (PART-010 v3)
     if (signalCollector && gameState.signalConfig) {
       if (gameState.signalConfig.flushUrl) signalCollector.flushUrl = gameState.signalConfig.flushUrl;
       if (gameState.signalConfig.playId) signalCollector.playId = gameState.signalConfig.playId;
       if (gameState.signalConfig.sessionId) signalCollector.sessionId = gameState.signalConfig.sessionId;
       if (gameState.signalConfig.studentId) signalCollector.studentId = gameState.signalConfig.studentId;
       signalCollector.startFlushing();
     }
     ```
   - Enable start button on transition screen
   - Record view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('screen_transition', {
         screen: 'start',
         metadata: { transition_from: 'loading', content_loaded: true }
       });
     }
     ```

3. **startGame()** (from start screen button):
   - If `!gameState.content`: load fallbackContent
   - Set `gameState.startTime = Date.now()`
   - Set `gameState.isActive = true`, `gameState.gameEnded = false`
   - Set `gameState.phase = 'estimating'`; `syncDOMState()`
   - Set `duration_data.startTime = new Date().toISOString()`
   - `trackEvent('game_start', 'game')`
   - Call `setupRound()`

4. **setupRound()**:
   - Get `roundData = gameState.content.rounds[gameState.currentRound]`
   - Set `gameState.roundData = roundData`
   - Set `gameState.currentStage = roundData.stage`
   - Reset round state: `gameState.estimateAnswer = null`, `gameState.reasoningText = ''`, `gameState.accuracyTier = null`, `gameState.reasoningScore = 0`
   - Set `gameState.isProcessing = false`
   - Populate scenario card: `#scenario-title`, `#scenario-illustration` (innerHTML = emojiLayout), `#scenario-description`, `#scenario-question`
   - Set `#unit-label` from `roundData.unit`
   - Clear `#estimate-input`, clear `#reasoning-input`, reset `#char-count` to 0
   - Show `#estimate-area`, hide `#reasoning-area`, `#accuracy-feedback`, `#feedback-area`, `#feedback-hint`
   - Enable `#btn-submit-estimate`
   - Set `gameState.phase = 'estimating'`; `syncDOMState()`
   - `progressBar.update(gameState.currentRound, 0)`
   - Show `#game-screen`, ensure `#results-screen` hidden
   - `trackEvent('round_start', 'game', { round: gameState.currentRound + 1, stage: roundData.stage })`
   - Record view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('content_render', {
         screen: 'gameplay',
         content_snapshot: {
           question_text: roundData.scenario.question,
           round: gameState.currentRound + 1,
           stage: roundData.stage,
           actualValue: roundData.actualValue,
           trigger: 'round_start'
         },
         components: {
           progress: { current: gameState.currentRound, total: gameState.totalRounds }
         }
       });
     }
     ```

5. **handleEstimateSubmit()** — kid taps "Submit Estimate":
   - Guard: `if (!gameState.isActive || gameState.isProcessing) return`
   - `gameState.isProcessing = true`
   - Read `estimate = parseInt(document.getElementById('estimate-input').value)`
   - If `isNaN(estimate) || estimate < 1`: show inline error "Please enter a number", `gameState.isProcessing = false`, return
   - `gameState.estimateAnswer = estimate`
   - **Calculate accuracy tier (PART-014 deterministic):**
     ```javascript
     const actual = gameState.roundData.actualValue;
     const diff = Math.abs(estimate - actual);
     const pct = diff / actual;
     if (pct <= gameState.roundData.acceptableRange.spotOn) {
       gameState.accuracyTier = 'spot-on';
     } else if (pct <= gameState.roundData.acceptableRange.close) {
       gameState.accuracyTier = 'close';
     } else {
       gameState.accuracyTier = 'far-off';
     }
     ```
   - Show `#accuracy-feedback` with tier-specific styling and message:
     - spot-on: 🎯 badge, green background, feedbackSpotOn text
     - close: 👍 badge, orange background, feedbackClose text
     - far-off: 📐 badge, red background, feedbackFarOff text
   - Play audio:
     - spot-on/close: `await FeedbackManager.sound.play('correct_tap', { subtitle, sticker })` with correct sticker
     - far-off: `await FeedbackManager.sound.play('wrong_tap', { subtitle, sticker })` with incorrect sticker
   - Record feedback display view event:
     ```javascript
     if (signalCollector) {
       signalCollector.recordViewEvent('feedback_display', {
         screen: 'gameplay',
         content_snapshot: {
           feedback_type: gameState.accuracyTier,
           message: gameState.accuracyTier === 'spot-on' ? gameState.roundData.feedbackSpotOn : gameState.accuracyTier === 'close' ? gameState.roundData.feedbackClose : gameState.roundData.feedbackFarOff,
           round: gameState.currentRound + 1,
           estimate: estimate,
           actual: actual,
           trigger: 'user_action'
         }
       });
     }
     ```
   - Disable `#btn-submit-estimate`
   - `trackEvent('estimate_submit', 'game', { estimate, actual: gameState.roundData.actualValue, tier: gameState.accuracyTier, round: gameState.currentRound + 1 })`
   - After 1000ms delay: show `#reasoning-area` with slide-in animation
   - Set `gameState.phase = 'reasoning'`; `syncDOMState()`
   - `gameState.isProcessing = false`

6. **handleReasoningSubmit()** — kid taps "Submit Reasoning":
   - Guard: `if (!gameState.isActive || gameState.isProcessing) return`
   - `gameState.isProcessing = true`
   - Read `reasoning = document.getElementById('reasoning-input').value.trim()`
   - If `reasoning.length < 5`: show inline error "Please write at least a few words about your thinking", `gameState.isProcessing = false`, return
   - `gameState.reasoningText = reasoning`
   - Set `gameState.phase = 'evaluating'`; `syncDOMState()`
   - Disable `#btn-submit-reasoning`, change text to "Evaluating..."
   - **Wrap the rest in try/finally to ensure isProcessing reset (PART-015 pattern):**
   - **try:**
     - **LLM Evaluation (PART-015):**
       ```javascript
       const result = await validateAnswerLLM(
         reasoning,
         gameState.roundData.scenario.question + ' (The student estimated: ' + gameState.estimateAnswer + ')',
         gameState.roundData.rubric
       );
       gameState.reasoningScore = result.correct ? 1 : 0;
       ```
     - **Calculate round points:**
       ```javascript
       let accuracyPts = 0;
       if (gameState.accuracyTier === 'spot-on') accuracyPts = 2;
       else if (gameState.accuracyTier === 'close') accuracyPts = 1;
       const roundPoints = accuracyPts + gameState.reasoningScore;
       gameState.totalPoints += roundPoints;
       gameState.accuracyPoints += accuracyPts;
       gameState.reasoningPoints += gameState.reasoningScore;
       ```
     - `trackEvent('reasoning_evaluated', 'game', { reasoning, reasoningScore: gameState.reasoningScore, feedback: result.feedback, roundPoints, round: gameState.currentRound + 1 })`
     - **Show full feedback area:**
       - `#feedback-estimate`: kid's estimate + tier emoji
       - `#feedback-actual`: actual value + unit
       - `#feedback-reasoning`: LLM feedback text (result.feedback)
       - `#feedback-points`: `${roundPoints}/3 points`
       - If `gameState.reasoningScore === 0`: show `#feedback-hint` with `roundData.hints.strategyHint`
     - Hide `#estimate-area`, `#reasoning-area`, `#accuracy-feedback`
     - Show `#feedback-area`
     - Show `#btn-next-round` (kid taps this when ready to proceed)
     - Record feedback display view event:
       ```javascript
       if (signalCollector) {
         signalCollector.recordViewEvent('feedback_display', {
           screen: 'gameplay',
           content_snapshot: {
             feedback_type: 'reasoning_result',
             reasoning_score: gameState.reasoningScore,
             round_points: roundPoints,
             llm_feedback: result.feedback,
             round: gameState.currentRound + 1,
             trigger: 'user_action'
           }
         });
       }
       ```
     - **Play dynamic TTS with reveal explanation:**
       ```javascript
       try {
         await FeedbackManager.playDynamicFeedback({
           audio_content: gameState.roundData.hints.revealExplanation,
           subtitle: gameState.roundData.hints.revealExplanation
         });
       } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
       ```
     - Record attempt:
       ```javascript
       recordAttempt({
         input_of_user: { estimate: gameState.estimateAnswer, reasoning: gameState.reasoningText },
         correct: gameState.accuracyTier === 'spot-on' && gameState.reasoningScore === 1,
         metadata: {
           round: gameState.currentRound + 1,
           question: gameState.roundData.scenario.question,
           correctAnswer: gameState.roundData.actualValue,
           accuracyTier: gameState.accuracyTier,
           reasoningScore: gameState.reasoningScore,
           roundPoints: roundPoints,
           validationType: 'hybrid',
           llmFeedback: result.feedback
         }
       });
       ```
     - Record round outcome:
       ```javascript
       if (signalCollector) {
         signalCollector.recordCustomEvent('round_solved', {
           correct: gameState.accuracyTier !== 'far-off',
           round: gameState.currentRound + 1,
           accuracyTier: gameState.accuracyTier,
           reasoningScore: gameState.reasoningScore,
           roundPoints: roundPoints
         });
       }
       ```
     - Set `gameState.phase = 'feedback'`; `syncDOMState()`
   - **finally:**
     - Re-enable `#btn-submit-reasoning`, change text back to "Submit Reasoning"
     - `gameState.isProcessing = false`

7. **handleNextRound()** — kid taps "Next Round →":
   - Hide `#btn-next-round`
   - Call `nextRound()`

8. **nextRound()**:
   - `gameState.currentRound++`
   - `progressBar.update(gameState.currentRound, 0)`
   - `trackEvent('round_complete', 'game', { round: gameState.currentRound })`
   - If `gameState.currentRound >= gameState.totalRounds` → `endGame()`
   - Else:
     - Check stage transition: `const nextStage = gameState.content.rounds[gameState.currentRound].stage`
     - Record screen transition:
       ```javascript
       if (signalCollector) {
         signalCollector.recordViewEvent('screen_transition', {
           screen: nextStage !== gameState.currentStage ? 'stage_transition' : 'gameplay',
           metadata: { transition_from: 'gameplay' }
         });
       }
       ```
     - If stage changed:
       ```javascript
       const stageNames = { 1: 'Small Counts', 2: 'Bigger Groups', 3: 'Tricky Arrangements' };
       const stageDescs = { 1: 'Neatly arranged items — count and estimate!', 2: 'Scattered items and larger numbers — time for strategies!', 3: 'Patterns, distractors, and big crowds — think before you count!' };
       transitionScreen.show({
         icons: ['🔍'],
         iconSize: 'normal',
         title: `Stage ${nextStage}: ${stageNames[nextStage]}`,
         subtitle: stageDescs[nextStage],
         buttons: [{ text: 'Continue', type: 'primary', action: () => { setupRound(); } }]
       });
       ```
     - Else: `setupRound()`

9. **endGame()** (all 10 rounds completed):
   - Guard: `if (gameState.gameEnded) return`; `gameState.gameEnded = true`; `gameState.isActive = false`
   - Set `gameState.phase = 'results'`; `syncDOMState()`
   - `gameState.duration_data.currentTime = new Date().toISOString()`
   - Calculate stars and metrics:
     ```javascript
     const timeTaken = Math.round((Date.now() - gameState.startTime) / 1000);
     const accuracy = gameState.totalRounds > 0 ? Math.round((gameState.accuracyPoints / (gameState.totalRounds * 2)) * 100) : 0;
     let stars = 1;
     if (gameState.totalPoints >= 24) stars = 3;
     else if (gameState.totalPoints >= 15) stars = 2;

     const metrics = {
       accuracy,
       time: timeTaken,
       stars,
       attempts: gameState.attempts,
       duration_data: gameState.duration_data,
       totalLives: 1,  // No lives in this game — default 1 per PART-011
       tries: computeTriesPerRound(gameState.attempts),
       totalPoints: gameState.totalPoints,
       accuracyPoints: gameState.accuracyPoints,
       reasoningPoints: gameState.reasoningPoints
     };

     // Track session history for restart
     if (gameState.sessionHistory.length > 0) {
       metrics.sessionHistory = [
         ...gameState.sessionHistory,
         { totalLives: 1, tries: computeTriesPerRound(gameState.attempts) }
       ];
     }
     ```
   - End-game TTS with trophy:
     ```javascript
     try {
       await FeedbackManager.playDynamicFeedback({
         audio_content: `You scored ${gameState.totalPoints} out of 30 points! Your accuracy earned ${gameState.accuracyPoints} points and your reasoning earned ${gameState.reasoningPoints} points!`,
         subtitle: `${gameState.totalPoints}/30 points — ${stars} stars!`,
         sticker: { url: 'https://cdn.mathai.ai/mathai-assets/lottie/trophy.json', type: 'Lottie' }
       });
     } catch(e) { console.error('Feedback error:', JSON.stringify({ error: e.message }, null, 2)); }
     ```
   - Seal SignalCollector: `if (signalCollector) signalCollector.seal()`
   - Update results screen:
     ```javascript
     document.getElementById('result-points').textContent = `${gameState.totalPoints}/30`;
     document.getElementById('result-accuracy').textContent = `${gameState.accuracyPoints}/20`;
     document.getElementById('result-reasoning').textContent = `${gameState.reasoningPoints}/10`;
     const starsDisplay = document.getElementById('stars-display');
     starsDisplay.innerHTML = Array(3).fill(0).map((_, i) => `<span class="${i < stars ? 'star-filled' : 'star-empty'}">${i < stars ? '⭐' : '☆'}</span>`).join('');
     ```
   - Show `#results-screen`, hide `#game-screen`
   - Send postMessage (PART-011 v3 format — type `game_complete`, no signal data):
     ```javascript
     console.log('Final Metrics:', JSON.stringify(metrics, null, 2));
     console.log('Attempt History:', JSON.stringify(gameState.attempts, null, 2));

     window.parent.postMessage({
       type: 'game_complete',
       data: {
         metrics,
         attempts: gameState.attempts,
         completedAt: Date.now()
       }
     }, '*');
     ```
   - `trackEvent('game_end', 'game', { metrics })`
   - Cleanup:
     ```javascript
     if (visibilityTracker) { visibilityTracker.destroy(); visibilityTracker = null; }
     FeedbackManager.sound.stopAll();
     FeedbackManager.stream.stopAll();
     ```

10. **restartGame()** — Full reset:
   - Save session history before reset:
     ```javascript
     gameState.sessionHistory.push({
       totalLives: 1,
       tries: computeTriesPerRound(gameState.attempts)
     });
     const savedSessionHistory = [...gameState.sessionHistory];
     const savedContentSetId = gameState.contentSetId;
     const savedSignalConfig = gameState.signalConfig;
     const savedContent = gameState.content;
     ```
   - Reset all gameState fields to defaults (`currentRound=0, totalPoints=0, accuracyPoints=0, reasoningPoints=0`, etc.)
   - Restore preserved state:
     ```javascript
     gameState.sessionHistory = savedSessionHistory;
     gameState.contentSetId = savedContentSetId;
     gameState.signalConfig = savedSignalConfig;
     gameState.content = savedContent;
     ```
   - `gameState.phase = 'start'`; `syncDOMState()`
   - Recreate SignalCollector:
     ```javascript
     signalCollector = new SignalCollector({
       sessionId: window.gameVariableState?.sessionId || 'session_' + Date.now(),
       studentId: window.gameVariableState?.studentId || null,
       gameId: gameState.gameId || null,
       contentSetId: gameState.contentSetId || null
     });
     window.signalCollector = signalCollector;

     // Re-configure flushing if signalConfig available
     if (gameState.signalConfig) {
       if (gameState.signalConfig.flushUrl) signalCollector.flushUrl = gameState.signalConfig.flushUrl;
       if (gameState.signalConfig.playId) signalCollector.playId = gameState.signalConfig.playId;
       if (gameState.signalConfig.sessionId) signalCollector.sessionId = gameState.signalConfig.sessionId;
       if (gameState.signalConfig.studentId) signalCollector.studentId = gameState.signalConfig.studentId;
       signalCollector.startFlushing();
     }
     ```
   - Recreate VisibilityTracker:
     ```javascript
     visibilityTracker = new VisibilityTracker({
       onInactive: () => {
         const inactiveStart = Date.now();
         gameState.duration_data.inActiveTime.push({ start: inactiveStart });
         if (signalCollector) {
           signalCollector.pause();
           signalCollector.recordCustomEvent('visibility_hidden', {});
         }
         FeedbackManager.sound.pause();
         FeedbackManager.stream.pauseAll();
         trackEvent('game_paused', 'system');
       },
       onResume: () => {
         const lastInactive = gameState.duration_data.inActiveTime[gameState.duration_data.inActiveTime.length - 1];
         if (lastInactive && !lastInactive.end) {
           lastInactive.end = Date.now();
           gameState.duration_data.totalInactiveTime += (lastInactive.end - lastInactive.start);
         }
         if (signalCollector) {
           signalCollector.resume();
           signalCollector.recordCustomEvent('visibility_visible', {});
         }
         FeedbackManager.sound.resume();
         FeedbackManager.stream.resumeAll();
         trackEvent('game_resumed', 'system');
       },
       popupProps: {
         title: 'Game Paused',
         description: 'Click Resume to continue.',
         primaryText: 'Resume'
       }
     });
     ```
   - `progressBar = new ProgressBarComponent({ autoInject: true, totalRounds: 10, totalLives: 0, slotId: 'mathai-progress-slot' })`
   - `progressBar.update(0, 0)`
   - Show start transition screen:
     ```javascript
     transitionScreen.show({
       icons: ['🔍'],
       iconSize: 'large',
       title: 'Estimate It!',
       subtitle: 'How close can you get? Estimate the count and explain your thinking!',
       buttons: [{ text: "I'm ready!", type: 'primary', action: () => startGame() }]
     });
     ```

---

## 9. Functions

### Global Scope (RULE-001)

**syncDOMState()**
- Set `#app` dataset attributes: `data-phase`, `data-round`, `data-score`, `data-stage`, `data-points`
- Called immediately after every `gameState.phase` assignment

**handlePostMessage(event)** — as described in Flow Step 2

**startGame()** — as described in Flow Step 3

**setupRound()** — as described in Flow Step 4

**async handleEstimateSubmit()** — as described in Flow Step 5

**async handleReasoningSubmit()** — as described in Flow Step 6 (wrapped in try/finally)

**handleNextRound()** — as described in Flow Step 7

**nextRound()** — as described in Flow Step 8

**async endGame()** — as described in Flow Step 9

**restartGame()** — as described in Flow Step 10

**computeTriesPerRound(attempts)** — PART-011 v3 helper:
```javascript
function computeTriesPerRound(attempts) {
  var rounds = {};
  attempts.forEach(function(a) {
    var r = a.metadata.round;
    rounds[r] = (rounds[r] || 0) + 1;
  });
  return Object.keys(rounds).map(function(r) {
    return { round: Number(r), triesCount: rounds[r] };
  });
}
```

**async validateAnswerLLM(userAnswer, question, rubric)** — PART-015:
```javascript
async function validateAnswerLLM(userAnswer, question, rubric) {
  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [
        {
          component_id: 'q_' + gameState.currentRound,
          evaluation_prompt: `Question: "${question}"\nStudent's reasoning: "${userAnswer}"\nRubric: ${rubric}\n\nEvaluate whether the student's reasoning demonstrates a deliberate estimation strategy (not just random guessing). The answer can be wrong — focus on whether the REASONING shows thoughtful strategy.\n\nIMPORTANT: Begin your evaluation with exactly one of these verdicts:\n- "GOOD_REASONING:" if the student shows a deliberate strategy\n- "WEAK_REASONING:" if the student just guessed or gave an incoherent answer\n\nThen explain your evaluation.`,
          feedback_prompt: 'Based on {{evaluation}}, provide a short (1-2 sentence) encouraging feedback for the student about their reasoning approach. If the reasoning was weak, gently suggest a better strategy.'
        }
      ],
      timeout: 30000
    });

    const componentResult = result.data[0];
    const evalText = (componentResult.evaluation || '').trim();
    const isGoodReasoning = evalText.startsWith('GOOD_REASONING');

    return {
      correct: isGoodReasoning,
      evaluation: componentResult.evaluation,
      feedback: componentResult.feedback || ''
    };
  } catch (error) {
    console.error('LLM validation error:', JSON.stringify({ error: error.message }, null, 2));
    return { correct: false, evaluation: '', feedback: 'We couldn\'t evaluate your reasoning this time. Keep using strategies!' };
  }
}
```

---

## 10. Feedback Integration (PART-017)

### Audio Preload

```
correct_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501597903.mp3
wrong_tap: https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757501956470.mp3
```

### Stickers

```
correct: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-30.gif (IMAGE_GIF)
incorrect: https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1757512958230-49.gif (IMAGE_GIF)
trophy: https://cdn.mathai.ai/mathai-assets/lottie/trophy.json (Lottie)
```

### Audio Flow per Interaction

- **Estimate submit — spot-on:** `await FeedbackManager.sound.play('correct_tap', { subtitle: '🎯 Spot on!', sticker: CORRECT_STICKER })`
- **Estimate submit — close:** `await FeedbackManager.sound.play('correct_tap', { subtitle: '👍 Really close!', sticker: CORRECT_STICKER })`
- **Estimate submit — far off:** `await FeedbackManager.sound.play('wrong_tap', { subtitle: '📐 A bit off — let\'s see why.', sticker: INCORRECT_STICKER })`
- **Reasoning evaluated + reveal:** `await FeedbackManager.playDynamicFeedback()` with `revealExplanation` as TTS — walks through the best strategy
- **End game:** `await FeedbackManager.playDynamicFeedback()` with trophy sticker — announces total points and breakdown

---

## 11. Audio Sequence Table

| # | Moment | Trigger | Audio Type | Content / Sound ID | Await? | Notes |
|---|--------|---------|------------|--------------------|--------|-------|
| 1 | Estimate submitted — spot-on | handleEstimateSubmit (spot-on) | Static + Sticker | `await FeedbackManager.sound.play('correct_tap')` + correct sticker | ✅ Awaited | 🎯 badge shown; blocks until sound ends |
| 2 | Estimate submitted — close | handleEstimateSubmit (close) | Static + Sticker | `await FeedbackManager.sound.play('correct_tap')` + correct sticker | ✅ Awaited | 👍 badge shown |
| 3 | Estimate submitted — far off | handleEstimateSubmit (far-off) | Static + Sticker | `await FeedbackManager.sound.play('wrong_tap')` + incorrect sticker | ✅ Awaited | 📐 badge shown |
| 4 | Reveal explanation | After reasoning evaluated | Dynamic TTS | `await FeedbackManager.playDynamicFeedback()` with revealExplanation | ✅ Awaited* | Walks through best strategy; streaming may resolve early |
| 5 | Game end | endGame() | Dynamic TTS + Sticker | `await FeedbackManager.playDynamicFeedback()` + trophy sticker | ✅ Awaited* | Points breakdown TTS; streaming may resolve early |

**Notes:**
- Rows 1-3 and 4 are never sequential within the same handler — estimate audio plays in handleEstimateSubmit, reveal TTS plays later in handleReasoningSubmit.
- No overlapping audio risk — each audio moment is in a separate handler guarded by `isProcessing`.
- Ambient SFX (scenario reveal, slide-in, round transition) are intentionally omitted from preload — they are optional CSS animation accompaniments, not preloaded audio. The generator may add them if desired but they are not required.

---

## 12. Review Findings

- **Info — First LLM-validated game:** This is the first game using PART-015 (LLM Subjective Evaluation) for reasoning assessment. The LLM evaluates whether the kid demonstrates a deliberate strategy — the answer itself (accuracy) is evaluated deterministically via PART-014.

- **Info — Hybrid validation:** Each round uses TWO validation systems: deterministic accuracy checking (PART-014) for the numerical estimate, and LLM evaluation (PART-015) for the reasoning text. This is reflected in the `validationType: 'hybrid'` in attempt records.

- **Info — No lives:** This game uses no lives (totalLives: 0, reported as 1 per PART-011 convention). The ProgressBar shows round progress only. The scoring system (points, not lives) encourages exploration and risk-taking with estimates.

- **Info — Evaluation loading state:** When the LLM evaluates reasoning, the Submit button is disabled and shows "Evaluating..." text. This prevents double-submission and gives visual feedback that processing is happening. The button is re-enabled on both success and error via try/finally (PART-015 rules).

- **Warning — LLM latency:** The `validateAnswerLLM` call may take 2-10 seconds depending on API load. The 30-second timeout in PART-015 covers worst-case scenarios. If the API fails, a graceful fallback message is shown and the kid gets 0 reasoning points (no crash).

- **Info — Emoji layout rendering:** The `emojiLayout` field uses monospace rendering (`font-family: 'Courier New'`) with `white-space: pre` to preserve spatial arrangement. Content creators MUST verify emoji counts match `actualValue` exactly — programmatically count non-space, non-distractor emojis and assert equality.

- **Info — Scoring transparency:** The kid sees their points breakdown after each round (accuracy + reasoning) and in the final results screen (accuracy total / reasoning total / combined). This helps them understand that BOTH good estimation AND good thinking are valued.

- **Info — User-paced feedback:** After reasoning is evaluated, the kid sees the full feedback card and taps "Next Round →" when ready. No auto-advance timer — the kid controls the pace, which is important since the feedback contains the LLM reasoning evaluation, strategy hint, and TTS reveal explanation.

- **Info — SignalCollector v3 compliance:** Uses `recordViewEvent()` for content_render, screen_transition, and feedback_display. Uses `recordCustomEvent()` for round_solved and visibility events. Calls `startFlushing()` after game_init, `seal()` in endGame. No deprecated v2 methods (startProblem/endProblem). PostMessage uses `game_complete` type with PART-011 v3 metrics format including `tries` and `totalLives`.

- **Info — Stage 1 counting vs estimation:** Stage 1 rounds have small enough counts (12-19) that exact counting is possible. The rubrics explicitly accept "I counted them all" as a valid strategy for these rounds, but the revealExplanation models the faster estimation strategy (rows × columns) so kids learn the pattern even when brute-force works.
