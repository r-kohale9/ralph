# Pre-Generation Plan: Add List with Adjustment Strategy

## Archetype confirmation

- **Archetype:** **Construction (#7)** — confirmed.
- Rationale: student builds a simpler addition expression by tapping per-addend +/- buttons, types the final sum, and submits. Reset + Submit + Validate is the canonical Construction loop. Not MCQ, not pure Input, not Sort/Classify.

## Screens

| # | Screen | Component | Trigger | Dismissal |
|---|--------|-----------|---------|-----------|
| 1 | Preview | PreviewScreenComponent | `setupGame()` | Preview `onComplete` → `startGameAfterPreview` |
| 2 | Round N Intro (N=1..9) | TransitionScreenComponent | `showRoundIntro(N)` | `onMounted` plays `rounds_sound_effect`, auto-hide, enter gameplay |
| 3 | Gameplay | bare DOM inside `#gameContent` | `renderRound()` | student taps Next Round / presses Enter |
| 4 | Victory | TransitionScreenComponent (`stars`) | `showVictory()` (round 9 correct) | `Claim Stars` → `showStarsCollected` or `Play Again` → `showMotivation` |
| 5 | Game Over | TransitionScreenComponent (`icons: ['💔']`) | `showGameOver()` (lives hit 0) | `Try Again` → `restartGame` |
| 6 | Ready to improve your score? (Motivation) | TransitionScreenComponent | from Victory `Play Again` OR Game Over `Try Again` | `I'm ready!` → `restartGame` |
| 7 | Yay stars collected! | TransitionScreenComponent | from Victory `Claim Stars` | auto-dismiss 2500ms → `game_exit` + `endGame(true)` |

## Gameplay DOM layout (inside `#gameContent`)

```
#gameContent
├── .als-header-row              (timer row is owned by ScreenLayout; we do NOT duplicate)
├── #sumWorkspace
│   ├── .als-workspace-row       flex row
│   │   ├── .als-cell[data-cell="a"]
│   │   │   ├── .als-btn.als-btn-minus#btn-a-minus[data-testid="btn-a-minus"]   pink
│   │   │   ├── .als-num#num-a[data-testid="num-a"]                             white box
│   │   │   └── .als-btn.als-btn-plus#btn-a-plus[data-testid="btn-a-plus"]      green
│   │   ├── .als-operator-plus                                                  black "+" glyph
│   │   └── .als-cell[data-cell="b"]
│   │       ├── .als-btn.als-btn-minus#btn-b-minus[data-testid="btn-b-minus"]
│   │       ├── .als-num#num-b[data-testid="num-b"]                             (blue border on R4-6)
│   │       └── .als-btn.als-btn-plus#btn-b-plus[data-testid="btn-b-plus"]
│   ├── .als-reset-row
│   │   └── button#btn-reset[data-testid="btn-reset"]   dark-gray pill "↺ Reset"
│   └── .als-input-row
│       └── input#sum-input[data-testid="sum-input"]    type=text, inputmode=numeric, placeholder="?"
└── .als-submit-row
    └── button#btn-submit[data-testid="btn-submit"]     yellow "Next Round"
```

Notes:
- Input uses `type="text" inputmode="numeric" pattern="[0-9]*"` (NEVER `type="number"` — iOS zoom + inconsistent keyboards). Min font-size 16px on the input to prevent iOS auto-zoom.
- Button minimum 44x44px for touch targets.
- 8px min spacing between cells / buttons (use margins, not flexbox `gap`).
- `als-` prefix chosen to avoid collisions with CDN classes or other shipped games.

## State management plan

### gameState fields (all fields — supersets the defaults from data-contract)

```js
var gameState = {
  gameId: 'add-list-adjustment-strategy',
  phase: 'start_screen',
  currentRound: 0,
  totalRounds: 9,
  score: 0,
  correctAnswer: null,             // set each round from fallbackContent
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  isProcessing: false,
  gameEnded: false,
  content: null,
  stars: 0,
  lives: 3,
  totalLives: 3,
  numberA: 0,                      // current (possibly adjusted) value of cell A
  numberB: 0,
  originalA: 0,                    // round-baseline (never mutates mid-round except by reset)
  originalB: 0,
  deltaA: 0,
  deltaB: 0,
  wrongAttempts: 0,                // cumulative across entire game
  roundStartTime: null,
  levelStartTime: null,
  levelTimes: [],                  // ms per 3-round level
  responseTimes: [],
  roundsCompleted: 0,
  previewResult: null,
  duration_data: { startTime: null, preview: [], attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0 }
};
window.gameState = gameState;
```

### Phases
- `start_screen` — pre-init / preview / welcome.
- `round_intro` — transition screen between rounds.
- `gameplay` — cells + input are interactive.
- `feedback_correct` / `feedback_wrong` — during awaited audio.
- `results` — victory / game-over / motivation / stars-collected.

## Flow code sketch

```js
// ADJUST cell A by delta (+1 or -1)
function adjustCell(cellKey, delta) {
  if (!gameState.isActive || gameState.isProcessing) return;
  if (cellKey === 'a') { gameState.numberA += delta; gameState.deltaA += delta; }
  else                  { gameState.numberB += delta; gameState.deltaB += delta; }
  updateCellDisplays();
  trackEvent('adjust_number', { cell: cellKey, delta: delta, numberA: gameState.numberA, numberB: gameState.numberB });
  safePlaySound('tap_sound', {});  // fire-and-forget
}

// RESET — restore addends to round baseline
function resetAdjustments() {
  if (!gameState.isActive || gameState.isProcessing) return;
  gameState.numberA = gameState.originalA;
  gameState.numberB = gameState.originalB;
  gameState.deltaA = 0; gameState.deltaB = 0;
  var input = document.getElementById('sum-input');
  if (input) input.value = '';
  updateCellDisplays();
  updateSubmitDisabled();
  trackEvent('reset_adjustments', {});
  safePlaySound('sound_bubble_deselect', {});
}

// SUBMIT — validate typed sum
async function handleSubmit() {
  if (!gameState.isActive || gameState.isProcessing || gameState.gameEnded) return;
  var input = document.getElementById('sum-input');
  var value = (input && input.value || '').trim();
  if (!value) return;
  var typed = parseInt(value, 10);
  if (isNaN(typed)) return;

  gameState.isProcessing = true;
  try { input.blur(); } catch(e) {}
  var isCorrect = typed === gameState.correctAnswer;

  var responseMs = Date.now() - gameState.roundStartTime;
  gameState.responseTimes.push(responseMs);
  recordAttempt({ ...12 fields... input_of_user: String(typed), correct: isCorrect, correct_answer: gameState.correctAnswer, misconception_tag: isCorrect ? null : deriveMisconception(typed), difficulty_level: round.stage, is_retry: gameState.wrongAttempts > 0 });
  trackEvent('answer_submitted', { round: gameState.currentRound, correct: isCorrect });

  if (isCorrect) {
    gameState.score += 1; gameState.roundsCompleted += 1;
    syncDOM();
    try { progressBar.update(gameState.roundsCompleted, gameState.lives); } catch(e) {}

    // Level time bookkeeping
    if (gameState.currentRound % 3 === 0) {
      gameState.levelTimes.push(Date.now() - gameState.levelStartTime);
      gameState.levelStartTime = null; // set on next round_intro
    }
    try {
      await Promise.all([
        safePlaySound('correct_sound_effect', { sticker: STICKER_CORRECT }),
        new Promise(function(r){ setTimeout(r, 1500); })
      ]);
    } catch(e) {}
    try { FeedbackManager.playDynamicFeedback({ audio_content: roundsContent.feedbackCorrect, subtitle: roundsContent.feedbackCorrect, sticker: STICKER_CORRECT }).catch(function(){}); } catch(e) {}

    advanceAfterCorrect();
  } else {
    gameState.lives -= 1; gameState.wrongAttempts += 1;
    syncDOM();
    try { progressBar.update(gameState.roundsCompleted, Math.max(0, gameState.lives)); } catch(e) {}

    // Shake input
    input.classList.add('input-wrong'); setTimeout(function(){ input.classList.remove('input-wrong'); }, 600);

    try {
      await Promise.all([
        safePlaySound('incorrect_sound_effect', { sticker: STICKER_WRONG }),
        new Promise(function(r){ setTimeout(r, 1500); })
      ]);
    } catch(e) {}

    if (gameState.lives <= 0) {
      // game-over path. Do NOT clear / retry.
      endGame('game_over');
      return;
    }

    try { FeedbackManager.playDynamicFeedback({ audio_content: roundsContent.feedbackWrong, subtitle: roundsContent.feedbackWrong, sticker: STICKER_WRONG }).catch(function(){}); } catch(e) {}

    // Retry: reset addends + input
    resetAdjustments();
    gameState.isProcessing = false;
  }
}
```

## Progress bar lifecycle

| Moment | Call |
|--------|------|
| `setupGame()` / first render | `new ProgressBarComponent({ slotId:'mathai-progress-slot', totalRounds:9, totalLives:3 })`, `show()`, `update(0, 3)` |
| Entering round N intro | `update(roundsCompleted, livesLeft)` (no bump, state driven) |
| Correct submit | `roundsCompleted++` THEN `update(roundsCompleted, livesLeft)` — BEFORE awaited audio |
| Wrong submit, lives remain | `update(roundsCompleted, livesLeft)` — hearts decrement only |
| Wrong submit, lives == 0 | no progress-bar call on game-over entry (Rule 10 of flow-implementation) |
| Victory entry | `update(9, livesLeft)` |
| Restart | `update(0, 3)` |

## Audio URLs

Straight from `alfred/skills/feedback/reference/feedbackmanager-api.md` Standard Audio URLs table (copied verbatim from logic-seat-puzzle):

- `correct_sound_effect`  → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757588479110.mp3`
- `incorrect_sound_effect`→ `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432062452.mp3`
- `rounds_sound_effect`   → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506558124.mp3`
- `victory_sound_effect`  → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506672258.mp3`
- `game_complete_sound_effect` → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757506659491.mp3`
- `tap_sound`             → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432016820.mp3`
- `sound_bubble_select`   → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1758162403784.mp3`
- `sound_bubble_deselect` → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1758712800721.mp3`
- `new_cards`             → `https://cdn.mathai.ai/mathai-assets/dev/home-explore/document/1757432104595.mp3`

Stickers: use the standard set (STICKER_CORRECT / STICKER_WRONG / STICKER_ROUND / STICKER_LEVEL / STICKER_VICTORY / STICKER_GAME_COMPLETE_1/2 / STICKER_RESTART / STICKER_SAD).

## Parts used

| PART | Usage |
|------|-------|
| PART-001 HTML shell | standard viewport + CSS reset |
| PART-003 waitForPackages | wait for CDN |
| PART-005 VisibilityTracker | pause/resume audio + timer |
| PART-006 TimerComponent | count-up from 00:00, format 'min' (mm:ss) |
| PART-007 gameState | with extra fields above |
| PART-008 postMessage (handlePostMessage) | `game_init` → `setupGame()` |
| PART-009 recordAttempt | 12 fields including metadata.{deltaA,deltaB,wrongAttempts} |
| PART-010 trackEvent | `adjust_number`, `reset_adjustments`, `answer_submitted`, etc. |
| PART-011 endGame + postMessage game_complete | dual-path (victory + game_over) |
| PART-017 FeedbackManager init / preload | full init (NOT skipped — we're on PART-017 per concept spec defaults) |
| PART-023 ProgressBarComponent | `totalRounds:9, totalLives:3` — but hearts force-recolored dark via CSS |
| PART-024 TransitionScreenComponent | welcome / round-intro / victory / game-over / motivation / stars-collected |
| PART-025 ScreenLayout.inject | `slots: {previewScreen:true, progressBar:true, transitionScreen:true}` |
| PART-039 PreviewScreenComponent | default on |
| PART-042 SignalCollector | standard |

## Test hooks (required for Playwright)

```js
window.startGame = startGame;         // bootstrap
window.nextRound = nextRound;         // test jump
window.restartGame = restartGame;
window.endGame = endGame;
window.gameState = gameState;
window.loadRound = function(n){ ... };          // jump to round n
window.solveCurrentRound = function(){         // sets sum input to correct, submits
  var input = document.getElementById('sum-input');
  if (input) { input.value = String(gameState.correctAnswer); handleSubmit(); }
};
window.adjustA = function(d){ adjustCell('a', d); };
window.adjustB = function(d){ adjustCell('b', d); };
```

## Known test gotchas (documented for the report)

- **Virtual keyboard on mobile browsers:** Playwright desktop Chrome doesn't render a virtual keyboard, so the `visualViewport.resize` listener never fires and input is always visible. Manual mobile test required if visual audit flags this.
- **Reset button wiping typed input:** If a student types something, then taps Reset, the input ALSO clears. Tests that type first then click Reset should expect input to be empty afterward.
- **`type="text" inputmode="numeric"`:** `page.fill()` works fine, but `page.type()` in Playwright submits per-character input events — ensure the growing-width handler doesn't re-render the input DOM on every keystroke (it mutates style only).
- **`parseInt('130 ', 10) === 130`** so trailing whitespace is accepted. Leading zeros (`parseInt('0130')=130` in modern JS) also accepted; NaN (empty, alpha) rejected.
- **Lives CSS override:** CDN ProgressBar renders `.heart` with default red. We override `.mathai-progress-slot .heart { color:#272B2E; filter: grayscale(1); }`. Validate visually that the CSS doesn't double-paint hearts (`5e0-LIVES-DUP-FORBIDDEN`).

## Output file

- `games/add-list-adjustment-strategy/index.html` — single self-contained HTML, ~1200-1600 lines target.
- Self-validate against `validate-static.js` + `validate-contract.js`.

## Deploy

- `scripts/publish-add-list-adjustment-strategy.js` — cloned from `publish-logic-seat-puzzle.js`, renamed metadata:
  - `name: 'Add List with Adjustment Strategy'`
  - `metadata.title: 'Add List with Adjustment Strategy — Mental Math Compensation'`
  - `concepts: ['addition', 'compensation-strategy', 'mental-math', 'number-sense']`
  - `difficulty: 'medium'`, `minGrade: 4`, `maxGrade: 5`
- Content set name: `'Add List with Adjustment Strategy — Default'`
