# Pre-Generation Plan: Kakuro — Number Sum Crossword

**Game ID:** kakuro
**Archetype:** Board Puzzle (#6) — Shape 2 (Multi-round)
**Bloom:** L3 Apply
**Interaction:** Tap-cell-then-tap-digit (Pattern P1 Tap, with cell-as-selection and digit-pad-as-value)
**Rounds:** 3 (Stage 1: R1 variant B1, Stage 2: R2 variant B2, Stage 3: R3 variant B3)
**Lives:** None (no Game Over branch)
**Timer:** None
**PreviewScreen:** YES (mandatory per PART-039)

---

## 1. Screen Flow

```
          ┌─────────────────────────────────────────────────────────────────┐
          │                     PreviewScreen wrapper                        │
          │  (persistent: header bar + scroll area + progress-bar slot)     │
          │                                                                  │
          │   DOMContentLoaded                                               │
          │        │                                                         │
          │        ▼                                                         │
          │   setupGame() ── renderInitialState() ── previewScreen.show() ──┐
          │                                                                  │   │
          │                                                                  │   ▼
          │                                                     ┌─── Preview State ────┐
          │                                                     │ instruction HTML:    │
          │                                                     │ "Tap a white square…"│
          │                                                     │ "Skip & start" CTA   │
          │                                                     └──────────┬───────────┘
          │                                                                │ skip / audio-end
          │                                                                ▼
          │                                                      startGameAfterPreview()
          │                                                                │
          │                                                                ▼
          │                       ┌────────── TransitionScreen: "Round N" (N=1..3) ─────────┐
          │                       │  title "Round N"  ·  sticker rounds_sticker             │
          │                       │  onMounted: sound 'rounds_sound_effect'                  │
          │                       │  auto-advance after SFX + short delay (≈900ms)           │
          │                       └────────────────────┬─────────────────────────────────────┘
          │                                            │ auto
          │                                            ▼
          │          ┌──────────────── Gameplay Round N (data-phase="gameplay") ─────────────┐
          │          │  persistent preview header  ·  ProgressBar (N/3 segments)              │
          │          │  Rules panel (1⃣ 2⃣ 3⃣ OR 1. 2. 3. per variant)                       │
          │          │  5×5 grid (blocked + clue + white cells, diagonal-split clues)         │
          │          │  Number pad (1-4, 5-8, 9) centred                                      │
          │          │  CHECK button (disabled until every white cell filled)                 │
          │          │                                                                        │
          │          │  (tap loop: tap cell→tap digit; re-tap digit to clear; re-tap cell to  │
          │          │   deselect; replace-digit by tapping another digit)                    │
          │          └───────┬────────────────────────────────────────────────────────────────┘
          │                  │ tap CHECK (enabled)
          │                  ▼
          │          ┌─── Whole-grid validator runs against runs[] ───┐
          │          └───────┬───────────────────────────────┬─────────┘
          │          all runs satisfied                 at least one run violated
          │                  │                                 │
          │                  ▼                                 ▼
          │     ┌── Correct Feedback (inline) ──┐   ┌── Wrong Feedback (inline) ──┐
          │     │ all white cells flash green    │   │ conflict cells flash red    │
          │     │ await sfx correct + sticker    │   │ await sfx incorrect + sad   │
          │     │ fire-and-forget TTS            │   │ fire-and-forget TTS         │
          │     │ recordAttempt(pass:true)       │   │ recordAttempt(pass:false)   │
          │     │ auto-advance after ≈1500ms     │   │ CHECK morphs → NEXT button  │
          │     └───────────┬────────────────────┘   │ +1500ms: reveal solution    │
          │                 │                         │ (digits fade into cells)   │
          │                 │                         │ NEXT tappable any time     │
          │                 │                         └───────────┬─────────────────┘
          │                 │                                     │ NEXT tap OR auto after ≈3500ms
          │                 ▼                                     ▼
          │          ┌───── routing on N ─────┐ ─── same routing ───┐
          │          │ if N < 3 → Round N+1   │
          │          │ if N == 3 → Victory    │
          │          └─────────┬──────────────┘
          │                    │
          │        N<3 ▼                   N==3 ▼
          │   (loop to Round N+1          ┌──── Victory ────┐
          │    intro transition)          │ stars 0..3      │
          │                               │ subtitle:       │
          │                               │  "You solved    │
          │                               │   X of 3!"      │
          │                               └───┬────┬────────┘
          │                                   │    │
          │                       stars<3 │    │ any stars
          │                   [Play Again] │    │ [Claim Stars]
          │                                │    │
          │                                ▼    ▼
          │                  ┌─ Motivation ─┐  ┌─ Stars Collected ─┐
          │                  │ "Ready to    │  │ "Yay! 🎉          │
          │                  │ improve      │  │  Stars collected!"│
          │                  │ your score?"│  │ auto 2500ms        │
          │                  │ [I'm ready!] │  │ → postMessage      │
          │                  └──────┬───────┘  │   game_exit        │
          │                         │ tap      └─────────┬──────────┘
          │                         ▼                    ▼
          │           restart from Round 1             exit
          │          (skips Preview + Welcome;
          │           resets gameState; roundIndex=0)
          └─────────────────────────────────────────────────────────────────┘
```

**Shape:** Shape 2 Multi-round.

**Changes from canonical default (per spec `## Flow`):**
1. **No Game Over branch / no lives** — the "wrong AND lives = 0" edge is removed entirely.
2. **No retry loop on wrong** — the wrong-answer path advances to the next round via a CHECK→NEXT button morph (with brief solution reveal).
3. **Submit is an explicit button tap** — CHECK button replaces the implicit "submit" transition; CHECK is disabled until every white cell is filled.

**Entry/exit triggers table:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen (preview state) | `start_screen` | `DOMContentLoaded` → `setupGame()` → `previewScreen.show()` AFTER initial render | skip button OR audio-finish OR fallback → `onComplete` → `startGameAfterPreview()` |
| PreviewScreen (game state / wrapper) | — | `startGameAfterPreview()` | persists for entire session; only `endGame()` calls `previewScreen.destroy()` |
| Round N intro | `round_intro` | before each round (N=1..3) via `transitionScreen.show({ title: 'Round N', … })` | auto-advance after `rounds_sound_effect` completes + ≈900ms |
| Gameplay Round N | `gameplay` | transition auto-complete → `renderRound(roundIndex)` | CHECK tap with all cells filled → validator |
| Inline Feedback (correct) | `gameplay` (inline overlay) | validator returns pass | auto-advance ≈1500ms → next round transition or Victory |
| Inline Feedback (wrong) | `gameplay` (inline overlay) | validator returns fail | NEXT tap OR auto-advance ≈3500ms → next round transition or Victory |
| Victory | `results` | after Round 3 feedback exits AND `roundIndex==2` | "Claim Stars" → Stars Collected; "Play Again" (if stars<3) → Motivation |
| Motivation | `results` (transition) | "Play Again" on Victory stars<3 | "I'm ready! 🙌" → `restartToRound1()` |
| Stars Collected | `results` (transition) | "Claim Stars" on Victory | auto 2500ms → `postMessage({type:'game_exit'})` |

**ProgressBar** (top of game body, below the fixed preview header, owned by ScreenLayout + ProgressBarComponent):
- 3 segments. Advance exactly ONE segment per round on entering Round N+1 (or on transition-to-Victory after Round 3). Never advances mid-round.
- Counter increment convention: `progressBar.update(roundsCompleted, 0)` is the FIRST action fired in `round-complete` handler, BEFORE any awaited SFX, per MEMORY.md rule `progress_bar_round_complete`.
- Persists across rounds. Reset fires ONLY on entering Round 1 of the restart path after Motivation.

---

## 2. Round-by-Round Breakdown

Every round uses tap-cell-then-tap-digit with check-on-submit. Grid geometry, runs, and the authoritative solution come from `fallbackContent.rounds[]` in the spec — never hand-invented at runtime.

| R | Stage/Variant | Grid (5×5) | White cells | Runs (row/col) | Distinctive clue | Primary misconceptions | Target 1st-CHECK |
|---|---|---|---|---|---|---|---|
| 1 | S1 / B1 | 5×5, B1 layout | 12 | 4 row + 4 col | 29/11/17 top-row; 21/4 diagonal split | sum-wrong, repeat-in-run | 55-70% |
| 2 | S2 / B2 | 5×5, B2 layout | 12 | 4 row + 4 col | 16, 11 top-row | sum-wrong, ignore-column-run | 45-60% |
| 3 | S3 / B3 | 5×5, B3 layout | 12 | 4 row + 4 col | 29 top-row (forces 9) | miss-forced-9, repeat-in-run | 35-50% |

**Grid geometry (hard-coded per round in `fallbackContent`):**

For each round, the grid is a list of 25 cells (row 0-4, col 0-4). Each cell is one of:
- `blocked` — solid black square, no content.
- `clue` — black cell with optional `across` and/or `down` clue numbers. Rendered with diagonal split line (from bottom-left corner to top-right); `across` value in upper-right triangle, `down` value in lower-left triangle.
- `white` — fillable; user enters a digit 1-9.

**Run derivation rule (runtime, deterministic):**
- A **row-run** starts immediately to the right of any clue cell with `across` set, continues through consecutive white cells, and ends at the next blocked/clue cell or the grid edge. The clue's `across` value is the run's target sum.
- A **column-run** starts immediately below any clue cell with `down` set, continues through consecutive white cells, ends at the next blocked/clue cell or the grid edge. The clue's `down` value is the run's target sum.

The `runs` array in each round's data is the authoritative pre-computed list — the validator and renderer use it directly.

**Rules panel (verbatim per variant):**
- Round 1 (B1): `1⃣ Sum of white blocks in each row must equal the number in the black block on their left. 2⃣ Sum of white blocks in each column must equal the number in the black block above them. 3⃣ Digits should not be repeated in any row or column.`
- Rounds 2 & 3 (B2, B3): same text, with `1.` `2.` `3.` numeric notation instead of emoji keycaps.

**Validator (pure, idempotent):**

```
function validate(cellValues, runs):
  conflictCells = Set()
  violated = []
  for run in runs:
    values = run.cells.map(id => cellValues[id])   // array of digits (all non-null when CHECK enabled)
    // Sum check
    var sum = values.reduce((a,b) => a+b, 0)
    if sum !== run.sum: violated.push(run.id + ':sum'); run.cells.forEach(c => conflictCells.add(c))
    // No-repeat check
    if hasDuplicate(values): violated.push(run.id + ':repeat'); run.cells.forEach(c => conflictCells.add(c))
  return { pass: violated.length === 0, violated, conflictCells: Array.from(conflictCells) }
```

Note: the validator accepts **ANY** digit assignment that satisfies every run's sum and no-repeat rule — not only the canonical `solution` field. This means alternative valid solutions are also marked correct.

**Conflict-cell rule (for red highlighting on wrong CHECK):** Any cell in any violated run is a conflict cell. Cells in only-satisfied runs stay neutral (white).

---

## 3. Tap Interaction Logic (Pattern P1)

**Tap sources:**
- White cell (sets `selectedCellId`)
- Digit button (writes digit into `selectedCellId` if any)
- CHECK button (validates when board full)
- NEXT button (advances after wrong feedback; morphs from CHECK)

**Tap behaviors:**

| Event | Action |
|---|---|
| Tap white cell | `selectedCellId = cellId`. Highlight cell yellow. Remove highlight from any previously selected cell. No audio. |
| Tap currently-selected white cell | `selectedCellId = null`. Remove highlight. No audio. |
| Tap blocked or clue cell | No-op. No audio. |
| Tap digit D while `selectedCellId` non-null and cell empty | Write D into cell. Fire-and-forget `sound_bubble_select` SFX. If cell already has value = D, toggle it to null (clear). If cell has value = X ≠ D, replace with D. Recompute `isBoardFull`. |
| Tap digit D while `selectedCellId` is null | No-op. |
| Tap CHECK while `isBoardFull` | Run validator → correct or wrong path. |
| Tap CHECK while NOT `isBoardFull` | No-op (button disabled, defensive check). |
| Tap NEXT (button in next-mode) | Advance to next round or Victory. |

**Board-full computation:** `isBoardFull = true` when every white cell in the current round has a non-null value.

**Touch + mouse parity:** Standard `click` handlers on tap targets; `touch-action: manipulation` on every button; 44×44 CSS px minimum for cells and digit buttons.

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  gameId: 'kakuro',
  phase: 'start_screen' | 'round_intro' | 'gameplay' | 'feedback_correct' | 'feedback_wrong' | 'round_complete' | 'results',
  currentRound: 0..3,                          // 1-based during play; 0 before start
  totalRounds: 3,
  roundIndex: 0..2,                            // 0-based
  round: {                                     // snapshot of current round from content[]
    round, stage, type, variant, rulesFormat, grid, runs, misconception_tags
  },
  cellValues: { [cellId:string]: number|null }, // W1..W12 keys; null = empty
  selectedCellId: null | string,               // currently focused white cell
  isBoardFull: boolean,
  validationResult: null | { pass, violated, conflictCells },
  isProcessing: boolean,                        // true during feedback; blocks taps
  gameEnded: boolean,
  firstCheckSolves: 0..3,                       // feeds stars
  roundsCompleted: 0..3,
  score: 0..3,                                  // mirrors firstCheckSolves
  stars: 0..3,
  lives: 0,                                     // unused
  totalLives: 0,
  attempts: [],                                 // recordAttempt buffer
  events: [],                                   // trackEvent buffer
  responseTimes: [],
  roundStartTime: null | ms,
  startTime: null | ms,
  isActive: false | true,
  correctAnswer: null | solutionMap,
  previewResult: null,
  duration_data: { preview: [], startTime: null, attempts: [], evaluations: [], inActiveTime: [], totalInactiveTime: 0 },
  content: null | fallbackContent
}
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| `start_screen` | `DOMContentLoaded` | preview (component state) | `setupGame()` injects layout, renders Round 1 scaffold, `previewScreen.show()` |
| `start_screen` | preview `onComplete` | `round_intro` | `startGameAfterPreview()`: set `startTime`, `isActive=true`, show Round 1 transition |
| `round_intro` | rounds SFX finishes (or CTA) | `gameplay` | `renderRound(roundIndex)` — reset `cellValues`, `selectedCellId`, `isBoardFull`, `isProcessing=false`; `syncDOM()` |
| `gameplay` | tap white cell | `gameplay` | update `selectedCellId`; render selection highlight |
| `gameplay` | tap digit | `gameplay` | update `cellValues`; recompute `isBoardFull`; update CHECK enabled state |
| `gameplay` | tap CHECK (isBoardFull) | `feedback_correct` OR `feedback_wrong` | `isProcessing=true` (BEFORE any await); run validator; `recordAttempt(...)` BEFORE audio |
| `feedback_correct` | after awaited SFX + ≈1500ms | `round_complete` | `firstCheckSolves += 1`, `score += 1`, `roundsCompleted += 1`, `progressBar.update(…)` FIRST |
| `feedback_wrong` | CHECK→NEXT morph + ≈1500ms | (inline) solution-reveal | fade solution digits into white cells; keep `feedback_wrong` phase |
| `feedback_wrong` | NEXT tap OR auto ≈3500ms | `round_complete` | `roundsCompleted += 1`, `progressBar.update(…)` FIRST |
| `round_complete` | (roundIndex < 2) | `round_intro` | `roundIndex += 1`, show "Round N" transition |
| `round_complete` | (roundIndex === 2) | `results` | compute stars, render Victory, fire `game_complete` BEFORE audio |
| `results` | "Claim Stars" | (transition screen: stars_collected) | auto 2500ms → `postMessage({type:'game_exit'})` |
| `results` | "Play Again" (stars<3) | (transition screen: motivation) | "I'm ready!" → `restartToRound1()` |
| `motivation` | "I'm ready!" | `round_intro` (Round 1) | reset gameState except `duration_data`; `roundIndex=0`, `firstCheckSolves=0`, `roundsCompleted=0`; skip Preview + Welcome |

---

## 5. Scoring & Progression Logic

- **Points:** `+1` per round solved on FIRST CHECK (`validationResult.pass === true`). Max 3.
- **Lives:** None. No game-over screen exists; `gameState.lives` not maintained.
- **Timer:** None. `previewScreen.show()` passes `timerConfig: null, timerInstance: null`.
- **Star rating** (computed once on transition to `results`, from `firstCheckSolves`):
  - **3★** = `firstCheckSolves === 3`
  - **2★** = `firstCheckSolves === 2`
  - **1★** = `firstCheckSolves === 1`
  - **0★** = `firstCheckSolves === 0` (still reaches Victory; renders 0 filled stars)
- **ProgressBar:**
  - 3 discrete segments.
  - `progressBar.update(roundsCompleted, 0)` called as the FIRST action in the `round_complete` handler (MEMORY.md: `progress_bar_round_complete`).
  - Completed segments persist across rounds; reset ONLY on restart-from-Round-1 after Motivation.
- **Victory subtitle:** `"You solved ${firstCheckSolves} of 3 on the first try!"` — the only dynamic Victory string.

---

## 6. Feedback Patterns

Cross-reference: `alfred/skills/feedback/SKILL.md` 17 behavioral cases + await/fire-and-forget priority table. Bloom L3 → context-aware TTS on CHECK resolution; per-tap audio is silent-or-fire-and-forget.

| Event | Trigger | FeedbackManager call | Subtitle | Blocks input? | Await? |
|---|---|---|---|---|---|
| Tap white cell | `click` on `.white-cell` | — (no audio) | — | No | — |
| Tap digit | `click` on `.digit-btn` while `selectedCellId` set | `FeedbackManager.sound.play('sound_bubble_select').catch(…)` | — | No | No (FAF) |
| Tap digit with no cell selected | — | — | — | No | — |
| Round N intro | transition mount | `await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_ROUNDS })` | (no dynamic TTS) | No CTA | Yes |
| CHECK correct | `pass=true` | `isProcessing=true` → cells flash green 400ms → `await FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CORRECT })` → `FeedbackManager.playDynamicFeedback({ audio_content: correctLine, subtitle: correctLine, sticker: STICKER_CORRECT }).catch(…)` | "Great addition! Every run sums right." | Yes | Yes (SFX) + FAF (TTS) |
| CHECK wrong | `pass=false` | `isProcessing=true` → conflict cells red 400ms → `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_SAD })` → `FeedbackManager.playDynamicFeedback({ audio_content: wrongLine, subtitle: wrongLine, sticker: STICKER_SAD }).catch(…)` → CHECK button morphs to NEXT | "Not quite — check the sums and repeats." | Yes | Yes (SFX) + FAF (TTS) |
| Solution reveal | `feedback_wrong` + ≈1500ms | — (silent) | — | Yes | — |
| NEXT tapped | button tap | `FeedbackManager.sound.stopAll()` | — | — | — |
| Round complete (correct or wrong+next) | entering `round_complete` | `progressBar.update(roundsCompleted, 0)` FIRST, then continue | — | — | — |
| Victory | all 3 rounds done | Render screen FIRST → `game_complete` postMessage → `await FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })` → `await FeedbackManager.playDynamicFeedback({ audio_content: victoryVO, subtitle: victoryVO, sticker: STICKER_CELEBRATE })` | "You solved X of 3 on the first try!" | CTA visible | Yes (sequential) |
| Visibility hidden | `visibilitychange` | `VisibilityTracker` handles pause overlay | — | — | — |
| Visibility restored | `visibilitychange` | `VisibilityTracker.resume()` | — | — | — |

**Subtitle examples:**
- Correct (round 1): "Great addition! Every run sums right."
- Correct (round 3): "Nice — spotting the forced 9 paid off!"
- Wrong (round 1): "Not quite — check the sums and repeats."
- Wrong (round 3): "Not quite — look for where 9 must go."

**Animations:**

| Animation | Trigger | CSS class | Duration |
|---|---|---|---|
| Cell selection | tap white cell | `.cell-selected` | — (hold) |
| Cell fill | digit tap | `.cell-filled-pop` | 120ms ease-out |
| Cell success flash | CHECK pass | `.cell-success` (green) | 400ms |
| Cell conflict flash | CHECK fail | `.cell-conflict` (red) | 400ms repeat 2x (800ms total) |
| Solution reveal fade | `feedback_wrong`+1500ms | `.cell-solution-fade` | 600ms stagger 60ms/cell |
| CHECK→NEXT morph | CHECK fail | `.button-morph` | 250ms |
| Fade-in new round | `renderRound` | `.fade-in` | 350ms |

**Wrong Answer Handling:**
- Show correct grid: ALWAYS (after ≈1500ms, via fade-in animation of each solution digit).
- Misconception-specific TTS: NO in v1 — generic "Not quite — check the sums and repeats." Misconception tags captured in `recordAttempt.metadata.misconception` based on `violatedClueIds` — see mapping in §7.
- No retry loop.

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })` called once at init.
- `previewScreen.show()` called at end of `setupGame()` AFTER the Round 1 scaffold is rendered in the background. `timerConfig: null, timerInstance: null`. `previewInstruction` and `previewAudioText` come from `fallbackContent`.
- `endGame()` calls `previewScreen.destroy()` exactly once.
- `restartToRound1()` does NOT re-call `previewScreen.show()`.
- `VisibilityTracker` wired to `previewScreen.pause()` / `resume()`.
- `TimerComponent`: NOT used.
- `progressBar`: single instance mounted in the ScreenLayout progress-bar slot. Updated via `progressBar.update(roundsCompleted, 0)` FIRST in `round_complete` handler.
- `FeedbackManager` handles ALL audio — no raw `new Audio()`. Preload `sound_bubble_select`, `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `sound_game_victory`, `sound_stars_collected`, `sound_motivation` at `setupGame()`.
- `syncDOMState()` on every phase transition — `data-phase`, `data-round-index`, `data-score`, `data-stars` always reflect current state.
- **`recordAttempt` per CHECK** (once per round, regardless of pass/fail):
  - Correct: `{ pass: true, roundId, variant, cellValues, ... firstCheck: true }`
  - Wrong: `{ pass: false, roundId, variant, cellValues, violated, conflictCells, misconception: <tag> }`
  - `misconception` derived by: (a) if any `X:repeat` in violated → `repeat-in-run`; (b) elif any `col*:sum` and no `row*:sum` → `ignore-column-run`; (c) elif round.variant === 'B3' and col1:sum violated → `miss-forced-9`; (d) else → `sum-wrong`.
- **`game_complete` fires exactly once** on transition to `results`, BEFORE victory audio, with schema `{ score, totalQuestions, stars, accuracy, timeSpent, attempts, duration_data, ... }` inside `data.metrics`.
- **TransitionScreen usage** (same contract as `default-transition-screens.md`):
  - **Round N intro**: `{ title: 'Round N', icons: [roundsStickerUrl], buttons: [], onMounted: play rounds_sound_effect, persist: false }` + timer-based auto-advance.
  - **Victory**: `{ title: 'Victory 🎉', subtitle, stars, buttons: (stars===3 ? [Claim] : [Play Again, Claim]), persist: true, onMounted: play sound_game_victory }`. **No `icons` on Victory.**
  - **Motivation**: `{ title: "Ready to improve your score? ⚡", buttons: [I'm ready!], persist: true, onMounted: play sound_motivation }`.
  - **Stars Collected**: `{ title: "Yay! 🎉\nStars collected!", duration: 2500, styles: {title:{whiteSpace:'pre-line'}}, onMounted: play sound_stars_collected }`. On hide: `window.parent.postMessage({type:'game_exit'}, '*')`.
- `data-testid` attributes required on: every white cell (`cell-<id>`), every digit button (`digit-<n>`), CHECK button (`btn-check`), NEXT button (`btn-next`), progress segment (`progress-seg-<i>`), Victory "Claim Stars" (`claim-stars`), Motivation "I'm ready!" (`im-ready`).

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen (data-phase="start_screen", component state = preview)

```
+-------------------------------------+
|  [avatar]  Kakuro — Number Sum…     |
|                         0 / 3  ★ 0  |
+-------------------------------------+
|      ┌──────────────────────────┐   |
|      │  Number Sum Crossword!   │   |
|      │  Tap a white square,     │   |
|      │  then tap a digit 1-9.   │   |
|      │  Rows + columns must sum │   |
|      │  to their clues, no      │   |
|      │  repeats in any run.     │   |
|      └──────────────────────────┘   |
|            [ ▶ Skip ]               |
+-------------------------------------+
```

### 8.2 Round N intro (TransitionScreen, data-phase="round_intro")

```
+-------------------------------------+
|  [header] 0/3  ★ 0                  |
|  [progress: [0/3 filled=0]]         |
|                                     |
|              [🔢]                    |
|           Round N                   |
|        (auto-advance)               |
+-------------------------------------+
```

### 8.3 Gameplay (data-phase="gameplay")

```
+-------------------------------------+
|  [header] Round 1/3  ★ 0            |
|  [progress: ░░░ 0/3]                |
|                                     |
|  ┌─── Rules ─────────────────────┐  |
|  │ 1⃣ Row-sums = left clue       │  |
|  │ 2⃣ Col-sums = top clue        │  |
|  │ 3⃣ No repeats in any run      │  |
|  └───────────────────────────────┘  |
|                                     |
|    ┌───┬─────┬─────┬─────┬───┐     |
|    │ █ │\29  │\11  │\17  │ █ │    |
|    ├───┼─────┼─────┼─────┼───┤     |
|    │18\│  .  │  .  │  .  │ █ │    |
|    ├───┼─────┼─────┼─────┼───┤     |
|    │21\│  .  │  .  │  .  │4\ │    |
|    │ \4│     │     │     │   │    |
|    ├───┼─────┼─────┼─────┼───┤     |
|    │13\│  .  │  .  │  .  │ . │    |
|    ├───┼─────┼─────┼─────┼───┤     |
|    │ 9\│  .  │  .  │ █   │ █ │    |
|    └───┴─────┴─────┴─────┴───┘     |
|                                     |
|    Number Pad:                      |
|    [1] [2] [3] [4]                  |
|    [5] [6] [7] [8]                  |
|         [9]                         |
|                                     |
|       [  CHECK  (disabled)  ]       |
+-------------------------------------+
```

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `roundsCompleted/3` | no |
| Rules panel | upper | 3 rules lines (emoji or numeric) | no |
| 5×5 grid | center | blocked + clue + white cells | tap white cells |
| Number pad | below grid | 1-4, 5-8, 9 layout | tap digit |
| CHECK button | bottom | disabled until board full | tap when enabled |
| NEXT button | bottom (morph of CHECK on wrong) | "NEXT" | tap |

### 8.4 Victory (data-phase="results", TransitionScreen)

```
+-------------------------------------+
|  [header] 3/3  ★ 3                  |
|  [progress: ▓▓▓ 3/3]                |
|                                     |
|         ★   ★   ★                   |
|         Victory 🎉                  |
|  You solved 3 of 3 on the first try!|
|                                     |
|             [ Claim Stars ]          |
+-------------------------------------+
```

### 8.5 Motivation / 8.6 Stars Collected / 8.7 Game Over

- Motivation: "Ready to improve your score? ⚡" → tap "I'm ready! 🙌" → restartToRound1.
- Stars Collected: "Yay! 🎉 Stars collected!" → auto 2500ms → postMessage `game_exit`.
- Game Over: NOT USED (lives = 0).

---

## 9. Round Presentation Sequence (within gameplay screen)

Every round follows:
1. **Grid reveal** — rules panel + grid + number pad render (fade-in 350ms). CHECK button disabled.
2. **Instructions** — NOT repeated on gameplay. The how-to-play copy is owned by PreviewScreen. Rules panel above grid shows the 3 stated rules verbatim per variant.
3. **Gameplay reveal** — white cells become tappable; `isProcessing = false`.

---

## 10. Spec Ambiguities Resolved

| Ambiguity (spec) | Planner default | Rationale |
|---|---|---|
| Grade level (3-6) | Design for Class 5 median | Spec aligns with Class 3-6 addition content |
| Round count | **3** (one per variant) | Matches concept `block_count 3` |
| Lives & retry on wrong | **0 lives, CHECK→NEXT, no retry** | Matches Board Puzzle archetype + concept family |
| Number pad layout | **4+4+1 (1-4, 5-8, 9)** | Per concept §Core Mechanics |
| CHECK enablement | **All white cells filled** | Per concept — no partial-submit |
| Solution reveal after wrong | **≈1500ms pre-reveal, 600ms fade, NEXT interruptible** | Gives student time to register "wrong" |
| Auto-advance after wrong when NEXT not tapped | **≈3500ms total** | Matches Round Puzzle pattern |
| Puzzle uniqueness | **Accept any valid assignment** | Validator checks sum + no-repeat per run, not canonical solution equality |
| Clue diagonal split | **Upper-right = across, Lower-left = down** | Per concept |

---

## 11. Cross-Validation

- Every screen in §1 has a wireframe in §8. Game Over intentionally absent (no lives).
- Every feedback moment in §6 corresponds to a step in §4 phase transitions.
- `firstCheckSolves` is the single scoring source: incremented in `feedback_correct` handler; never touched in `feedback_wrong`. Stars map is a pure function of `firstCheckSolves`.
- `progressBar.update` is called FIRST in `round_complete` handler — per MEMORY.md rule.
- `recordAttempt` fires exactly once per round, on CHECK.
- `game_complete` fires exactly once, BEFORE victory audio, on transition to `results`.
- Transition screens (Victory / Motivation / Stars Collected) match `reference/default-transition-screens.md`.
