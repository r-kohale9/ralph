# Game Flow: Hexa Numbers

## One-liner

The student decomposes small 2-digit targets (40–90 range) by dragging 13 numbered hexagons (6 blue, 7 white) into a colour-gated honeycomb so each of three overlapping target rings sums to its target, then taps a single CHECK to commit the whole board.

## Shape

**Shape:** Shape 2 Multi-round (3 rounds per session, one full set; restart cycles A → B → C → A).

## Changes from default

- **Delete the `Game Over` branch and its `Try Again` motivation transition** — `totalLives: 0`, so Game Over is unreachable. The wrong path on the final-round CHECK routes directly to Victory (with possibly 0★).
- **Replace the inline-feedback Feedback block** with the Board-Puzzle CHECK feedback block: per-target tick/cross verdict on the three target hexes, red glow on slots in any failing ring (~1.5 s), then a ~2.5 s reveal animation that glides each pool/placed hexagon to its canonical slot before auto-advance.
- **CHECK CTA is the FloatingButton in `'submit'` mode (PART-050)**, anchored fixed-bottom (`.mathai-fb-btn-primary`). Disabled (`floatingBtn.setSubmittable(false)`) until all 13 slots hold a hexagon, then enabled. Re-evaluated after every drop / pickup.
- **Per-round drag-and-drop interaction (P6)** is the input model — `@dnd-kit/dom@beta` via `https://esm.sh/@dnd-kit/dom@beta`, called from MAIN CONTEXT during build (per CLAUDE.md routing table). Pool hexagons are draggables, slot hexagons are droppables, the colour rule is a drop-acceptance predicate.
- **AnswerComponent (PART-051) reveals after Stars Collected** as 3 identical slides — each renders the canonical solved board (every slot filled with its set's canonical pool value, every target showing a green tick); pool tray is omitted on the answer slide.
- **Round-set cycling A → B → C → A** on `restartGame()` — `gameState.setIndex` increments BEFORE `resetGameState()` is called inside `restartGame()`, then the round list is re-sliced from `fallbackContent.rounds` filtered by `set === SETS[setIndex]`.

## Flow Diagram

```
┌──────────┐  tap   ┌──────────┐  tap   ┌──────────────┐  auto   ┌──────────────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Round N      ├────────▶│ Game (round N)       │
│ 🔊 prev  │        │ (trans.) │        │ (trans.,     │ (after  │ • board: 3 targets   │
│   audio  │        │ 🔊 welc. │        │  no buttons) │  sound) │ • 13 slot hexes      │
│ (PART-039)        │    VO    │        │ 🔊 "Round N" │         │ • pool tray (6+7)    │
└──────────┘        └──────────┘        └──────────────┘         │ • CHECK (FloatingBtn │
                                                ▲                │   'submit', disabled │
                                                │                │   until 13 placed)   │
                                                │                └──────────┬───────────┘
                                                │                           │ tap CHECK
                                                │                           ▼
                                                │             ┌──────────────────────────────┐
                                                │             │ Per-target tick/cross.       │
                                                │             │ Pass→neutral. Fail→red glow  │
                                                │             │ on every slot in failing ring│
                                                │             │  (~1.5 s).                   │
                                                │             │ ALL-PASS path:               │
                                                │             │  • progressBar.update(N,0)   │
                                                │             │    [FIRST]                   │
                                                │             │  • green flash on all slots  │
                                                │             │    (~600 ms)                 │
                                                │             │  • await sound_correct +     │
                                                │             │    celebrate sticker         │
                                                │             │  • await TTS "Great! Every   │
                                                │             │    ring adds up to its       │
                                                │             │    target."                  │
                                                │             │ ANY-FAIL path:               │
                                                │             │  • progressBar.update(N,0)   │
                                                │             │    [FIRST]                   │
                                                │             │  • red glow ~1.5 s           │
                                                │             │  • reveal animation: each    │
                                                │             │    hex glides to canonical   │
                                                │             │    slot (~2.5 s)             │
                                                │             │  • await sound_life_lost +   │
                                                │             │    sad sticker               │
                                                │             │  • await TTS "Almost! Here's │
                                                │             │    how the rings should add  │
                                                │             │    up."                      │
                                                │             └─────────┬────────────────────┘
                                                │                       │
                                                │                 ┌─────┴────────┐
                                                │                 │              │
                                                │           more rounds     last round done
                                                │                 │              │
                                                │                 ▼              ▼
                                                │       (loop to Round N+1)  ┌────────────────────┐
                                                │       through Round Intro  │ Victory (status)   │
                                                │                            │ 0–3★               │
                                                │                            │ 🔊 sound_game_     │
                                                │                            │    victory →       │
                                                │                            │    vo_victory_     │
                                                │                            │    stars_N         │
                                                │                            │ buttons:           │
                                                │                            │  • <3★ → [Play     │
                                                │                            │    Again, Claim    │
                                                │                            │    Stars]          │
                                                │                            │  • 3★  → [Claim    │
                                                │                            │    Stars]          │
                                                │                            └──────┬─────┬───────┘
                                                │                                   │     │
                                                │                      "Play Again" │     │ "Claim Stars"
                                                │                      (only if     │     │ (always)
                                                │                       0–2★)       ▼     ▼
                                                │              ┌──────────────────┐  ┌──────────────────────┐
                                                │              │ "Ready to        │  │ "Yay! 🎉             │
                                                │              │  improve your    │  │  Stars collected!"   │
                                                │              │  score? ⚡"      │  │ (trans., persist,    │
                                                │              │ (trans., tap)    │  │  no buttons)         │
                                                │              │ 🔊 motivation VO │  │ onMounted:           │
                                                │              │ [I'm ready! 🙌]  │  │  • await sound_      │
                                                │              │ onMounted:       │  │    stars_collected   │
                                                │              │  progressBar.    │  │  • postMessage       │
                                                │              │  update(0,0)     │  │    {type:'show_star'}│
                                                │              │  (restart-path   │  │  • setTimeout(~1500) │
                                                │              │   reset)         │  │    showAnswer        │
                                                │              └────────┬─────────┘  │    Carousel()        │
                                                │                       │ tap        └──────────┬───────────┘
                                                │                       ▼                       │ auto handoff
                                                └─── restartGame()                              │  (TS persists
                                                     • setIndex = (setIndex + 1) % 3            │   as backdrop)
                                                     • resetGameState()                         ▼
                                                     • re-slice rounds for SETS[setIndex]    ┌──────────────────────────┐
                                                     • renderRound() for round 1             │ Correct Answers carousel │
                                                                                             │ (PART-051,                │
                                                                                             │  AnswerComponent)         │
                                                                                             │ • 3 slides (1 per round)  │
                                                                                             │ • each slide renders      │
                                                                                             │   the canonical solved    │
                                                                                             │   board for the played    │
                                                                                             │   set (no pool tray, no   │
                                                                                             │   drag affordances, every │
                                                                                             │   target shows ✓)         │
                                                                                             │ • FloatingButton          │
                                                                                             │   .setMode('next')        │
                                                                                             │   appears alongside       │
                                                                                             └──────────┬────────────────┘
                                                                                                        │ tap Next
                                                                                                        ▼  (single-stage)
                                                                                          answerComponent.destroy()
                                                                                          previewScreen.destroy()
                                                                                          floatingBtn.destroy()
                                                                                          postMessage{type:'next_ended'}
                                                                                                        │
                                                                                                        ▼
                                                                                                       exit
```

Retry / branch paths covered:
- **Play Again** after a Victory with fewer than 3★ — routes through "Ready to improve your score? ⚡" motivation transition → `restartGame()` → restart from Round 1, **skipping Preview + Welcome**. Round-set cycles A → B → C → A.
- **Claim Stars** after any Victory (0★ included) — routes through "Yay! Stars collected!" → AnswerComponent carousel → Next → exit.
- **Try Again / Game Over branch DELETED** — `totalLives: 0` makes lives-driven Game Over unreachable; ANY-FAIL CHECK on the last round still routes to Victory (possibly 0★).

## Stages

| Stage | Round | Difficulty | Content description |
|-------|-------|------------|---------------------|
| Stage 1 | R1 (Variant B1) | First exposure (analysis) — student meets the puzzle for the first time | Active set's canonical puzzle (Set A R1 ships first; restart cycles to Set B R1, then Set C R1, then back to Set A R1). 3 dark teal-grey targets with sun-burst glyph, 13 numbered hexagons (6 blue place-value heavies, 7 white place-value lights). Student must solve from scratch. |
| Stage 2 | R2 (Variant B2) | Fluency repeat (recall + verify) — same puzzle as R1 | Identical puzzle to R1: same target triple, same pool values, same canonical placement. Cosmetic only: dark green targets with leaf glyph. Student who solved R1 should solve R2 quickly. |
| Stage 3 | R3 (Variant B3) | Mastery repeat (automatic recall) — same puzzle as R1 | Identical puzzle to R1: same target triple, same pool values, same canonical placement. Cosmetic only: dark green targets with star glyph. Final fluency repeat — solving from memory. |

Notes:
- **Within-set fluency design.** A student who solves R1 will (per spec) solve R2 and R3 trivially. This is the explicit design — repetition replaces the lives mechanic as the iteration cushion. Final star count is therefore strongly bimodal (typical ends are 0★ or 3★).
- **Round-set cycling axis.** The spec ships `rounds.length === 9` (Sets A, B, C × 3 rounds each). Per session, only 3 rounds are active — the slice for `set === SETS[gameState.setIndex]`. First play: Set A. After Play Again: Set B (different target triple, different canonical placement). After second Play Again: Set C. Fourth play: back to Set A. The `setIndex` increment happens BEFORE `resetGameState()` inside `restartGame()` so the new round-slice is in place before round 1 renders.
- **Same canonical placement within a set.** All 3 rounds of one set share the SAME `correctPlacement` and the SAME `answer` payload (cosmetic-only variant). The build step MUST NOT regenerate puzzles per round.

## Screen inventory (forward reference for screens.md)

This game-flow.md enumerates the screens that screens.md MUST wireframe. Every entry below is a required render target — game-building MUST NOT omit one and MUST NOT add an unlisted one.

| # | Screen | data-phase / component | Notes |
|---|--------|------------------------|-------|
| 1 | Preview | `start` (PreviewScreenComponent, PART-039) | `previewInstruction` HTML (3 paragraphs), `previewAudioText` TTS, `showGameOnPreview: false`. Tap Start → Welcome. |
| 2 | Welcome | TransitionScreen | Game-specific welcome VO. Tap → first Round Intro. |
| 3 | Round Intro × 3 (R1, R2, R3) | TransitionScreen, no buttons (CASE 2 Variant A — auto-advancing) | Title `"Round 1"` / `"Round 2"` / `"Round 3"`. Sequential audio: round SFX awaited → round VO awaited. Then auto-advance to Game (Round N). |
| 4 | Game (Round N) | `gameplay` | Persistent fixtures: PreviewScreen header (top, fixed), ProgressBar (below header). Board area (3 targets + 13 slots), pool tray (2 rows: blue 6 + white 7), FloatingButton CHECK (fixed bottom, primary slot). |
| 5 | Round-Complete feedback (in-place on Game screen) | overlay state on `gameplay` | Per-target tick/cross on targets, red glow on failing-ring slots, optional reveal animation, then auto-advance — NOT a separate screen, just the `gameplay` screen's terminal state for round N. |
| 6 | Victory | TransitionScreen | Title `"Victory 🎉"`. Subtitle game-specific (`"You solved {N} of 3 rings!"` where `N = gameState.score`; `"Great work — let's try a new puzzle!"` for 0★). Stars row. Buttons conditional on `gameState.stars` (see Feedback table below). |
| 7 | Motivation ("Ready to improve") | TransitionScreen | Reached via Play Again (only if 0–2★). Title `"Ready to improve your score? ⚡"`. Single CTA `"I'm ready! 🙌"` → `restartGame()`. `onMounted` calls `progressBar.update(0, 0)` (restart-path reset). |
| 8 | Stars Collected | TransitionScreen, persist:true, buttons:[] | Title `"Yay! 🎉\nStars collected!"`. `onMounted` plays `sound_stars_collected` (awaited), fires `show_star` postMessage, `setTimeout(~1500)` → `showAnswerCarousel()`. Does NOT call `transitionScreen.hide()` in onMounted — it stays mounted as the celebration backdrop. |
| 9 | Answer Carousel | AnswerComponent (PART-051), revealed over Stars Collected backdrop | 3 slides (one per played round); each slide renders the active set's canonical solved board with every target showing ✓. Pool tray and drag affordances are NOT rendered on answer slides. FloatingButton's `setMode('next')` fires alongside `answerComponent.show(...)`. |

There is NO `game_over` screen (lives = 0). The validator's standard game_over template does not apply.

## Stage table → round-flow mapping

screens.md will draw one Game wireframe (variants are cosmetic-only — same board topology, same slot positions, same pool tray layout, only target colour/glyph + FloatingButton remain identical). round-flow.md will document the SAME `renderRound()` function path for all 3 rounds, parameterized by `gameState.currentRound` to pick the right `skin` (teal-grey + sun-burst | green + leaf | green + star) and the right round object from the active set's slice.

## Round-set cycling logic (canonical reference)

`gameState` carries:
- `setIndex: 0 | 1 | 2` — index into `SETS = ['A', 'B', 'C']`. Initial value: `0` (Set A on first play).
- `activeRounds: round[]` — the 3 round objects from `fallbackContent.rounds.filter(r => r.set === SETS[setIndex])`. Recomputed inside `resetGameState()` after `setIndex` is set.
- `currentRound: 1 | 2 | 3` — index into `activeRounds` (1-based for display; convert to 0-based for array access).
- `score: 0..3` — count of first-CHECK passes in this session.
- `stars: 0..3` — `score` itself (1:1 mapping; see scoring.md).

`restartGame()` (called from Motivation's `[I'm ready! 🙌]` button) MUST execute in this order:
1. `gameState.setIndex = (gameState.setIndex + 1) % 3`. **This MUST happen BEFORE `resetGameState()`** so the new round-slice is in place.
2. `resetGameState()` — sets `currentRound = 1`, `score = 0`, `stars = 0`, `attempts = []`, `isProcessing = false`; recomputes `activeRounds` from the new `setIndex`.
3. `progressBar.update(0, 0)` — safety-net reset (Motivation's `onMounted` already did this; idempotent).
4. `renderRound()` — paints Game (Round 1) directly. **Skips Preview + Welcome** per the default flow's restart path.

A 4th play wraps `setIndex` from `2 → 0` (Set C → Set A). Validator `GEN-ROUNDSETS-MIN-3` passes because `rounds.length === 9` and 3 distinct sets exist.

## Lives handling (explicit absence)

This game has `totalLives: 0`. The plan documents the absence as follows so build-step does not accidentally re-introduce lives:

- **No `lives` field rendered in the preview header** — the score / star slot remains, but the heart-row is suppressed.
- **No `progressBar.update(round, lives)` second-arg variation** — every call passes `0` for lives (`progressBar.update(N, 0)`) because there are no hearts to draw.
- **No Game Over branch.** `endGame(success)` always routes through `showVictory()` regardless of round outcome. The `success` parameter is informational only (used to pick the Victory subtitle for 0★ vs ≥1★).
- **No Try Again motivation reachable from Game Over.** The Motivation transition is only reachable via `Play Again` on a <3★ Victory.
- **No life-loss SFX gating on `lives === 0`** (feedback's `sound_life_lost` plays as a cosmetic on ANY-FAIL CHECK regardless of life count, per spec — "lives = 0 makes 'life lost' a cosmetic SFX, not a state mutation").

## Scoring logic (forward reference for scoring.md)

| Trigger | Score effect |
|---------|--------------|
| Round N CHECK with all-3-targets pass | `gameState.score += 1` (first and only CHECK per round; max +1 per round) |
| Round N CHECK with any-target fail | no score change (round forfeited; reveal animation runs, advance) |

**Star mapping (1:1 with score, NOT percentage-based):**

| `gameState.score` | `gameState.stars` | Victory subtitle |
|-------------------|-------------------|------------------|
| 0 | 0 | `"Great work — let's try a new puzzle!"` |
| 1 | 1 | `"You solved 1 of 3 rings!"` |
| 2 | 2 | `"You solved 2 of 3 rings!"` |
| 3 | 3 | `"Perfect! You solved all 3 rings!"` |

The default 90/66/33 percentage thresholds DO NOT apply — the spec defines explicit per-count star mapping. scoring.md will repeat this table.

## Feedback patterns per outcome (forward reference for feedback.md)

The build step uses these patterns verbatim. Every entry maps a player-visible event to a FeedbackManager / DOM action.

| Event | Trigger | Action |
|-------|---------|--------|
| **Drop on same-colour slot** | dnd-kit `onDragEnd` resolves to a droppable whose `data-colour` matches the draggable's `data-colour` | `FeedbackManager.sound.play('sound_bubble_pop', { sticker: null }).catch(()=>{})` — fire-and-forget, no TTS, no sticker. Hexagon's DOM moves to the slot (snaps in). Re-evaluate CHECK enable: `floatingBtn.setSubmittable(allSlotsFilled())`. |
| **Drop on wrong-colour slot** | `onDragEnd` resolves to a droppable whose `data-colour` does NOT match | `FeedbackManager.sound.play('sound_bubble_burst', { sticker: null }).catch(()=>{})` — fire-and-forget. Hexagon springs back to its pool position (CSS transform-back, ~250 ms). CHECK state unchanged. CASE 9 (micro-interaction). No life lost. |
| **Drag a placed hexagon back to pool** | `onDragEnd` from a slot back into the pool tray's droppable | `FeedbackManager.sound.play('sound_bubble_burst', { sticker: null }).catch(()=>{})` — fire-and-forget. Hexagon returns to its pool slot (or is appended). Re-evaluate CHECK enable (likely disable). |
| **CHECK with all 3 targets pass (round-complete correct)** | `floatingBtn.on('submit', async () => { ... })` evaluates `evaluateBoard()` → all three target sums match | 1) `gameState.isProcessing = true`; 2) **`progressBar.update(currentRound, 0)` FIRST** (memory: progress_bar_round_complete — must precede any `await` so the bar bumps before SFX/TTS); 3) Add `.target-pass` (green tick) to all 3 target hexes; 4) Flash `.slot-flash-green` on all 13 slots (~600 ms); 5) `gameState.score += 1`; 6) `await FeedbackManager.sound.play('sound_correct_answer', { sticker: STICKER_CELEBRATE })` (CASE 6 round-complete); 7) `await FeedbackManager.playDynamicFeedback({ audio_content: 'Great! Every ring adds up to its target.', subtitle: 'Great! Every ring adds up to its target.', sticker: STICKER_CELEBRATE })`; 8) Push attempt to `gameState.attempts`; 9) Auto-advance: if `currentRound < 3` → `currentRound += 1; renderRoundIntro(currentRound);` else `endGame(true)`. |
| **CHECK with any target fail (round-complete wrong)** | `evaluateBoard()` returns at least one failing target | 1) `gameState.isProcessing = true`; 2) **`progressBar.update(currentRound, 0)` FIRST**; 3) Add `.target-pass` or `.target-fail` to each target hex per its sum; 4) Add `.slot-glow-red` to every slot in any failing target's ring (~1.5 s — `await new Promise(r => setTimeout(r, 1500))`); 5) **Reveal animation:** for each pool/placed hexagon NOT in its canonical slot, animate transform to its `correctPlacement` slot's coordinates over ~2.5 s total (staggered ~190 ms per hex with concurrent overlap, total wall-clock ~2500 ms — `await` the final transition); 6) `await FeedbackManager.sound.play('sound_life_lost', { sticker: STICKER_SAD })` (cosmetic SFX — no actual life decrement because lives = 0); 7) `await FeedbackManager.playDynamicFeedback({ audio_content: 'Almost! Here is how the rings should add up.', subtitle: "Almost! Here's how the rings should add up.", sticker: STICKER_SAD })`; 8) Push attempt with `is_correct: false` and `misconception_tags: [resolveMisconception(boardState)]`; 9) Auto-advance: if `currentRound < 3` → `currentRound += 1; renderRoundIntro(currentRound);` else `endGame(false)`. **No retry within round.** |
| **Round transition (auto-advance, R2 + R3 intro)** | `renderRoundIntro(N)` called from previous round's CHECK handler | TransitionScreen with `title: "Round N"`, `buttons: []` (CASE 2 Variant A — no CTA). `onMounted`: `await FeedbackManager.sound.play('sound_rounds', { sticker: STICKER_NEUTRAL })` → `await FeedbackManager.playDynamicFeedback({ audio_content: 'Round N', subtitle: 'Round N' })`. After both audio steps complete: `transitionScreen.hide(); renderRound(N);`. |
| **Last round complete → Victory** | `endGame(success)` called from R3's CHECK handler (success irrelevant — Victory always renders) | 1) Compute `gameState.stars = gameState.score`; 2) Send `game_complete` postMessage with metrics; 3) `transitionScreen.show({ title: 'Victory 🎉', subtitle: <per-score>, stars: gameState.stars, buttons: <per-stars>, persist: true, onMounted: async () => { await FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE }); await FeedbackManager.playDynamicFeedback({ audio_content: <subtitle>, subtitle: <subtitle>, sticker: STICKER_CELEBRATE }); } })`; 4) `buttons` is `[{ text: 'Play Again', type: 'secondary', action: showMotivation }, { text: 'Claim Stars', type: 'primary', action: showStarsCollected }]` if `stars < 3`, else `[{ text: 'Claim Stars', type: 'primary', action: showStarsCollected }]`. |
| **Tap Play Again** (Victory, 0–2★ only) | TransitionScreen `Play Again` button | Routes to `showMotivation()`: `transitionScreen.show({ title: "Ready to improve your score? ⚡", buttons: [{ text: "I'm ready! 🙌", type: 'primary', action: restartGame }], persist: true, onMounted: async () => { progressBar.update(0, 0); await FeedbackManager.sound.play('sound_motivation', { sticker: STICKER_MOTIVATE }); } })`. Tap CTA → `restartGame()` (cycles set, resets state, skips Preview + Welcome). |
| **Tap Claim Stars** (Victory) | TransitionScreen `Claim Stars` button | Routes to `showStarsCollected()`: `transitionScreen.show({ title: 'Yay! 🎉\nStars collected!', buttons: [], persist: true, styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }, onMounted: async () => { await FeedbackManager.sound.play('sound_stars_collected', { sticker: STICKER_CELEBRATE }); window.parent.postMessage({ type: 'show_star', stars: gameState.stars }, '*'); setTimeout(() => showAnswerCarousel(), 1500); } })`. **Does NOT call `transitionScreen.hide()` in `onMounted`** (memory: feedback_pause_overlay — terminal celebration surface persists as backdrop). |
| **Show Answer Carousel** | `showAnswerCarousel()` fires from Stars Collected `onMounted`'s setTimeout | `answerComponent.show({ slides: buildAnswerSlidesForAllRounds() })` — 3 slides, one per round, each `{ render(container) { renderCanonicalBoard(container, gameState.activeRounds[i].answer); } }`. Then `floatingBtn.setMode('next')`. AnswerComponent appears OVER the still-mounted Stars Collected backdrop. |
| **Tap Next** (FloatingButton 'next' mode, after Answer Carousel revealed) | `floatingBtn.on('next', () => { ... })` | Single-stage exit (memory: AnswerComponent end-game chain is single-stage): `answerComponent.destroy(); previewScreen.destroy(); floatingBtn.destroy(); window.parent.postMessage({ type: 'next_ended' }, '*');`. Iframe tears down. |
| **Visibility hidden / tab switch (CASE 14)** | Browser `visibilitychange` event with `document.hidden === true` | FeedbackManager pauses any in-flight audio. **VisibilityTracker's built-in PopupComponent renders the pause overlay automatically** (memory: feedback_pause_overlay — never custom-build a pause overlay div). Customize ONLY via VisibilityTracker's `popupProps` if needed. |
| **Visibility restored (CASE 15)** | `visibilitychange` with `document.hidden === false` | FeedbackManager resumes audio. VisibilityTracker dismisses its own popup. Gameplay continues. |
| **Audio failure (CASE 16)** | Any `FeedbackManager.sound.play(...)` or `playDynamicFeedback(...)` throws | All audio calls are try/catch wrapped (or `.catch(()=>{})` on fire-and-forget). Visual feedback (tick/cross/red glow/reveal animation/green flash) renders regardless. Game advances normally. |

## CHECK button (FloatingButton, PART-050) — control rules

- **Component:** `FloatingButtonComponent` (PART-050), instantiated once at game-build time, mounted in `ScreenLayout`'s floating-button slot (`slots: { floatingButton: true }`).
- **Test selector:** `.mathai-fb-btn-primary`.
- **Initial mode:** `floatingBtn.setMode('submit')`. Label: `"CHECK"` (override default 'Submit' label via `floatingBtn.setLabel('CHECK')` if API supports, else customise via `submit` mode label).
- **Initial submittable state:** `floatingBtn.setSubmittable(false)`.
- **Visibility predicate:** `setSubmittable(allSlotsFilled())` is re-evaluated after EVERY drop event (drag-end on a same-colour slot, drag-end back to pool). `allSlotsFilled()` returns `true` iff `Object.keys(gameState.placement).length === 13` AND every value is non-null.
- **Submit handler:** registered ONCE: `floatingBtn.on('submit', async () => { if (gameState.isProcessing) return; await handleCheck(); })`.
- **Per-round lifecycle:** between rounds (after auto-advance to `renderRound(N+1)`), the placement state is cleared (`gameState.placement = {}`), all draggables are returned to the pool, `floatingBtn.setSubmittable(false)` is called explicitly to disable CHECK for the new round. Mode remains `'submit'` until `endGame(...)` flips it to `'next'`.
- **End-of-game lifecycle:** mode flips to `'next'` ONLY inside `showAnswerCarousel()` AFTER `answerComponent.show(...)` has rendered. Never inside `endGame()` directly. `floatingBtn.on('next', ...)` is registered ONCE alongside `setMode('next')`. Tap fires the single-stage exit handler above.

## End-of-game beat (canonical sequence)

The end-of-game chain is the AnswerComponent multi-round chain (Step 2e of game-planning/SKILL.md) — the celebration plays FIRST, AnswerComponent appears AFTER:

1. **Final round CHECK handler** evaluates the board → either all-pass or any-fail. Either way, `gameState.score` is finalized and `endGame(...)` is called.
2. **`endGame(success)`** computes `gameState.stars = gameState.score` (1:1), posts `game_complete` with metrics (`{ score, totalQuestions: 3, stars, accuracy: stars/3*100, timeSpent }`), then calls `showVictory()`.
3. **Victory transition** renders with `title: 'Victory 🎉'`, subtitle per `gameState.stars`, `stars: gameState.stars`, conditional buttons array. `persist: true`. `onMounted` plays `sound_game_victory` (awaited) → victory VO (awaited).
4. **`Claim Stars` button action calls `showStarsCollected()`** — never `showAnswerCarousel()` directly. (`Play Again` only on <3★ → `showMotivation()`.)
5. **Stars Collected transition** renders with `title: 'Yay! 🎉\nStars collected!'`, `buttons: []`, `persist: true`, `styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }`. `onMounted`: awaits `sound_stars_collected`, fires `show_star` postMessage (so the host harness can paint star confetti), then `setTimeout(1500) → showAnswerCarousel()`. **Does NOT call `transitionScreen.hide()` in onMounted** — stays mounted as backdrop.
6. **`showAnswerCarousel()`** calls `answerComponent.show({ slides: buildAnswerSlidesForAllRounds() })` (3 slides, one per round, each rendering the canonical solved board for the active set), THEN `floatingBtn.setMode('next')`. Carousel and Next button appear OVER the Stars Collected backdrop.
7. **Single-stage Next exit:** `floatingBtn.on('next', () => { answerComponent.destroy(); previewScreen.destroy(); floatingBtn.destroy(); window.parent.postMessage({ type: 'next_ended' }, '*'); })`. The Stars Collected TransitionScreen tears down with the AnswerComponent (or remains until iframe destruction — runtime indistinguishable). The harness's `next_ended` listener picks up the signal.

## Cross-checks (Step 7)

- ✅ Every screen named in the diagram (Preview, Welcome, Round Intro × 3, Game, Victory, Motivation, Stars Collected, Answer Carousel) has a row in the screen inventory and will get a wireframe in screens.md.
- ✅ Every feedback event (drop-same-colour, drop-wrong-colour, drag-back-to-pool, CHECK-pass, CHECK-fail, round-transition, last-round-victory, play-again, claim-stars, show-answer, tap-next, visibility-hide, visibility-restore, audio-failure) has a FeedbackManager call signature documented above and will get a row in feedback.md.
- ✅ Scoring formula matches state changes: `score += 1` on each all-pass CHECK; `stars = score` (1:1); 0–3★ all route through Victory + Stars Collected + AnswerComponent (no Game Over branch because lives = 0).
- ✅ ProgressBar bumps FIRST inside CHECK handlers (memory: progress_bar_round_complete) — `progressBar.update(currentRound, 0)` precedes any awaited SFX/TTS so the final round shows 3/3 (not 2/3) at Victory time.
- ✅ AnswerComponent reveals AFTER Stars Collected celebration (memory: feedback_pause_overlay — celebration plays first, then carousel; `answerComponent.show(...)` is called ONLY from `showAnswerCarousel()`, never from `endGame()` or from a Victory `Claim Stars` action that bypasses Stars Collected).
- ✅ Pause overlay = VisibilityTracker's PopupComponent (memory: feedback_pause_overlay — never custom-built).
- ✅ Set rotation increments `setIndex` BEFORE `resetGameState()` inside `restartGame()` so the new round-slice is in place before round 1 renders.
- ✅ Within a set, all 3 rounds share the SAME `correctPlacement` and `answer` payload (cosmetic-only variant). `renderRound()` reads `gameState.activeRounds[currentRound - 1]` (which carries the cosmetic skin) and the SHARED canonical placement.
- ✅ FloatingButton in `'submit'` mode for CHECK (PART-050 mandatory per game-archetypes constraint #8); flips to `'next'` mode ONLY inside `showAnswerCarousel()` AFTER `answerComponent.show(...)`.
- ✅ Next click handler is `on('next', ...)` not `on('submit', ...)` (avoiding the bodmas-blitz 2026-04-23 regression).
- ✅ No `function loadRound() { ... }` declarations (memory: feedback_window_loadround_shadow — use `renderRound`).
