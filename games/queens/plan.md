# Game Plan: Queens — 7-Queens Coloured-Region Puzzle

Single consolidated plan covering game-flow, screens, round-flow, feedback, and scoring. Produced from `spec.md`.

## Archetype
- **Profile:** Board Puzzle (#6)
- **Interaction:** Pattern P8 (Click-to-Toggle) with a 3-state cycle `empty → ✖ → ♛ → empty`
- **PART flags:** PART-001 (CDN core), PART-004 (init), PART-005 (visibility), PART-007 (state), PART-008 (postMessage), PART-009 (recordAttempt), PART-010 (events), PART-011 (endGame), PART-017 (FeedbackManager), PART-019 (results), PART-021 (mobile layout), PART-023 (progress bar with lives — `totalLives: 2`), PART-024 (transitions), PART-025 (screen layout), PART-027 (play area), PART-039 (preview screen), PART-042 (signals). No PART-006 (no timer).
- **Defaults overridden:** `rounds: 3` (spec), `lives: 2` (spec), `timer: 0` (Board Puzzle default preserved).

## 1. game-flow.md

**One-liner:** Place 7 queens on a 7×7 coloured-region board so no two queens share a row, column, colour, or diagonal-neighbour — repeat for 3 puzzles with 2 shared lives.

**Shape:** Multi-round (default) with one delta: shared session lives (not per-round). Wrong (attacking) placement reverts the queen and deducts a life but does NOT advance the round; round advance only on 7-safe-queens solve.

**Changes from default:** Add a "revert queen" micro-transition on attacking placement (stay on same round) and make Game Over reachable mid-round when lives reach 0.

```
[Preview Screen (PART-039)]
        ↓
[Round N Transition (auto-advance): "Puzzle N"]
        ↓
[Gameplay — 7×7 grid, tri-state tap]
        │
        ├── tap empty → ✖        (no life change)
        ├── tap ✖ → ♛ safe       (stays, green flash, place SFX)
        ├── tap ✖ → ♛ attacks    (red flash, life--, reverts; if lives==0 → Game Over)
        └── tap ♛ → empty        (deselect SFX)
        │
        ↓ 7 queens placed safely
[Round N correct → progressBar.update FIRST → all_correct SFX → TTS]
        ↓
[If N<3: Round N+1 Transition] / [If N==3: Victory]
```

**Stages:** R1 (B1, vivid palette, ♛ glyph, emoji rules) → R2 (B2, pastel palette, 👑 glyph, emoji rules) → R3 (B3, muted palette, 👑 glyph, plain rules).

## 2. screens.md

Persistent preview wrapper (PART-039) owns the header in every non-Preview screen; game-content mounts inside `#gameContent`.

### Preview Screen (one-shot at start)
```
┌─ [header: avatar | question label | score | star] ─┐
│                                                    │
│  🎯 Place 7 queens safely!                          │
│                                                    │
│  Tap a cell to mark ✖, tap again to place ♛,       │
│  tap once more to clear.                           │
│                                                    │
│  No two queens may share a row, column, colour,    │
│  or touch on a diagonal.                           │
│                                                    │
│  [ Skip & show board ]                             │
└────────────────────────────────────────────────────┘
```
- `previewAudio` from content > fallbackContent > runtime TTS fallback.
- Calls `startGameAfterPreview()` on complete.

### Round N Transition (auto-advance, no CTA)
- Title: `"Puzzle " + roundNum` (e.g. `"Puzzle 1"`)
- Subtitle: `"7 queens, 7 colours, 4 rules"`
- Icons: `['🎯']`
- Audio: `rounds_sound_effect` with STICKER_ROUND via `onMounted`; then dynamic TTS ("Puzzle 1") awaited.
- Auto-hides after audio.

### Gameplay Screen
```
┌─ [header: avatar | "Puzzle 1" | score=2★ | ⭐ ] ─┐
│ [progress bar: 0/3]  ❤❤ (2 lives)               │
│                                                  │
│  ┌─────────────────────────────┐                 │
│  │  7×7 coloured grid           │                 │
│  │  each cell ≥44×44 px         │                 │
│  │  region borders 3px solid    │                 │
│  │  cell borders 1px thin       │                 │
│  └─────────────────────────────┘                 │
│                                                  │
│  1⃣ same row    2⃣ same column                    │
│  3⃣ same colour  4⃣ nearest diagonals              │
│                                                  │
│  Tap: empty → ✖ → ♛ → empty                     │
│                                                  │
│         [  Reset  ]                              │
└──────────────────────────────────────────────────┘
```
- Grid: `display: grid; grid-template-columns: repeat(7, 1fr); gap: 0;` with region borders computed per-cell (thick border on any edge that abuts a different-region cell).
- Rules banner uses `rulesStyle` flag: `emoji` → "1⃣ 2⃣ 3⃣ 4⃣" ; `plain` → "1. 2. 3. 4."
- Queen glyph taken from round's `queenGlyph` field.

### Victory Screen (PART-024, `stars: N`)
- Title: `"Victory 🎉"`
- Subtitle: `"3 puzzles cracked!"` (game-specific)
- `stars: gameState.stars`
- Buttons per default-transition-screens.md: `Play Again` + `Claim Stars` for 2★, `Claim Stars` alone for 3★.
- `onMounted` fires `victory_sound_effect` with STICKER_VICTORY.

### Game Over Screen (PART-024)
- Title: `"Game Over"`
- Subtitle: `"You ran out of lives!"`
- Icons: `['😔']`
- Button: single `Try Again`.
- `onMounted` fires `game_over_sound_effect` with STICKER_SAD.

### Stars Collected Screen (auto-dismiss 2500ms)
- Two-line title: `"Yay, stars\ncollected!"`
- No subtitle, no icons, no buttons.

## 3. round-flow.md

### Rendering a round
1. Read `round = getRounds()[gameState.currentRound]`.
2. Render 7×7 grid with 49 `<button class="cell" data-row data-col data-region>` elements.
3. Apply background colour from `round.palette[region]`.
4. Compute region-border CSS: for each cell edge, if neighbour cell has a different `region` id, apply thick border (3px solid black) on that edge; else thin (1px solid #bbb).
5. Render rules banner using `round.rulesStyle` and `round.queenGlyph`.
6. Reset `gameState.cellState` = 7×7 zeros, `gameState.queensPlaced` = [].
7. `gameState.phase = 'gameplay'; syncDOM()`.

### Tap handler (per cell)
```
onCellTap(row, col):
  guard: if isProcessing || gameEnded || !isActive → return
  state = cellState[row][col]   // 0 empty, 1 marked, 2 queen
  if state === 0:              // empty → marked
    cellState[row][col] = 1
    render ✖ glyph
    fire-and-forget sound_bubble_select
  else if state === 1:         // marked → queen (with validation)
    isProcessing = true
    tentatively mark as queen
    violation = checkAttack(row, col, queensPlaced)
    if violation === null:
      cellState[row][col] = 2
      queensPlaced.push({row, col})
      render ♛ glyph with green flash (class .seat-success 400ms)
      fire-and-forget tap_sound
      isProcessing = false
      if queensPlaced.length === 7:
        onPuzzleSolved()
    else:
      // attacking placement
      render red flash briefly
      lives--
      progressBar.update(roundsCompleted, lives)
      syncDOM()
      await Promise.all([
        FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_WRONG}),
        new Promise(r => setTimeout(r, 1500))
      ])
      FeedbackManager.playDynamicFeedback({
        audio_content: violationMessage(violation),
        subtitle: violationMessage(violation),
        sticker: STICKER_WRONG
      }).catch(()=>{})
      cellState[row][col] = 0   // revert
      recordAttempt({ row, col, rule_violated: violation, lives_remaining: lives })
      syncDOM()
      if lives <= 0:
        endGame(false)
        return
      isProcessing = false
  else if state === 2:         // queen → empty
    cellState[row][col] = 0
    queensPlaced = queensPlaced.filter(q => !(q.row===row && q.col===col))
    fire-and-forget sound_bubble_deselect
```

### Attack detection
```
checkAttack(row, col, queensPlaced):
  for each q in queensPlaced:
    if q.row === row → return 'row'
    if q.col === col → return 'col'
    if regions[q.row][q.col] === regions[row][col] → return 'region'
    if abs(q.row - row) === 1 && abs(q.col - col) === 1 → return 'diagonal'
  return null
```

### Puzzle solved
```
onPuzzleSolved():
  isProcessing = true
  roundsCompleted++
  score++
  firstSolveBonus = (lives === 2) ? 1 : 0   // purely telemetric
  progressBar.update(roundsCompleted, lives)   // FIRST, before SFX
  trackEvent('round_complete', { round: currentRound, lives })
  recordAttempt({ queens: queensPlaced, rule_violated: null, lives_remaining: lives, solved: true })
  syncDOM()
  await Promise.all([
    FeedbackManager.sound.play('all_correct', {sticker: STICKER_CORRECT}),
    new Promise(r => setTimeout(r, 1500))
  ])
  FeedbackManager.playDynamicFeedback({
    audio_content: 'Great analysis! 7 queens placed.',
    subtitle: 'Great analysis! 7 queens placed.',
    sticker: STICKER_CORRECT
  }).catch(()=>{})
  if (currentRound + 1 >= totalRounds):
    endGame(true)
  else:
    currentRound++
    showRoundTransition(currentRound + 1)
```

## 4. feedback.md

Feedback moments (Bloom L4 Analyze subtitles — "ask-back + state answer"):

| Moment | SFX | Sticker | Subtitle (≤60 chars) | Await? |
|--------|-----|---------|----------------------|--------|
| Tap empty → ✖ | `sound_bubble_select` | — | — | No |
| Tap ✖ → ♛ (safe) | `tap_sound` | — | — | No |
| Tap ✖ → ♛ (attacks: same row) | `incorrect_sound_effect` | STICKER_WRONG | "Two queens in the same row!" | Yes (Promise.all 1500ms) + FF TTS |
| Tap ✖ → ♛ (attacks: same col) | `incorrect_sound_effect` | STICKER_WRONG | "Two queens in the same column!" | Yes (Promise.all 1500ms) + FF TTS |
| Tap ✖ → ♛ (attacks: same colour) | `incorrect_sound_effect` | STICKER_WRONG | "Queens share the same colour!" | Yes (Promise.all 1500ms) + FF TTS |
| Tap ✖ → ♛ (attacks: diagonal) | `incorrect_sound_effect` | STICKER_WRONG | "Queens touch on a diagonal!" | Yes (Promise.all 1500ms) + FF TTS |
| Tap ♛ → empty | `sound_bubble_deselect` | — | — | No |
| Puzzle solved | `all_correct` | STICKER_CORRECT | "Great analysis! 7 queens safe." | Yes (Promise.all 1500ms) + FF TTS |
| Lives → 0 | `game_over_sound_effect` | STICKER_SAD | — | Yes (in Game Over transition) |
| Final puzzle solved → Victory | `victory_sound_effect` | STICKER_VICTORY | "Victory!" | Yes (in Victory transition) |
| Reset button | `sound_bubble_deselect` | — | — | No |

Rule ordering: row → col → region → diagonal (first violation reported).

## 5. scoring.md

- **Points:** +1 per puzzle solved. Max 3.
- **Stars:**
  - 3 puzzles + 2 lives → 3★
  - 3 puzzles + <2 lives → 2★
  - 2 puzzles → 2★
  - 1 puzzle → 1★
  - 0 puzzles → 0★
- **Lives:** 2 at game start, shared across rounds. Decrement only on attacking queen placement. Lives → 0 triggers `endGame(false)` → Game Over.
- **Progress bar (PART-023):** `createProgressBar` with `totalRounds: 3, totalLives: 2, slotId: 'mathai-progress-slot'`. Update call signature: `update(roundsCompleted, livesRemaining)`.
- **Telemetry (recordAttempt per answer):**
  - attacking placement → `{ is_correct: false, rule_violated: 'row'|'col'|'region'|'diagonal', placement: {row,col}, lives_after: N }`
  - solved → `{ is_correct: true, placements: [7 queens], rule_violated: null, lives_after: N }`
- **game_complete payload:** `{ score, stars, roundsCompleted, totalRounds: 3, attempts, events, duration_data, previewResult, completedAt }`.

## Build notes

- **DOM caching:** Cache grid cell refs at round render; do NOT re-query inside tap handler.
- **Region borders:** compute once per render; store as CSS variables on each cell.
- **Standalone fallback:** top-level `setTimeout(2000)` per code-patterns.md (not nested in `waitForPackages`).
- **Window exposures:** `gameState`, `endGame`, `restartGame`, `startGame`, `nextRound` on window.
- **Cleanup between rounds:** `FeedbackManager.sound.stopAll()` and `FeedbackManager.stream.stopAll()` at the top of `nextRound`, `endGame`, `restartGame`.
- **ProgressBar update timing:** call `progressBar.update(roundsCompleted, lives)` FIRST in `onPuzzleSolved`, before the awaited `all_correct` SFX.
- **No custom lives DOM:** do NOT render a second hearts row inside `#gameContent`; ProgressBar owns the hearts strip.
