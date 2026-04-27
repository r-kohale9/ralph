# Pre-Generation Plan: Hexa Numbers

## Archetype
**Board Puzzle (#6)** — lives=0, timer=0, rounds=3.

Rationale: each round is a complete honeycomb puzzle solved as a whole. Not sequential per-item. P6 drag-drop + validate-whole-board on CHECK.

## Screen flow (state machine)

```
DOMContentLoaded
  → waitForPackages → init (FM, SC, ScreenLayout, VT, ProgressBar, TransitionScreen, PreviewScreen)
  → preloadAllAudio
  → register message listener
  → send game_ready
  → setupGame()
      → injectGameHTML()  (scaffolds cluePanel/hexGrid/pool/actionBtn)
      → renderInitialState() (paints Round 1 hexes non-interactive behind preview)
      → previewScreen.show({ onComplete: startGameAfterPreview })
  onComplete:
  → startGameAfterPreview(previewData)
      → trackEvent('game_start')
      → showRoundIntro(1)

Round loop (renderRound → CHECK → outcome → advance):
  showRoundIntro(n)
    → TransitionScreen "Round n — Variant B{n}"
    → enterGameplay(n)
      → renderRound() (interactive)
        → buildRoundDOM(round, interactive=true)
        → bindDragHandlers()

  onActionBtnClick():
    if next-mode → advanceAfterFeedback()
    else if isBoardFull → handleCheck()

  handleCheck():
    validateArrangement() → { pass, perTargetPass: [t1, t2, t3], conflictSlots }
    recordAttempt(...)
    progressBar.update(roundsCompleted, 0) FIRST  ← round-complete rule
    if pass → handleCorrectOutcome → advanceAfterFeedback
    else → handleWrongOutcome → morphCheckToNext → revealSolution (1500ms) → auto-advance 3500ms

  advanceAfterFeedback():
    safeStopAllAudio()
    if currentRound >= totalRounds → showVictory()
    else currentRound += 1; showRoundIntro(currentRound)

Victory:
  showVictory()
    → progressBar bump (final)
    → postGameComplete(true) BEFORE audio
    → transitionScreen.show({ stars, buttons: [Play Again / Claim Stars] })
    → SFX + VO sequence

Restart (Play Again): showMotivation → restartGame (NO preview rerun) → showRoundIntro(1)
Claim Stars: showStarsCollected → auto-dismiss → endGame → game_exit postMessage
```

## Screen list
- Preview (PART-039, once per session)
- Round Intro (TransitionScreen — one per round)
- Gameplay (inline, three renders per session)
- Victory (TransitionScreen)
- Ready to improve your score (TransitionScreen — restart)
- Yay stars (TransitionScreen — claim)

No Game Over screen (lives=0).

## Progress bar lifecycle
- Total = 3 rounds, totalLives=3 (match totalRounds to dodge RangeError — GEN-PROGRESSBAR-LIVES).
- Bump FIRST in both correct and wrong outcomes, BEFORE any `await`.
- Victory bump sets final round idx before showVictory renders TransitionScreen.

## Round-by-round content
All three rounds are the "same puzzle" with cosmetic variant differences. See spec.md § fallbackContent for the slot/target/pool/solution structure.

- Round 1 (B1): dark teal-grey targets, 1⃣/2⃣ glyphs.
- Round 2 (B2): dark green targets, 1./2. glyphs.
- Round 3 (B3): dark green targets, 1️⃣/2️⃣ glyphs.

Builder MUST regenerate pool values via constraint solver so each target's ring sum equals the declared target.

## Scoring / stars
- +1 per first-CHECK solve; max 3.
- 3★ = 3 solves, 2★ = 2, 1★ = 1, 0★ = 0.
- `firstCheckSolves` is the canonical counter; displayed as score.

## Interaction pattern
**P6 drag-drop with colour gating** (custom extension).

9 drop paths requiring `resetDragStyling(el)`:
1. Drop-on-empty matching-colour slot (place).
2. Drop-on-occupied matching-colour slot (evict — source = pool).
3. Drop-on-occupied matching-colour slot (swap — source = other slot).
4. Zone-to-zone transfer to empty matching slot.
5. Zone-to-bank return (V5 — most common freeze bug).
6. Drop outside any valid target (cancel).
7. Same-slot no-op.
8. Pointercancel.
9. Colour-mismatch reject (NEW — custom for hexa-numbers: hex returns to source with soft error SFX).

All 9 paths MUST call the single `resetDragStyling(el)` helper.

## Validation per round
```
validateArrangement(round):
  for each target in round.targets:
    sum = 0
    for each slotId in target.ring:
      hexId = gameState.slotMap[slotId]
      hex = pool.find(p => p.id === hexId)
      sum += hex.value
    targetPassed[target.id] = (sum === target.value)
  conflictSlots = union of rings of any failed target
  return { pass: allTargetsPassed, perTarget: targetPassed, conflictSlots }
```

## Feedback timing
- Correct: `await Promise.all([ sound.play('correct_sound_effect'), setTimeout(1500) ])` then fire-and-forget `playDynamicFeedback` then `advanceAfterFeedback`.
- Wrong: `await Promise.all([ sound.play('incorrect_sound_effect'), setTimeout(1500) ])` then fire-and-forget TTS, then `morphCheckToNext`, then reveal solution at 1500ms, auto-advance at 3500ms.
- Drop micro SFX: fire-and-forget only.

## PART flags required
PART-001, PART-002, PART-004, PART-005, PART-007, PART-008, PART-009, PART-010, PART-017, PART-019, PART-021, PART-023, PART-024, PART-025, PART-027, PART-033 (drag), PART-039 (preview), PART-042 (signals).

No PART-006 (no timer).
