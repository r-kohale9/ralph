# Default Multi-Round Flow

This is the canonical multi-round default. Every rounds-based spec starts from this diagram and applies customizations on top — never a rewrite. If the user description has no rounds and is a single question, use Shape 1 (Standalone) from `shapes.md` instead.

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game       │
│          │        │ (trans.) │        │ (trans.,     │ (after  │ (round N)  │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │ 🔊 prompt  │
│   audio  │        │    VO    │        │ 🔊 "Round N" │         │    / TTS   │
└──────────┘        └──────────┘        └──────────────┘         └─────┬──────┘
                                                ▲                      │ player answers
                                                │                      ▼
                                                │            ┌─────────────────────┐
                                                │            │ Feedback (2s, on    │
                                                │            │ same game screen)   │
                                                │            │ ✓ 🔊 sound_correct  │
                                                │            │ ✗ 🔊 sound_life_lost│
                                                │            └─────────┬───────────┘
                                                │                      │
                              ┌─────────────────┴─────┬────────────────┼──────────────┐
                              │                       │                               │
                        wrong AND lives = 0   correct AND more   correct AND last round won
                              │                rounds            │
                              ▼                  (loops back     ▼
                   ┌────────────────────┐        to Round N+1     ┌────────────────────┐
                   │ Game Over (status) │        intro)           │ Victory (status)   │
                   │ 🔊 sound_game_over │                         │ 1–3★               │
                   └─────────┬──────────┘                         │ 🔊 sound_game_     │
                             │ "Try Again"                        │    victory →       │
                             ▼                                    │    vo_victory_     │
                   ┌──────────────────┐                           │    stars_N         │
                   │ "Ready to        │                           └──────┬─────┬───────┘
                   │  improve your    │
                   │  score?"         │
                   │ (trans., tap)    │
                   │ 🔊 motivation VO │
                   │ [I'm ready]      │
                   └────────┬─────────┘
                            │ tap
                            ▼
                   restart from Round 1
                   (skips Preview + Welcome)
                                                                         │     │
                                                            "Play Again" │     │ "Claim Stars"
                                                            (only if     │     │
                                                             1–2 ★)      ▼     ▼
                                                   ┌──────────────────┐  ┌──────────────────────┐
                                                   │ "Ready to        │  │ "Yay, stars          │
                                                   │  improve your    │  │  collected!"         │
                                                   │  score?"         │  │ (trans., auto,       │
                                                   │ (trans., tap)    │  │  no buttons)         │
                                                   │ 🔊 motivation VO │  │ 🔊 stars-collected   │
                                                   │ [I'm ready]      │  │    sound + ✨ star   │
                                                   └────────┬─────────┘  │    animation         │
                                                            │ tap        └──────────┬───────────┘
                                                            ▼                       │ auto, after
                                                   restart from Round 1             │ animation / sound
                                                   (skips Preview + Welcome)        ▼
                                                                                   exit
```

Retry paths covered by this diagram:
- **Play Again** after a Victory with fewer than 3★ — routes through "Ready to improve your score?" and restarts from Round 1 (skipping Preview + Welcome).
- **Claim Stars** after any Victory — routes through "Yay, stars collected!" and exits after the star animation / sound.
- **Try Again** after Game Over — routes through "Ready to improve your score?" and restarts from Round 1 (skipping Preview + Welcome).

**Progress bar:** visible on every screen except Preview. Position: top of game body, below the fixed preview header (owned by ScreenLayout + ProgressBarComponent — never authored at the bottom). State is preserved through Game Over so the student sees their final state (prior progress + 0 hearts). Reset to the start-at-0 state fires on the **restart-path entry** — not on any one specific screen. In the default flow (where the "Ready to improve your score?" transition exists) the reset is placed on that transition's `onMounted` so the bar visibly resets while the student reads the screen; this covers both Game Over `Try Again` and <3★ Victory `Play Again`. If a spec customizes the flow to skip Motivation (so Try Again / Play Again routes directly to Round 1), the reset is instead placed as the first runtime action of `restartGame()`. For safety, `restartGame()` always calls `update(0, totalLives)` — the two calls are idempotent — so the invariant holds regardless of flow shape. Counter increments on correct feedback (animates during the ✓ feedback window), not on round entry. See `alfred/skills/game-building/reference/flow-implementation.md` § "Restart-path reset — placement by flow shape" for the placement table.

**AnswerComponent insertion (PART-051) — applies UNLESS the spec declares `answerComponent: false` (creator-only opt-out; no LLM step may auto-default this flag).** The celebration beat (Stars Collected yay + `show_star` animation) plays FIRST. AFTER the animation, the Stars Collected screen auto-hides and the `Correct Answers!` carousel appears with the FloatingButton('next'). The chain is:

```
final-round feedback
        │
        ▼
"Yay, stars collected!"  ◀── celebration beat
(TransitionScreen, persist: true, buttons: [])
   onMounted:
     await sound.play('victory_sound_effect')
     window.postMessage({type:'show_star', ...})   ← star animation
     setTimeout(() => {
       showAnswerCarousel()                         ← hand-off; TS stays mounted
     }, ~1500)
        │
        ▼
┌──────────────────────────────────┐
│ Correct Answers carousel         │
│ (PART-051, AnswerComponent)      │
│ • 1 slide per round              │
│ • 1 slide for standalone w/ 1    │
│   answer (nav disabled)          │
│ • N slides for standalone w/ N   │
│   answers                        │
│ • renders only evaluated DOM     │
│   (drop-zones in solved state,   │
│   solved grid, correct chips,    │
│   etc. — NOT the input bank)     │
│ • FloatingButton 'next' revealed │
│   alongside this card            │
└──────────┬───────────────────────┘
           │ tap Next (single-stage exit)
           ▼
   answerComponent.destroy()
   postMessage({ type: 'next_ended' })
   previewScreen.destroy()
   floatingBtn.destroy()
```

The Stars Collected screen is the celebration beat that auto-hands-off to AnswerComponent — it is NOT terminal in the AnswerComponent flow. Any "Claim Stars" button on a Victory transition routes to `showStarsCollected()` (NOT directly to the answer-reveal). The Next click is single-stage — by the time it appears, all celebration screens have already played. See `alfred/skills/game-planning/SKILL.md` Step 2e and `alfred/parts/PART-051.md` for the full integration contract.
