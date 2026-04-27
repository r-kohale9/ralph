# Pre-Generation Plan: Equivalent Fractions Matching

**Game ID:** add-list-friendly-pairs
**Archetype:** Single-MCQ Tap (#1) — Shape 2 (Multi-round, with lives)
**Bloom:** L2 Understand
**Interaction:** P1 tap-interaction (one of three cards)
**Rounds:** 9 (S1: R1-3, S2: R4-6, S3: R7-9)
**Lives:** 3
**Timer:** None
**PreviewScreen:** YES

---

## 1. Screen Flow

```
DOMContentLoaded
  → setupGame() → previewScreen.show() (with pre-rendered Round 1 scaffold behind it)
    → onComplete → startGameAfterPreview()
      → showRoundIntro(1) → "Round 1" transition
        → enterGameplay(1) → renderRound()
          → tap card → handleAnswer(optionId)
            → correct: +1 score, awaited SFX, FAF TTS → advanceAfterFeedback()
            → wrong: lives -= 1, awaited SFX, FAF TTS → advanceAfterFeedback() or showGameOver()

Terminal:
  N==9 or lives==0 → showVictory() / showGameOver() → game_complete postMessage BEFORE audio
    → button taps → showMotivation() (Play Again) or showStarsCollected() (Claim Stars)
      → restartGame() or postMessage game_exit
```

**Shape:** Shape 2 Multi-round with lives and game-over path.

**Changes from canonical default:** None — this is the default archetype pattern. Wrong tap decrements lives; at 0 lives the run ends in game_over; otherwise advance to next round.

---

## 2. Round-by-Round Breakdown

Every round uses a single tap on one of three cards. Content per round:

| R | Stage/Type | Target | correctId / kind | Options (3 cards) |
|---|------------|--------|------------------|-------------------|
| 1 | S1 / A | 1/2 | `o_half_rect` fraction | rect 1/2, rect 1/3, circle 1/4 |
| 2 | S1 / A | 1/4 | `o_quarter_circle` fraction | circle 1/4, rect 1/2, rect 3/4 |
| 3 | S1 / A | 3/4 | `o_threeq_rect` fraction | rect 3/4, rect 1/4, rect 2/4 |
| 4 | S2 / B | 2/3 | `o_twothirds_rect` fraction | rect 2/3, rect 1/3, rect 3/3 |
| 5 | S2 / B | 3/6 | `o_threesix_hex` fraction | hex 3/6, hex 2/6, hex 4/6 |
| 6 | S2 / B | 2/4 | `o_twoq_rect` fraction | rect 2/4, rect 1/4, rect 3/4 |
| 7 | S3 / C | 1/2 (equivalent) | `o_twoq_rect_equiv` fraction | rect 2/4, rect 3/4, rect 1/3 |
| 8 | S3 / pattern | "□ ○ △ □ ○ ?" | `o_tri` pattern | triangle, square, circle |
| 9 | S3 / C | 5/8 | `o_fiveeight_rect` fraction | rect 5/8, rect 3/8, rect 6/8 |

All rounds use Pattern P1 tap with the exact same `handleAnswer(optionId)` entry.

---

## 3. Tap Interaction Logic

**Event:** Delegated click on `#optionsRow` → `closest('.option-card[data-option-id]')`.
**Guards (top of handler):**
1. `gameState.isProcessing || gameState.gameEnded` → return.
2. Set `isProcessing = true` BEFORE any await.
3. Resolve the tapped optionId → look up round.correctId.
4. Add `.selected-correct` or `.selected-wrong` class.
5. On wrong: also add `.correct-reveal` to the card with id===round.correctId.

**Touch/mouse parity:** Pointer Events not required — a single click is sufficient and portable. `touch-action: manipulation` on cards to suppress 300ms delay.

---

## 4. State Machine

`gameState.phase`: `'start_screen'` → `'round_intro'` → `'gameplay'` → `'round_intro'` … → `'results'` / `'game_over'`.

Transitions:
- `DOMContentLoaded` → setupGame → preview → `startGameAfterPreview()` → `showRoundIntro(1)`.
- Inside `showRoundIntro(n)`: phase=`round_intro`, show transition, onMounted fires rounds SFX → hide transition → `enterGameplay(n)`.
- `enterGameplay(n)` → phase=`gameplay`, roundStartTime=Date.now(), renderRound().
- Tap correct: score+=1, syncDOM, `progressBar.update(n, lives)` FIRST, awaited SFX (Promise.all 1500ms), FAF TTS, advance.
- Tap wrong: lives-=1, syncDOM, progressBar.update FIRST, awaited SFX (1500ms), FAF TTS; if lives<=0 → showGameOver; else advance.
- After round 9 correct → showVictory.

**Validator:** Pure `optionId === round.correctId`.

---

## 5. Scoring & Progression Logic

- Points: +1 per correct first attempt. Max 9.
- Lives: 3. Any wrong → -1. At 0 → game_over.
- Stars: from firstTryCorrect count (≥8=3, ≥5=2, ≥1=1, 0=0).
- ProgressBar: `update(currentRound, livesRemaining)` called FIRST in round-complete handler (MEMORY.md rule).

---

## 6. Feedback Patterns

Standard L2 Case 4 (correct, single-step) and Case 5 (wrong, single-step) from feedback/SKILL.md, verbatim:

| Event | FM call | Subtitle | Await? | After |
|-------|---------|----------|--------|-------|
| Correct tap | `Promise.all([sound.play('correct_sound_effect', {sticker}), setTimeout(1500)])` then `.playDynamicFeedback({audio_content, subtitle, sticker}).catch(...)` FAF | "Exactly! That's `<fraction>`." | SFX: yes. TTS: no (FAF) | advance |
| Wrong tap | `Promise.all([sound.play('incorrect_sound_effect', {sticker}), setTimeout(1500)])` then FAF TTS | "Not quite — this is `<target>`." | SFX: yes. TTS: no | advance or game_over |
| Round N intro | TransitionScreen with onMounted `rounds_sound_effect` + sticker | — | onMounted awaits | auto-advance |
| Victory | render FIRST, `game_complete` BEFORE audio, then awaited `victory_sound_effect` + dynamic VO | "Yay! `<stars>` stars!" | yes | CTA |
| Game Over | render FIRST, `game_complete` BEFORE audio, awaited game-over SFX + VO | "You ran out of lives!" | yes | CTA |

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, progressBar: true, transitionScreen: true } })`
- `previewScreen.show({ instruction, audioUrl, showGameOnPreview: false, timerConfig: null, timerInstance: null, onComplete })` as LAST step of setupGame.
- `previewScreen.destroy()` only in `endGame()`.
- `restartGame()` does NOT re-call preview.
- `VisibilityTracker` with popupProps (never custom pause overlay).
- `TimerComponent`: NOT used.
- `progressBar.update(currentRound, livesRemaining)` FIRST in round-complete.
- `FeedbackManager` handles ALL audio; preload correct_sound_effect, incorrect_sound_effect, rounds_sound_effect, victory_sound_effect, game_complete_sound_effect, sound_game_over, sound_bubble_select, tap_sound.
- `syncDOM()` at every phase change. `#app` data-phase, data-score, data-round, data-lives.
- `recordAttempt` per tap with all 12 fields.
- `game_complete` fires exactly once, BEFORE audio, on both victory AND game_over.
- TransitionScreen `stars` vs `icons` mutually exclusive (Victory uses stars; Game Over/Motivation/Round use icons).
- Standalone fallback: top-level `setTimeout(…, 2000)` independent of waitForPackages.
- `data-testid`: `option-<id>`, `target-fraction`, `btn-check`? No — no CHECK button; this is a tap game.

---

## 8. Screens (mobile 375x667)

### 8.1 PreviewScreen
Instruction: `<p><b>Match the fraction!</b><br>Look at the fraction and tap the picture that shows it shaded.</p>`
Audio text: "Look at the fraction and tap the picture that matches."

### 8.2 Round N intro
Icon: `['🧩']`, title: "Round N".

### 8.3 Gameplay
Layout top-to-bottom:
1. Progress bar + hearts (CDN).
2. Prompt: "Choose the picture that matches the fraction." (for pattern round: "Pick the shape that completes the pattern.")
3. Target fraction large (vertical num / den) or pattern strip.
4. Row of 3 option cards (equal width, shape centered).
5. Safe-area padding at bottom.

### 8.4 Victory
stars: N, title "Victory 🎉", subtitle "You matched `<n>` of 9!", buttons Claim Stars (and Play Again if stars<3).

### 8.5 Motivation / Stars Collected / Game Over — canonical templates.

---

## 9. Round Presentation Sequence
1. Fade-in prompt + target fraction + cards (350ms).
2. No per-round instruction banner (preview already covered it; target fraction IS the prompt per PART-039 single-instruction rule).
3. Gameplay reveal: cards become tappable; isProcessing=false.

---

## 10. Ambiguity Resolutions

| Ambiguity | Resolution |
|-----------|-----------|
| Hex vs rect for "thirds" | Rect (3 cols, N shaded) — easiest to read on small screens; hex reserved for "sixths" |
| Equivalence round framing | Target 1/2, correct option 2/4 (labeled as 2/4). TTS names equivalence. |
| Pattern round | One round (R8), uses same tap handler; card renderer switches on `kind:'pattern'` |
| Fraction card label | Show `num/den` text under each shape so students can verify the numeral |

---

## 11. Cross-Validation
- 5 screens: PreviewScreen, Round-N intro, Gameplay, Victory, Game Over (+ Motivation, Stars Collected as sub-screens).
- Every feedback case maps to state transition in §4.
- firstTryCorrect counter feeds stars.
- progressBar.update called FIRST in round-complete (MEMORY rule).
- recordAttempt once per tap with 12 fields.
- game_complete fires once, BEFORE audio, on victory AND game_over.
