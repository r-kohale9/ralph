# Adjust to Add — Game-Specific Template (Assembly Book)

> **SELF-CONTAINED TEMPLATE:** An LLM reading ONLY this file should produce a working HTML file. All architecture details, component initialization, fallback content, and constraints are specified here.

> **PART-017 EXCLUDED:** Do NOT call `FeedbackManager.init()` — calling it triggers an audio permission popup that causes test flakiness. Visual-only feedback is used throughout this game.

> **window.gameState REQUIRED:** `window.gameState = gameState` must appear at the bottom of the gameState declaration block. The test harness reads `window.gameState` to sync `data-phase`, `data-lives`, and `data-score` on `#app`.

> **window functions REQUIRED:** `window.endGame`, `window.restartGame`, `window.nextRound` must be assigned inside `DOMContentLoaded` after their function definitions. Test harness calls these directly.

> **PEDAGOGICAL DESIGN NOTE:**
> Adjust to Add targets Bloom Level 2 (Understanding) and Level 3 (Application) of the **compensation strategy** for Grade 5–6 mental addition (NCERT Class 5–6, Number Operations). The game operationalises the core research finding that flexible mental calculators actively re-represent addends to exploit place-value structure (Threlfall, 2002), while rigid calculators apply a fixed algorithm regardless of number features (Heirdsfield & Cooper, 2004). By requiring students to physically adjust addends using ±1 buttons before committing an answer, the game makes the compensation insight kinesthetically salient: *changing one number forces a compensating change in the other to preserve the sum*. Three difficulty tiers progress from near-decade 2-digit pairs (e.g. 47+33 → 50+30) through mid-range 2-digit pairs (e.g. 46+54 → 50+50) to 3-digit numbers (e.g. 248+152 → 250+150), matching the Grade 5–6 curriculum trajectory.
>
> **Research Sources:**
> - Source A: Heirdsfield, A. M. & Cooper, T. J. (2004). "Factors affecting the process of proficient mental addition and subtraction." *Journal of Mathematical Behavior*, 23(4), 443–463. Key finding: "proficient mental calculators use compensation strategies; rigid calculators do not adjust representations before computing." ~120 Grade 4–6 students. URL: https://doi.org/10.1016/j.jmathb.2004.09.005
> - Source B: Threlfall, J. (2002). "Flexible Mental Calculation." *Educational Studies in Mathematics*, 50(1), 29–47. Key finding: "mental calculation is not rule-following but opportunistic — the choice of strategy depends on number features perceived in the moment." URL: https://doi.org/10.1023/A:1020572803061
> - Source C: NCERT *Mathematics Grade 5 — Math Magic*, Chapter 7 (Pattern recognition and mental operations, pp. 84–97). Aligned: estimation, rounding to nearest 10, place-value regrouping for mental addition.

## Section 1: Game Identity

- **Title:** Adjust to Add
- **Game ID:** `adjust-to-add`
- **Type:** standard
- **Description:** Students are shown two addends with individual ±1 adjustment buttons. They reshape the addends into friendlier numbers (e.g. 47+33 → 50+30) using the compensation strategy, then type the original sum. Nine rounds across three difficulty tiers — near-decade 2-digit pairs (Tier 1, rounds 1–3), mid-range 2-digit pairs (Tier 2, rounds 4–6), and 3-digit numbers (Tier 3, rounds 7–9) — with 3 lives. Wrong answers cost one life; adjusted numbers are visual aids only; validation is always against the original sum. Prerequisite: basic 2-digit addition (Grade 4).

---

## Section 2: Parts Selected

| Part ID | Name | Included | Config / Notes |
|---------|------|----------|----------------|
| PART-001 | HTML Shell | YES | Standard `<!DOCTYPE html>`, `<meta charset="UTF-8">`, viewport, `<div id="app" data-phase="start_screen" data-lives="3" data-score="0">` |
| PART-002 | Package Scripts | YES | Load order (non-negotiable): feedback-manager → components → helpers |
| PART-003 | waitForPackages | YES | Poll for: `FeedbackManager`, `VisibilityTracker`, `ProgressBarComponent`, `TransitionScreenComponent`, `ScreenLayout`; 10 s timeout |
| PART-004 | Initialization Block | YES | `DOMContentLoaded` → `waitForPackages` → inject layout → init components → wire buttons → `window.endGame/restartGame/nextRound` → show start TransitionScreen |
| PART-005 | VisibilityTracker | YES | `new VisibilityTracker({ onInactive, onResume })` — tracks inactive time in `duration_data` |
| PART-006 | TimerComponent | NO | Time pressure contradicts the pedagogical goal of developing deliberate compensation strategies |
| PART-007 | Game State Object | YES | Custom fields: `originalNum1`, `originalNum2`, `adjustedNum1`, `adjustedNum2`, `attemptsThisRound`, `wrongFirstAttempt`, `totalFirstAttemptCorrect`, `isProcessing`, `gameEnded` — see Section 3 |
| PART-008 | PostMessage Protocol | YES | Accept `event.data.rounds` → set `gameState.content`; standard `window.parent.postMessage({ type: 'GAME_COMPLETE', gameId, metrics }, '*')` on end |
| PART-009 | Attempt Tracking | YES | `recordAttempt(roundIndex, userAnswer, correct)` — stores round, original nums, adjusted nums, userAnswer, correctAnswer, correct, timestamp |
| PART-010 | Event Tracking | YES | Custom events: `adjustment_made` (fields: `which` 1/2, `direction` +1/-1, `newValue`); `answer_submitted` (fields: `userAnswer`, `correctAnswer`, `isCorrect`); `round_complete` (fields: `roundNumber`, `firstAttemptCorrect` bool) |
| PART-011 | End Game & Metrics | YES | Stars: `totalFirstAttemptCorrect >= 8` → 3, `>= 6` → 2, else 1. Posts `GAME_COMPLETE` with score, lives, firstAttemptCorrect, stars, duration, completed |
| PART-012 | Debug Functions | YES | Standard `console.log` guards |
| PART-013 | Validation Fixed | YES | `parseInt(userInput, 10) === (originalNum1 + originalNum2)` — deterministic numeric equality |
| PART-014 | Validation Function | NO | Not needed — answer is always a fixed integer |
| PART-015 | Validation LLM | NO | Not needed |
| PART-016 | StoriesComponent | NO | Not a narrative game |
| PART-017 | FeedbackManager | NO | Calling `FeedbackManager.init()` triggers an audio permission popup causing test flakiness. No init call; no sound registration. |
| PART-018 | Case Converter | NO | Not needed |
| PART-019 | Results Screen UI | YES | Via `TransitionScreenComponent.show(...)` with win/loss title, first-attempt-correct count, star icons, Play Again button |
| PART-020 | CSS Variables & Colors | YES | `--primary: #4A90D9`, `--success: #27AE60`, `--error: #E74C3C`, `--neutral: #F5F5F5`, `--adjust-btn: #7B68EE`, `--text: #2C3E50` |
| PART-021 | Screen Layout CSS | YES | Flex column, full-height `#app`, centred `#gameContent` |
| PART-022 | Game Buttons | YES | `.adj-btn` (44 × 44 px circles, `--adjust-btn` fill) for ±1; `.submit-btn` (full-width, `--primary` fill) |
| PART-023 | ProgressBarComponent | YES | `new ProgressBarComponent({ autoInject: true, totalRounds: 9, totalLives: 3, slotId: 'mathai-progress-slot' })` |
| PART-024 | TransitionScreen Component | YES | `new TransitionScreenComponent({ autoInject: true })` — used for start screen and results screen |
| PART-025 | ScreenLayout Component | YES | `ScreenLayout.inject('app', { slots: { progressBar: true, transitionScreen: true } })` then clone `#game-template` into `#gameContent` |
| PART-026 | Anti-Patterns | YES | REFERENCE — no `setTimeout` for state transitions, no direct DOM mutation bypassing gameState, `isProcessing` guard on every submit, `gameEnded` guard in `endGame()` |
| PART-027 | Play Area Construction | YES | Custom: two `.number-card` columns each with large `.number-display` + `.adj-buttons` ([+] [−]); centred `+` sign between; `.answer-section` below with `<input type="number">` + Submit button + feedback div |
| PART-028 | InputSchema Patterns | YES | External content via postMessage; fallback in Section 4 |
| PART-034 | Variable Schema Serialization | YES | POST_GEN |
| PART-035 | Test Plan Generation | YES | POST_GEN |
| PART-037 | Playwright Testing | YES | POST_GEN |

---

## Section 3: Game State

```javascript
const gameState = {
  gameId: 'adjust-to-add',          // MUST be first field
  phase: 'start_screen',
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
  // Game-specific fields
  originalNum1: 0,               // Unmodified first addend from content (used for correct answer)
  originalNum2: 0,               // Unmodified second addend from content
  adjustedNum1: 0,               // Player-adjusted display value of num1
  adjustedNum2: 0,               // Player-adjusted display value of num2
  attemptsThisRound: 0,          // Attempt count for current round (reset on loadRound)
  wrongFirstAttempt: false,      // True if first attempt on current round was incorrect
  totalFirstAttemptCorrect: 0,   // Running count of rounds answered correctly on first attempt
  isProcessing: false,           // Submission guard — set true on submit, false after feedback
  gameEnded: false               // End guard — set true inside endGame(), blocks all mutations after
};

window.gameState = gameState;

let visibilityTracker = null;
let progressBar = null;
let transitionScreen = null;
```

**Lives system:** Each wrong `answer_submitted` deducts one life (`gameState.lives--`). `isProcessing` is set `true` on submit and `false` after feedback completes (prevents rapid re-submit). On a wrong answer with lives remaining, a hint is shown and the input is cleared for retry — **the round is not advanced**; the student retries until correct or runs out of lives. `gameEnded` is set `true` inside `endGame()` — no state mutations occur after that point. Game ends immediately when `lives === 0` (loss) or all 9 rounds complete (win). Stars: `totalFirstAttemptCorrect >= 8` → 3 stars; `>= 6` → 2 stars; completed → 1 star.

---

## Section 4: Input Schema (External Variables)

```json
{
  "type": "object",
  "properties": {
    "rounds": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "num1": {
            "type": "integer",
            "minimum": 1,
            "description": "First addend shown to the student"
          },
          "num2": {
            "type": "integer",
            "minimum": 1,
            "description": "Second addend shown to the student"
          },
          "difficulty": {
            "type": "integer",
            "enum": [1, 2, 3],
            "description": "1=near-decade 2-digit (num1 or num2 within 3 of a multiple of 10), 2=mid-range 2-digit (within 4-6 of a multiple of 10), 3=3-digit numbers (within 5 of a multiple of 100 or 50)"
          },
          "hint": {
            "type": "string",
            "maxLength": 120,
            "description": "Shown after a wrong first attempt. Must name the specific adjustment direction. Max 20 words."
          },
          "misconceptionTag": {
            "type": "string",
            "enum": ["sum-invariance", "both-round-up", "no-strategy", "M-none"],
            "description": "sum-invariance=student adds same delta to both numbers; both-round-up=student rounds both in same direction; no-strategy=student computes directly without adjusting; M-none=no specific misconception targeted"
          }
        },
        "required": ["num1", "num2", "difficulty", "hint", "misconceptionTag"]
      },
      "minItems": 9,
      "maxItems": 9,
      "description": "Exactly 9 rounds: 3 × Tier 1 (difficulty=1), 3 × Tier 2 (difficulty=2), 3 × Tier 3 (difficulty=3). Delivered in order Tier 1 → Tier 2 → Tier 3. num1+num2 MUST be a multiple of 10 or 100 for clean mental arithmetic. No two consecutive rounds with the same misconceptionTag. Each tier must include at least one 'sum-invariance' round."
    }
  },
  "required": ["rounds"]
}
```

**Fallback content:**

```javascript
const fallbackContent = {
  rounds: [
    // ============================================================
    // ROUND 1 [Tier 1] — near-decade, sum-invariance
    // 47 + 33 = 80. Natural adjustment: 47→50 (+3), 33→30 (−3).
    // Misconception: student adds 3 to both → gets 50+36=86 (wrong).
    // NCERT Grade 5 Math Magic p.14: near-decade addition patterns.
    // ============================================================
    {
      num1: 47, num2: 33, difficulty: 1,
      hint: "Round 47 up to 50. If 47 goes up by 3, what must happen to 33?",
      misconceptionTag: "sum-invariance"
    },
    // ============================================================
    // ROUND 2 [Tier 1] — near-decade, both-round-up
    // 38 + 22 = 60. Natural: 38→40 (+2), 22→20 (−2).
    // Misconception: both-round-up → student tries 40+30=70 (wrong).
    // ============================================================
    {
      num1: 38, num2: 22, difficulty: 1,
      hint: "Round 38 up to 40. Does 22 go up or down to keep the total the same?",
      misconceptionTag: "both-round-up"
    },
    // ============================================================
    // ROUND 3 [Tier 1] — near-decade, M-none
    // 29 + 41 = 70. Natural: 29→30 (+1), 41→40 (−1).
    // Clean compensation, no strong misconception targeted.
    // ============================================================
    {
      num1: 29, num2: 41, difficulty: 1,
      hint: "29 is very close to 30. If 29 goes up to 30, what should 41 become?",
      misconceptionTag: "M-none"
    },
    // ============================================================
    // ROUND 4 [Tier 2] — mid-range 2-digit, sum-invariance
    // 46 + 54 = 100. Natural: 46→50 (+4), 54→50 (−4).
    // Misconception: adds 4 to both → 50+58=108 (wrong).
    // ============================================================
    {
      num1: 46, num2: 54, difficulty: 2,
      hint: "46 is 4 away from 50. If 46 goes up by 4, what must 54 do?",
      misconceptionTag: "sum-invariance"
    },
    // ============================================================
    // ROUND 5 [Tier 2] — mid-range 2-digit, no-strategy
    // 57 + 43 = 100. Natural: move 3 from 43 to 57 → 60+40.
    // Misconception: no-strategy — computes 57+43 directly.
    // ============================================================
    {
      num1: 57, num2: 43, difficulty: 2,
      hint: "Move 3 from 43 to 57. What do you get? Now the addition is easy!",
      misconceptionTag: "no-strategy"
    },
    // ============================================================
    // ROUND 6 [Tier 2] — mid-range 2-digit, both-round-up
    // 64 + 36 = 100. Natural: 64→60 (−4), 36→40 (+4).
    // Misconception: both-round-up → 70+40=110 (wrong).
    // ============================================================
    {
      num1: 64, num2: 36, difficulty: 2,
      hint: "64 rounds DOWN to 60. Which way must 36 move to compensate?",
      misconceptionTag: "both-round-up"
    },
    // ============================================================
    // ROUND 7 [Tier 3] — 3-digit, sum-invariance
    // 248 + 152 = 400. Natural: 248→250 (+2), 152→150 (−2).
    // Misconception: adds 2 to both → 250+154=404 (wrong).
    // ============================================================
    {
      num1: 248, num2: 152, difficulty: 3,
      hint: "248 is 2 away from 250. If 248 goes up by 2, what must happen to 152?",
      misconceptionTag: "sum-invariance"
    },
    // ============================================================
    // ROUND 8 [Tier 3] — 3-digit, no-strategy
    // 197 + 303 = 500. Natural: 197→200 (+3), 303→300 (−3).
    // Misconception: no-strategy — student adds directly.
    // ============================================================
    {
      num1: 197, num2: 303, difficulty: 3,
      hint: "197 is just 3 away from 200. If it goes up to 200, what must 303 become?",
      misconceptionTag: "no-strategy"
    },
    // ============================================================
    // ROUND 9 [Tier 3] — 3-digit, M-none
    // 396 + 104 = 500. Natural: 396→400 (+4), 104→100 (−4).
    // No specific misconception — confident application of strategy.
    // ============================================================
    {
      num1: 396, num2: 104, difficulty: 3,
      hint: "396 is 4 away from 400. If it goes up to 400, what should 104 become?",
      misconceptionTag: "M-none"
    }
  ]
};
```
