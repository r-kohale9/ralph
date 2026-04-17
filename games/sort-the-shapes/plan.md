# Pre-Generation Plan: Sort the Shapes

## Plan summary (5 bullets)

- **Shape 2 multi-round** Sort/Classify game with 8 rounds across 3 stages; archetype default has `lives: 0` but spec overrides to `lives: 3`, so we ADD a `game_over` screen (archetype anti-pattern #3) on top of the default `results`/`victory` branch.
- **Drag-and-drop via pointer events** (NOT HTML5 dragstart — unreliable on iOS); handlers `handleCardPointerDown` / `handleCardPointerMove` / `handleCardPointerUp`, hit-test via `elementFromPoint` on `pointerup`, bucket AABB fallback, reduced-motion fallback replaces bounce/shake with instant snap.
- **Multi-step feedback rule** (per feedback skill): per-drop correct/wrong SFX + sticker are fire-and-forget (NO dynamic TTS per drop); round-complete SFX is awaited; Case 8 skips wrong-SFX when the last life is lost; `recordAttempt` fires BEFORE every FeedbackManager call with `misconception_tag` resolved from `fallbackContent.rounds[n].misconception_tags[card_id][bucket_id]`.
- **Lives are global (3 across the game, NOT per-round)**; stars derived from `roundsCompleted` at `endGame` time: 3★ at 7–8, 2★ at 5–6, 1★ at 1–4, 0★ at 0; `game_complete` postMessage (nested `data`) fires BEFORE game-over/victory audio on BOTH paths (GEN-PM-DUAL-PATH).
- **PreviewScreen renders ONCE on first load only**; on any replay (Try Again / Play Again / motivation → Round 1) we route through the "Ready to improve your score?" motivation transition and skip Preview + Welcome (CLAUDE.md invariant + default-flow.md retry path).

---

## 1. Screen flow

### Screen inventory (with `data-phase`)

| Screen | `data-phase` | CDN component |
|--------|--------------|---------------|
| Preview | `preview` | `PreviewScreenComponent` (PART-039) |
| Welcome / Level | `welcome` | `TransitionScreenComponent` |
| Round N intro (N = 1..8) | `round_intro` | `TransitionScreenComponent` (auto-advance, no CTA) |
| Gameplay | `gameplay` | Custom DnD body + persistent `ProgressBarComponent` + lives row |
| Game Over | `game_over` | `TransitionScreenComponent` |
| Motivation ("Ready to improve your score?") | `motivation` | `TransitionScreenComponent` |
| Victory / Results | `victory` | `TransitionScreenComponent` (with `stars`) |
| Stars Collected | `stars_collected` | `TransitionScreenComponent` (auto-dismiss 2500ms) |

### ASCII flow diagram (Shape 2 canonical, no deltas)

```
┌──────────┐ tap   ┌──────────┐ tap   ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├──────▶│ Welcome  ├──────▶│ Round N      ├────────▶│ Gameplay   │
│ 🔊 prev  │       │ 🔊 welc. │       │ (auto, no    │ (after  │ (round N)  │
│ PART-039 │       │    VO    │       │  buttons)    │  SFX+VO)│ DnD cards  │
└──────────┘       └──────────┘       │ 🔊 "Round N" │         └─────┬──────┘
                                      └──────────────┘               │
                                                 ▲                   │ pointerup
                                                 │                   ▼
                                                 │         ┌────────────────────┐
                                                 │         │ Drop resolved      │
                                                 │         │ recordAttempt →    │
                                                 │         │ FeedbackManager    │
                                                 │         │  (fire-and-forget) │
                                                 │         └────────┬───────────┘
                                                 │                  │
                       ┌─────────────────────────┼──────────────────┼──────────────┐
                       │                         │                  │              │
                 wrong AND lives=0       correct AND cards     wrong AND lives>0  correct AND
                       │                 remaining             OR wrong (card    all cards placed
                       │                 (stay on round;       snaps back; life  (awaited round-
                       ▼                 continue drags)       lost; subtitle    complete SFX)
              ┌────────────────────┐                           1.8s)                │
              │ Game Over          │                                                 │
              │ data-phase=        │                                                 ▼
              │  game_over         │                                       ┌──────────────────┐
              │ game_complete sent │                                       │ if N < 8: Round  │
              │ BEFORE audio       │                                       │  N+1 intro       │
              │ 🔊 sound_game_over │                                       │ if N = 8: Victory│
              └─────────┬──────────┘                                       └────┬─────────┬───┘
                        │ "Try Again"                                            │         │
                        ▼                                                        │         │
              ┌────────────────────┐                          "Play Again"       │         │ "Claim Stars"
              │ Motivation         │                          (only if 1–2★)     │         │ (any ★)
              │ "Ready to improve  │◀────────────────────────────────────────────┘         │
              │  your score? ⚡"   │                                                        │
              │ 🔊 motivation VO   │                                                        │
              │ [I'm ready! 🙌]    │                                                        │
              └────────┬───────────┘                                                        │
                       │ tap                                                                ▼
                       ▼                                                          ┌──────────────────┐
              restart → Round 1                                                   │ Stars Collected  │
              (SKIP Preview + Welcome)                                            │ auto 2500ms      │
                                                                                  │ 🔊 stars_collect │
                                                                                  └────────┬─────────┘
                                                                                           │ auto
                                                                                           ▼
                                                                                  game_exit postMsg
```

### Transition table

| From | To | Trigger | Audio / effect | Notes |
|------|----|---------|----------------|-------|
| Preview | Welcome | Preview CTA tap | stop preview VO | First-load only; skipped on restart |
| Welcome | Round 1 intro | Welcome CTA tap | stopAll → round SFX | First-load only |
| Round N intro | Gameplay (round N) | Auto, after SFX→VO awaited | round intro audio completes | Variant A auto-advance (no CTA) |
| Gameplay | Gameplay (same round) | Wrong drop AND `lives > 0` | bucket red flash 300ms, card snap-back, heart pop, wrong-SFX + sad sticker fire-and-forget, misconception subtitle 1.8s | Round continues; card returns to bank |
| Gameplay | Gameplay (same round) | Correct drop AND cards remain | bucket green flash 200ms, card locks, checkmark badge, correct-SFX + celebrate sticker fire-and-forget | Round continues |
| Gameplay | Round N+1 intro | Correct drop AND all cards placed AND N < 8 | awaited round-complete SFX + sticker, subtitle "Round N complete!", 1.2s auto-advance | `roundsCompleted++` before transition |
| Gameplay | Victory | Correct drop AND all cards placed AND N = 8 | awaited round-complete SFX, then Victory screen renders FIRST, then `game_complete` postMessage, then victory SFX → VO sequential (CTA interruptible) | Both CASE 11 (victory) rules + `roundsCompleted=8` |
| Gameplay | Game Over | Wrong drop AND `lives === 0` | SKIP wrong-SFX (Case 8), red flash only, then Game Over screen renders FIRST, `game_complete` postMessage, then game-over SFX → VO (CTA interruptible) | `roundsCompleted` is whatever was reached |
| Game Over | Motivation | "Try Again" tap | stopAll | |
| Victory | Motivation | "Play Again" tap (only visible when `stars < 3`) | stopAll | |
| Victory | Stars Collected | "Claim Stars" tap | stopAll → stars-collected SFX + star animation | Visible for all star tiers |
| Motivation | Round 1 intro | "I'm ready! 🙌" tap | stopAll → round SFX | SKIP Preview + Welcome |
| Stars Collected | (exit) | Auto after 2500ms | — | `window.parent.postMessage({type:'game_exit'}, '*')` |
| any | Paused overlay | `visibilitychange` hidden | pause all audio + timers | CASE 14 |
| Paused overlay | resume prior screen | Resume CTA | resume audio + timers | CASE 15 |

---

## 2. Round-by-round breakdown

All rounds share: persistent preview header (top), progress bar below header showing `N/8`, lives row with 3 hearts under the progress bar, card bank (top third of body), bucket row (lower 60% of body). `data-phase="gameplay"` throughout; `data-round` = 1..8; `data-lives` = 0..3; `data-score` reflects correct placements.

### Round 1 — Stage 1 / Type A / 2 buckets / 3 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards: `c1 Circle (circle)`, `c2 Square (square)`, `c3 Circle (circle)`. Buckets: `Circles`, `Squares`. Round label "Round 1" shown on round-intro transition (cleared before gameplay reveal). |
| Initial state | `data-phase='gameplay'`, `currentRound=0` (0-indexed) → `round_number=1`, `lives=3`, `score=0`, `cardsPlaced[]=[]`, `cardsRemaining=['c1','c2','c3']`, each bucket DOM container empty (dashed border). |
| Success condition | `cardsPlaced.length === 3` AND every placement `correct: true` OR (any placements were wrong but all correct ones now in buckets — note: spec says card only snaps IN on correct; on wrong it snaps back, so a completed round is always all-correct placements). |
| Failure condition | `lives === 0` at any point during the round. |
| Exit state | Success → `roundsCompleted=1`, awaited round-complete SFX + "Round 1 complete!" subtitle, 1.2s pause, advance to Round 2 intro. Failure → `game_over` phase. |

### Round 2 — Stage 1 / Type A / 2 buckets / 4 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards: `c1 Triangle (triangle_equilateral)`, `c2 Rectangle (rectangle_wide)`, `c3 Triangle (triangle_right)`, `c4 Rectangle (rectangle_tall)`. Buckets: `Triangles`, `Rectangles`. |
| Initial state | `data-round=2`; `cardsRemaining=['c1','c2','c3','c4']`; `lives` unchanged from round end (carries over — CRITICAL: 3 total across whole game). |
| Success | `cardsPlaced.length === 4`. |
| Failure | `lives === 0`. |
| Exit | Same pattern → Round 3 intro. |

### Round 3 — Stage 1 / Type A / 2 buckets / 4 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards: `c1 Oval (oval)`, `c2 Pentagon (pentagon)`, `c3 Circle (circle)`, `c4 Hexagon (hexagon)`. Buckets: `Curved edges`, `Straight edges only`. |
| Initial state | `data-round=3`; `cardsRemaining=['c1','c2','c3','c4']`. |
| Success | all 4 placed. |
| Failure | `lives === 0`. |
| Exit | → Round 4 intro (stage boundary; no special transition — round-intro handles it). |

### Round 4 — Stage 2 / Type B / 3 buckets / 5 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards c1..c5 (Square, Rectangle, Rhombus, Rectangle, Square tilted). Buckets: `Squares`, `Rectangles`, `Rhombuses`. |
| Initial state | `data-round=4`; `cardsRemaining` = all 5; bucket layout switches to 3-column grid. |
| Success | all 5 placed. |
| Failure | `lives === 0`. |
| Exit | → Round 5 intro. |

### Round 5 — Stage 2 / Type B / 3 buckets / 5 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards c1..c5 (Triangle, Square, Pentagon, Trapezoid, Hexagon). Buckets: `Triangles`, `4 sides`, `5+ sides`. |
| Initial state | `data-round=5`. |
| Success / Failure / Exit | as above → Round 6 intro. |

### Round 6 — Stage 2 / Type B / 3 buckets / 5 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards c1..c5 (Regular Pentagon, Irregular Quad, Open L-shape, Equilateral Tri, Scalene Tri). Buckets: `Regular`, `Irregular`, `Not a closed shape`. |
| Initial state | `data-round=6`. |
| Success / Failure / Exit | → Round 7 intro. |

### Round 7 — Stage 3 / Type C / 2 buckets / 5 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards c1..c5 (Square, Rectangle, Rhombus, Equilateral Tri, Scalene Triangle). Buckets: `All sides equal`, `Not all sides equal`. **Type C property-rule round.** |
| Initial state | `data-round=7`; set `gameState.showBucketReview = true` so the round-complete step highlights each card's correct bucket for 2000ms before the 1.2s advance. |
| Success | all 5 placed; then 2000ms bucket-review highlight → 1.2s → Round 8 intro. |
| Failure | `lives === 0`. |
| Exit | → Round 8 intro. |

### Round 8 — Stage 3 / Type C / 2 buckets / 5 cards

| Aspect | Value |
|--------|-------|
| Entry render | Cards c1..c5 (Square, Rhombus, Right Triangle, Equilateral Tri, Rectangle). Buckets: `Has a right angle`, `No right angle`. |
| Initial state | `data-round=8`; `showBucketReview = true`. |
| Success | all 5 placed → 2000ms bucket-review → `roundsCompleted=8` → awaited round-complete SFX → Victory screen renders FIRST → `game_complete` postMessage → victory SFX → VO sequential (CTA interruptible). |
| Failure | `lives === 0` → Game Over (CASE 12). |
| Exit | → Victory OR Game Over. |

---

## 3. Scoring & lives logic

### Mutations per event

| Event | `score` | `lives` | `roundsCompleted` | `stars` | `attempts[]` | `cardsPlaced[]` / `cardsRemaining` |
|-------|---------|---------|-------------------|---------|--------------|-------------------------------------|
| `game_init` | 0 | 3 | 0 | 0 (computed lazily at endGame) | `[]` | seeded from round 1 `fallbackContent` |
| Round N entry (renderRound) | unchanged | unchanged | unchanged | unchanged | unchanged | `cardsPlaced=[]`, `cardsRemaining = round.cards.map(c => c.id)`; `roundStartTime = Date.now()` |
| Correct drop (card c, bucket b) | `score + 1` | unchanged | unchanged | unchanged | push new attempt `{correct:true, misconception_tag:null, ...}` | move `c` from `cardsRemaining` → `cardsPlaced` |
| Wrong drop (card c, bucket b) | unchanged (**NO point penalty**) | `lives - 1` | unchanged | unchanged | push new attempt `{correct:false, misconception_tag: fallbackContent.rounds[N-1].misconception_tags[c][b]}` | unchanged (card stays in bank) |
| Round complete (all placed) | unchanged | unchanged | `roundsCompleted + 1` | unchanged | unchanged | — |
| Lives → 0 | unchanged | 0 | unchanged | compute from `roundsCompleted` | — | — |
| Victory (after round 8) | unchanged | unchanged | 8 | compute from `roundsCompleted` | — | — |
| Replay (motivation → Round 1) | **0** | **3** | **0** | **0** | **`[]`** | reseed from round 1; `cardsPlaced=[]` |

### Star formula (derived at `endGame`, used in `results` + `game_complete.data.metrics.stars`)

```
if (roundsCompleted >= 7) stars = 3
else if (roundsCompleted >= 5) stars = 2
else if (roundsCompleted >= 1) stars = 1
else stars = 0
```

(Matches spec Game Parameters; NOT percentage-based — default star threshold is overridden by spec.)

### Reset semantics

- **Per-round reset (renderRound):** `cardsPlaced`, `cardsRemaining`, `roundStartTime`, per-round DOM. NEVER reset `lives`, `score`, `roundsCompleted`, `attempts`, `misconceptionEvents`, `startTime`.
- **Per-game reset (`restartToRound1` from motivation):** `lives=3`, `score=0`, `roundsCompleted=0`, `currentRound=0`, `attempts=[]`, `misconceptionEvents=[]`, `stars=0`, `startTime = Date.now()`, `gameEnded = false`, `isProcessing = false`, `duration_data` reinitialised. Reseed round 1 content. Do NOT re-show PreviewScreen.

---

## 4. Feedback patterns per event (decision table)

| Event | Visual effect | Audio action | `recordAttempt` call | Subtitle template |
|-------|---------------|--------------|---------------------|-------------------|
| `pointerdown` on card (drag start) | Card `.dragging` → `transform: scale(1.05)` + drop shadow; other cards `.dimmed` (opacity 0.6) | **None** | — | — |
| `pointermove` over valid bucket (hover-valid) | Bucket gets `.hover-valid` class → border becomes solid primary color | **None** | — | — |
| `pointermove` leaves bucket | Remove `.hover-valid` | **None** | — | — |
| `pointerup` inside bucket — CORRECT | Bucket flashes `.flash-correct` (200ms green), card animates into bucket center (snap-correct 250ms), checkmark badge appears, card locks (`pointer-events: none`) | `FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CELEBRATE }).catch(()=>{})` — **fire-and-forget (multi-step rule)** | `recordAttempt(currentRound, {card_id, bucket_id}, true, { misconception_tag: null, is_retry:false, round, type, stage, card, bucket })` — **BEFORE** FeedbackManager call | — (no subtitle per drop) |
| `pointerup` inside bucket — WRONG AND `lives > 1` | Bucket flashes `.flash-danger` (300ms red), ✕ badge briefly appears on bucket, card `.shake-wrong` (500ms) then animates back to bank (snap-back 300ms), one heart gets `.heart-break` (600ms) then removed from DOM, `lives--` | `FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_SAD }).catch(()=>{})` — **fire-and-forget** | `recordAttempt(currentRound, {card_id, bucket_id}, false, { misconception_tag: lookupTag(round, card_id, bucket_id), is_retry: wasPreviouslyAttempted(card_id), round, type, stage })` — **BEFORE** FeedbackManager call | `lookupTag(...)` text rendered in 1.8s misconception subtitle banner below lives bar — e.g. "Rectangles have 4 sides too, but not all equal!" |
| `pointerup` inside bucket — WRONG AND `lives === 1` (last life) | Red flash + card snap-back + heart-break; `lives=0`; **SKIP wrong-SFX entirely (CASE 8)** | **No wrong SFX.** After 600ms visual, call `endGame(true)`: render Game Over screen FIRST → `game_complete` postMessage → `await FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })` → `await FeedbackManager.playDynamicFeedback({ audio_content: "Good effort! Let's try again.", subtitle: "Good effort! Let's try again.", sticker: STICKER_SAD })` (CTA interruptible) | `recordAttempt(...)` with misconception tag — **still recorded** | Game-over screen subtitle "You ran out of lives!"; banner subtitle skipped |
| `pointerup` outside any bucket | Card snap-back to bank (200ms, no life lost, no SFX) | **None** | — | — |
| All cards placed (round complete, N < 8) | Bucket review highlight (Type C only, 2000ms) → `await FeedbackManager.sound.play('all_correct', { sticker: STICKER_CELEBRATE })` → 1200ms delay → Round N+1 intro | Awaited SFX + sticker (CASE 6); no subtitle banner — subtitle lives on round-complete transition line "Round N complete!" shown for 1.2s | — (already recorded per-drop) | `"Round N complete!"` (subtitle in DOM overlay during the 1.2s window) |
| All cards placed (round complete, N = 8) | Results/Victory screen renders FIRST, `game_complete` postMessage sent **before** any victory audio | `await FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })` → `await FeedbackManager.playDynamicFeedback({ audio_content: victorySubtitleByStars(stars), subtitle: victorySubtitleByStars(stars), sticker: STICKER_CELEBRATE })` — CTA interruptible | — | Victory subtitle: `stars===3` → "Perfect sort! 🎉"; `stars===2` → "Great sorting!"; `stars===1` → "Nice effort — keep sorting!" |
| Game over (lives=0) | Game Over screen renders FIRST; `game_complete` postMessage sent | `await FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })` → `await FeedbackManager.playDynamicFeedback({ audio_content: "Good effort! Let's try again.", subtitle: "Good effort! Let's try again.", sticker: STICKER_SAD })` — CTA interruptible | — | Game Over subtitle = `"You ran out of lives!"` (default); banner copy = `"Good effort! Let's try again."` |
| Replay ("Try Again" or "Play Again") | Navigate to Motivation → `restartToRound1()` clears state, reseeds round 1, renders Round 1 intro | `FeedbackManager.sound.stopAll()` + `_stopCurrentDynamic()` then motivation onMounted → `sound.play('sound_motivation', { sticker: STICKER_MOTIVATE })` | — | Motivation title `"Ready to improve your score? ⚡"` |
| Visibility hidden | Render paused overlay with Resume CTA | Pause all static + dynamic audio (CASE 14). No input accepted on gameplay. | — | "Paused" |
| Visibility restored | Dismiss overlay | Resume all audio (CASE 15) | — | — |

Notes on multi-step rule compliance:
- Per-drop feedback is **fire-and-forget** (no `await`, no `isProcessing=true` gate) — student continues dragging the next card while audio plays (CASE 5 / CASE 7 multi-step branch).
- The only **awaited** per-drop action is the misconception subtitle (1.8s `setTimeout`-based banner, not FeedbackManager) — this is a visual banner, not audio blocking, and never prevents the next drag.
- Round-complete SFX IS awaited (CASE 6).
- Victory / Game-over sequences are awaited sequential SFX → VO, CTA interruptible (CASE 11 / CASE 12).

---

## 5. State model

```js
window.gameState = {
  gameId: 'sort-the-shapes',                 // FIRST field — per GEN-GAMEID
  phase: 'preview',                          // 'preview' | 'welcome' | 'round_intro' | 'gameplay' | 'game_over' | 'motivation' | 'victory' | 'stars_collected'
  currentRound: 0,                           // 0-indexed; 0..7 map to rounds 1..8
  totalRounds: 8,
  score: 0,                                  // +1 per correct drop (NOT reset per round)
  attempts: [],                              // push per drop; schema per data-contract
  events: [],                                // trackEvent() canonical events
  startTime: null,                           // set in game_init to Date.now()
  isActive: false,                           // true between game_init and endGame
  content: null,                             // assigned = fallbackContent (spread of game_init payload when provided)
  duration_data: { attempts: [], firstAttempt: null, lastAttempt: null },
  isProcessing: false,                       // true during awaited feedback (round-complete, end-game); false during per-drop multi-step feedback
  gameEnded: false,                          // true once endGame(true|false) has fired

  // Conditional
  lives: 3,
  totalLives: 3,
  correctAnswer: null,                       // set each render to a map { [card_id]: bucket_id } — tests read this

  // Alfred-specific
  streak: 0,                                 // consecutive correct drops (across rounds)
  consecutiveWrongs: 0,                      // consecutive wrong drops (resets on any correct)

  // Game-specific
  roundsCompleted: 0,                        // used for star calc; increments on round-complete
  stars: 0,                                  // computed lazily at endGame
  roundStartTime: null,                      // Date.now() at round entry for response_time_ms
  cardsPlaced: [],                           // ids of cards successfully placed this round
  cardsRemaining: [],                        // ids still in the bank this round
  misconceptionEvents: [],                   // rolling { round, card_id, bucket_id, tag, ts } entries for analytics
  activeDrag: null,                          // { cardId, pointerId, startX, startY, offsetX, offsetY } | null — mid-drag bookkeeping
  showBucketReview: false,                   // true during round 7 & 8 round-complete highlight
  previewResult: null,                       // populated from startGameAfterPreview payload; included in game_complete.data.previewResult
  visibilityPaused: false                    // true while tab hidden
};
```

### Reset semantics

- **`game_init` handler:** first line `gameState.phase = 'gameplay'` is NOT appropriate here (Sort the Shapes uses preview-first flow); per PART-039 the init handler sets `phase='preview'` and the `startGameAfterPreview(previewData)` callback later sets `phase='welcome'` or `'round_intro'`. Follow GEN-PHASE-INIT as documented in the preview-games section of data-contract: `phase='preview'` immediately on receipt of `game_init`.
- **Per-round reset (`renderRound(i)`):** assign fresh `cardsPlaced=[]`, `cardsRemaining=[...round.cards.map(c=>c.id)]`, `roundStartTime=Date.now()`, `correctAnswer = Object.fromEntries(round.cards.map(c => [c.id, c.category]))`, `activeDrag=null`, `showBucketReview = (round.type === 'C')`. Do NOT touch `lives`, `score`, `attempts`, `roundsCompleted`.
- **Per-game reset (`restartToRound1`):** `score=0`, `lives=3`, `roundsCompleted=0`, `currentRound=0`, `attempts=[]`, `misconceptionEvents=[]`, `stars=0`, `startTime=Date.now()`, `gameEnded=false`, `isProcessing=false`, `streak=0`, `consecutiveWrongs=0`, `duration_data={attempts:[],firstAttempt:null,lastAttempt:null}`, then call `renderRound(0)` and push round 1 intro. DO NOT re-show PreviewScreen (CLAUDE.md invariant).

---

## 6. Component → screen map

| Section | Component | Mount / instantiation | `destroy()` timing | Notes |
|---------|-----------|----------------------|---------------------|-------|
| Preview screen | `PreviewScreenComponent` (PART-039) | Mounted once in `onMounted` after `game_init` when `fallbackContent.showGameOnPreview === false`; `.show({ instruction: previewInstruction, audioText: previewAudioText, audioUrl: previewAudio })` | `.destroy()` called in the `startGameAfterPreview` callback before Welcome transition is rendered | **INVARIANT:** never re-show on restart/replay. The `restartToRound1` path must NOT call `.show()` again. |
| Welcome / Level | `TransitionScreenComponent` (shared) | Instantiated once, kept as singleton; `.show({ title: 'Sort the Shapes', subtitle: 'Drag each shape into the right bucket!', buttons: [{text:'Start', type:'primary', action: advanceToRound1Intro}], persist: true, onMounted: welcomeOnMounted })` | Implicit via `.show` replacing content — no manual destroy; singleton reused for all transitions | First-load only; skipped on restart |
| Round N intro | `TransitionScreenComponent` (singleton) | `.show({ title: 'Round N', buttons: [], persist: false, duration: null, onMounted: () => awaited SFX→VO then renderRound })` | Auto-hides after the awaited sequence completes (Variant A auto-advance) | No CTA on any of the 8 round-intro transitions |
| Progress bar + lives | `ProgressBarComponent` (PART-023) mounted inside `ScreenLayout` below the preview header | Mounted once after preview; `.update({ current: currentRound+1, total: 8, lives })` called on every phase transition and after every drop | No destroy — persists across all non-preview screens | Lives rendered as hearts inside/adjacent to the progress bar; updates atomically with `lives--` in the wrong-drop handler |
| Gameplay body | Custom-authored DOM (bank row + bucket row) inside `#gameContent` | `renderRound(i)` wipes and rebuilds the gameplay body | Cleared at round transition by `renderRound` replacing `innerHTML` | PART-033 drag interaction owns the cards + buckets |
| Game Over | `TransitionScreenComponent` (singleton) | `.show({ icons: ['😔'], title: 'Game Over', subtitle: "You ran out of lives!", buttons: [{text:'Try Again', type:'primary', action: showMotivation}], persist: true, onMounted: gameOverOnMounted })` | Hidden when motivation is shown | Fires `game_complete` BEFORE onMounted audio starts |
| Motivation | `TransitionScreenComponent` (singleton) | `.show({ title: 'Ready to improve your score? ⚡', buttons: [{text:"I'm ready! 🙌", type:'primary', action: restartToRound1}], persist: true, onMounted: motivationOnMounted })` | Hidden by `restartToRound1` before round 1 intro | CTA stops all audio |
| Victory | `TransitionScreenComponent` (singleton) | `.show({ title: 'Victory 🎉', subtitle: victorySubtitleByStars(stars), stars: gameState.stars, buttons: victoryButtons(stars), persist: true, onMounted: victoryOnMounted })` where `victoryButtons` returns `[{text:'Claim Stars', type:'primary', action: showStarsCollected}]` when `stars===3` else `[{text:'Play Again', type:'secondary', action: showMotivation},{text:'Claim Stars', type:'primary', action: showStarsCollected}]` | Hidden by route actions | Do NOT pass `icons` (conflicts with `stars`) |
| Stars Collected | `TransitionScreenComponent` (singleton) | `.show({ title: 'Yay! 🎉\nStars collected!', styles:{title:{whiteSpace:'pre-line', lineHeight:'1.3'}}, duration: 2500, onMounted: starsCollectedOnMounted })` | Auto-hides at 2500ms | After hide, `window.parent.postMessage({type:'game_exit'},'*')` |
| Paused overlay | Custom `<div id="pauseOverlay">` with Resume button | Shown on `visibilitychange` hidden (CASE 14) | Hidden on `visibilitychange` visible (CASE 15) | Not a TransitionScreen |

**Invariant:** PreviewScreen `.show` is called EXACTLY ONCE per page load. Restart flows (`restartToRound1`) must route Motivation → Round 1 intro directly, never back through Preview or Welcome. Static validator GEN-PREVIEW-ONCE catches re-show.

---

## 7. Drag-and-drop implementation plan

### Pointer event handlers (names)

- `handleCardPointerDown(event, cardEl)` — on `pointerdown` on a card element: check not already placed, check `!gameState.visibilityPaused`, call `cardEl.setPointerCapture(event.pointerId)`, store `gameState.activeDrag = { cardId, pointerId, startX, startY, offsetX, offsetY, startTime }`, add `.dragging` class, dim other cards.
- `handleCardPointerMove(event)` — while `activeDrag` matches `event.pointerId`: translate card via `transform: translate3d(dx, dy, 0)`, then on every frame do a lightweight `elementFromPoint(event.clientX, event.clientY)` or cached bucket-rect hit-test and toggle `.hover-valid` on the bucket the pointer is over.
- `handleCardPointerUp(event)` — on `pointerup` / `pointercancel`: clear `.hover-valid` on all buckets, run `hitTestBucket(x, y)`, branch into `resolveCorrectDrop(cardId, bucketId)` / `resolveWrongDrop(cardId, bucketId)` / `resolveMissedDrop(cardId)`. Release `cardEl.releasePointerCapture(event.pointerId)`. Clear `activeDrag`, remove `.dragging`.
- `hitTestBucket(clientX, clientY)` — primary: `elementFromPoint` then `closest('.bucket')`. Fallback: iterate `document.querySelectorAll('.bucket')`, compare `getBoundingClientRect()` AABBs. Returns `bucket.dataset.bucketId` or `null`.
- `resolveCorrectDrop(cardId, bucketId)` — score++, recordAttempt(correct=true), fire-and-forget correct SFX+sticker, animate card into bucket, lock card, move id from `cardsRemaining` → `cardsPlaced`, call `syncDOM()`, if `cardsRemaining.length === 0` call `onRoundComplete()`.
- `resolveWrongDrop(cardId, bucketId)` — `lives--`; if `lives > 0`: recordAttempt(correct=false, misconception_tag=lookup), fire-and-forget wrong SFX+sticker, flash bucket red, shake card, snap card back, heart-break animation, show misconception subtitle 1.8s, `syncDOM()`. If `lives === 0`: recordAttempt (still), skip wrong SFX (CASE 8), flash bucket red briefly, then `endGame(true)`.
- `resolveMissedDrop(cardId)` — snap card back silently, no life lost, no SFX, no recordAttempt.
- `onRoundComplete()` — if `round.type === 'C'`: run `runBucketReviewHighlight()` 2000ms; then `isProcessing=true`, `roundsCompleted++`, await `FeedbackManager.sound.play('all_correct', {sticker})`, 1200ms delay, then `currentRound++` and route to next round intro or Victory. `isProcessing=false`.

### Visual states (CSS classes)

| State | Class | Applied to | Style |
|-------|-------|-----------|-------|
| Idle | (none) | card | default card look |
| Dragging | `.dragging` | card | `transform: translate3d(...) scale(1.05)`; `z-index: 1000`; `filter: drop-shadow(...)`; `pointer-events: none` on siblings |
| Other cards dimmed | `.dimmed` | non-active cards | `opacity: 0.6` |
| Hovering valid bucket | `.hover-valid` | bucket | border solid primary, slight scale |
| Snap-correct | `.snap-correct` | card | 250ms transform animation to bucket center |
| Snap-wrong / snap-back | `.snap-back` | card | 300ms transform animation back to bank slot |
| Shake | `.shake-wrong` | card | 500ms keyframe shake |
| Correct flash | `.flash-correct` | bucket | 200ms green background flash |
| Wrong flash | `.flash-danger` | bucket | 300ms red background flash |
| Heart break | `.heart-break` | heart icon | 600ms pop → remove |
| Locked | `.placed` | card | `pointer-events: none`, position absolute inside bucket container |
| Bucket review (round 7/8) | `.bucket-review-highlight` | buckets | 2000ms outline pulse |

### Reduced-motion fallback

- Detect `window.matchMedia('(prefers-reduced-motion: reduce)')` once on init; store in `gameState.reducedMotion`.
- When true: replace `.shake-wrong`, `.snap-correct`, `.snap-back`, `.heart-break`, `.flash-correct`, `.flash-danger` transition durations with `0ms` (use a CSS class override `.reduced-motion` on `#app` that zeroes all durations); cards snap instantly to bucket/bank; hearts disappear immediately (no pop); bucket background swaps synchronously to green/red tint for ~150ms purely via class toggle, no keyframes.
- Drag itself still uses transform translation (no alternative input model), but no scale / drop-shadow transition.

### Touch / mobile rules

- **Cards** get `touch-action: none` + `user-select: none`. **Buckets** get `user-select: none` only — NOT `touch-action: none`. Buckets cover most of the viewport; setting `touch-action: none` on them kills page scroll whenever the user's finger lands in the drop area. Active-drag scroll suppression is handled by a document-level `touchmove` listener keyed on `dragState` (see `alfred/skills/mobile/reference/touch-and-input.md` §13).
- `overscroll-behavior: none` on `html, body` (mobile rule 18 CRITICAL).
- `overflow-x: hidden` on `html, body, .game-stack`.
- `100dvh` with `@supports (height: 100dvh)` fallback.
- No HTML5 `dragstart` / `drop` / `dragover` handlers anywhere.
- Bottom bucket row uses `padding-bottom: env(safe-area-inset-bottom)`.

---

## 8. inputSchema extraction plan

The pipeline's inputSchema extractor converts fixed `fallbackContent` fields into swappable content-set parameters at deploy time. For Sort the Shapes:

### Swappable (expose as inputSchema parameters)

| Field | Type | Why swappable |
|-------|------|---------------|
| `previewInstruction` | string (HTML) | TTS/translation pipeline patches this per locale |
| `previewAudioText` | string | TTS pipeline uses this to synthesise `previewAudio` |
| `previewAudio` | string \| null | Patched in at deploy by TTS pipeline |
| `rounds[].buckets[].label` | string | Localisable / re-themable bucket names |
| `rounds[].cards[].name` | string | Localisable shape name rendered as card label |
| `rounds[].cards[].svg` | enum of svg library keys | Swappable asset identifier (bounded by the SVG library) |
| `rounds[].misconception_tags` | `Record<card_id, Record<bucket_id, tag_string>>` | Analytics taxonomy can evolve; new wrong-drop pairs can be tagged without code change |

### Fixed (NOT swappable — structural)

| Field | Why fixed |
|-------|-----------|
| `rounds[].round` | Positional identity |
| `rounds[].stage` | Determines cognitive demand & star thresholds |
| `rounds[].type` | `"A" \| "B" \| "C"` drives bucket-review behavior (Type C shows highlight) |
| `rounds[].buckets[].id` | Referenced by `cards[].category` and by misconception tag nesting; changing breaks linkage |
| `rounds[].cards[].id` | Stable question_id anchor (`r<N>_<id>`) for analytics |
| `rounds[].cards[].category` | Correctness relation |
| Number of rounds (8) | Spec-fixed |
| Buckets per round (2/3/2) | Spec-fixed layout |
| Cards per round (3/4/4/5/5/5/5/5) | Spec-fixed |
| `showGameOnPreview: false` | PART-039 pattern |
| Lives (3) | Spec-fixed |
| Star thresholds (7–8 / 5–6 / 1–4) | Spec override vs archetype default |

### Resulting inputSchema shape (for deploy-time content generation)

```
{
  previewInstruction: string,
  previewAudioText: string,
  previewAudio: string | null,
  rounds: [
    {
      round: 1..8,              // fixed, order-preserving
      stage: 1|2|3,             // fixed
      type: 'A'|'B'|'C',        // fixed
      buckets: [{ id: string (fixed), label: string (swap) }],
      cards:   [{ id: string (fixed), name: string (swap), svg: enum (swap), category: string (fixed) }],
      misconception_tags: { [card_id: string]: { [bucket_id: string]: string (swap) } }
    } x 8
  ]
}
```

---

## 9. Risk list (top 5)

| # | Risk | Likelihood | Mitigation |
|---|------|-----------|-----------|
| 1 | **HTML5 `dragstart`/`drop` leaks into generated code** (unreliable on iOS Safari). Pipeline's default DnD helper historically used HTML5 DnD. | High | Gen rule enforcement in planning: explicitly forbid `ondragstart`, `ondrop`, `ondragover`, `event.dataTransfer`. Use pointer events only. `touch-action: none` on cards + buckets. Local Verification must run on a touch device before queuing. |
| 2 | **Re-entrant round advance** — if `resolveCorrectDrop` is called twice in the same tick (pointerup fires twice on some browsers), `roundsCompleted` could double-increment and `renderRound(currentRound+1)` could run twice. | Medium | Guard `onRoundComplete` with `if (gameState.isProcessing || gameState.gameEnded) return;`, then set `isProcessing=true` immediately. Release only after the next round intro is shown. Also guard `activeDrag` clearing: if `activeDrag === null` on `pointerup`, return early. |
| 3 | **Audio race on rapid drops** — multi-step fire-and-forget means the user can drop two cards in <500ms; two `correct_sound_effect` calls may stack or clip. | Medium | FeedbackManager internally de-dupes SFX with its own queue; documented in feedback skill. Still: never await per-drop SFX (multi-step rule). No dynamic TTS per drop (multi-step rule). Misconception subtitle uses DOM banner, not FeedbackManager — no audio conflict. |
| 4 | **game_complete ordering** — must fire BEFORE any end-game audio on BOTH paths (game_over, victory). Easy to accidentally move it after the `await sound.play(...)`. | High | Centralise in a single `endGame(isGameOver)` function: (1) render screen (Game Over or Victory) — `transitionScreen.show`; (2) compute stars; (3) `postGameComplete({ stars, roundsCompleted, score, ... })` — nested `data`; (4) then trigger `onMounted` audio. GEN-PM-DUAL-PATH enforces. |
| 5 | **Preview re-shown on replay** — a naive `restartToRound1` that calls a generic "go to start" may re-render PreviewScreen, violating CLAUDE.md invariant and spec flow. | High | `restartToRound1` explicitly calls `renderRoundIntro(0)` (Round 1 intro), NOT `showPreview()` or `showWelcome()`. Gen rule GEN-PREVIEW-ONCE and the default-flow.md retry path ("skips Preview + Welcome") are both documented. |

### Additional watch-outs (not top 5 but documented)

- iOS pull-to-refresh on drag-from-top: `overscroll-behavior: none` on html+body (mobile rule 18).
- Landscape orientation: show rotate overlay (mobile rule 8).
- Visibility hidden mid-drag: treat as `pointercancel`, snap card back silently, pause timers and audio.
- Last-life game-over VS wrong-SFX: CASE 8 — skip wrong-SFX entirely. Don't `await` it then transition; just red-flash visually and call `endGame(true)`.
- Type C round-complete: bucket-review highlight runs BEFORE the awaited round-complete SFX, otherwise the highlight visual is clobbered by the transition.

---

## 10. Data-contract checkpoints

### `recordAttempt(roundIndex, userInput, correct, metadata)` — exact shape per event

**Correct drop** (called BEFORE fire-and-forget correct SFX):

```js
recordAttempt(
  gameState.currentRound,                       // 0-indexed → attempt.round_number = currentRound+1
  { card_id: 'c2', bucket_id: 'squares' },      // input_of_user: what the student did
  true,                                         // correct
  {
    is_retry: false,                            // Sort the Shapes never retries the same card; cards lock on correct
    round: gameState.currentRound + 1,
    stage: round.stage,
    type:  round.type,
    card:  { id: card.id, name: card.name, svg: card.svg, category: card.category },
    bucket:{ id: bucket.id, label: bucket.label },
    misconception_tag: null                     // function forces null when correct (per attempt-schema.md)
  }
);
```

Resulting attempt object (per attempt-schema.md):

```js
{
  attempt_timestamp: Date.now(),
  time_since_start_of_game: Date.now() - gameState.startTime,
  input_of_user: { card_id: 'c2', bucket_id: 'squares' },
  correct: true,
  round_number: 4,
  question_id: 'r4_c2',                         // stable: 'r<N>_<cardId>'
  correct_answer: 'squares',                    // round.cards.find(c=>c.id===card_id).category
  response_time_ms: Date.now() - gameState.roundStartTime,
  misconception_tag: null,
  difficulty_level: round.stage,                // 1, 2, or 3
  is_retry: false,
  metadata: { round: 4, stage: 2, type: 'B', card: {...}, bucket: {...}, misconception_tag: null }
}
```

**Wrong drop** (called BEFORE fire-and-forget wrong SFX — OR, if last life, still called before CASE-8 game-over):

```js
recordAttempt(
  gameState.currentRound,
  { card_id: 'c2', bucket_id: 'rhombuses' },
  false,
  {
    is_retry: wasPreviouslyAttempted(card.id),  // true if this card was dropped on a wrong bucket earlier this round
    round: gameState.currentRound + 1,
    stage: round.stage,
    type:  round.type,
    card:  { id: 'c2', name: 'Rectangle', svg: 'rectangle_wide', category: 'rectangles' },
    bucket:{ id: 'rhombuses', label: 'Rhombuses' },
    misconception_tag: round.misconception_tags[card.id][bucket.id]  // e.g. 'quadrilateral-blur'
  }
);
```

Resulting object: as above with `correct: false`, `misconception_tag` from the lookup (NEVER `'other'` or `'wrong'` — spec Success Criteria), `correct_answer: 'rectangles'` (card's true category).

### `game_complete` postMessage payload — exact shape

Fires from **both** `endGame(true)` (game over) and `endGame(false)` (victory) BEFORE any end-game audio:

```js
window.parent.postMessage({
  type: 'game_complete',
  data: {
    metrics: {
      accuracy: Math.round((correctDropCount / totalDropAttempts) * 100) || 0,   // integer 0-100
      time: Math.round((Date.now() - gameState.startTime) / 1000),                // seconds
      stars: gameState.stars,                                                     // 0,1,2,3 (from roundsCompleted per spec)
      attempts: gameState.attempts,                                               // full array (per attempt-schema)
      duration_data: gameState.duration_data,
      totalLives: gameState.lives,                                                // lives remaining at end
      tries: triesByRound                                                          // [{round:1, tries:n}, ...]
    },
    previewResult: gameState.previewResult || null,                               // PART-039
    completedAt: Date.now(),

    // Spec Success Criteria — MUST include these at top of `data`:
    gameId: 'sort-the-shapes',
    score: gameState.score,
    roundsCompleted: gameState.roundsCompleted,
    totalRounds: 8
  }
}, '*');
```

Notes:
- `accuracy` denominator is `totalDropAttempts` = `attempts.length` (all drops, correct + wrong, across the whole session). Per the gauge layer's expected definition; keep integer.
- `tries` is computed by reducing `attempts` grouped by `round_number` to per-round drop counts.
- `totalLives` per PART-008 is remaining lives (0 on game_over, 1..3 on victory).
- Fires BEFORE `await FeedbackManager.sound.play(...)` for the victory / game-over sequence — GEN-PM-DUAL-PATH + feedback CASE 11/12 both require this.

### syncDOM attributes after every mutation

After every `gameState` mutation (drop resolution, round entry, phase change), call `syncDOM()` on `#app`:

| Attribute | Source | Updates when |
|-----------|--------|-------------|
| `data-phase` | `gameState.phase` | Phase transitions |
| `data-score` | `gameState.score` | Correct drop |
| `data-lives` | `gameState.lives` | Wrong drop |
| `data-round` | `gameState.currentRound + 1` | Round entry |

### trackEvent call sites (canonical events, per PART-010)

- `round_start` — on entering gameplay for each round
- `round_complete` — on all-placed
- `attempt` — each drop (matches recordAttempt)
- `game_over` — on endGame(true)
- `game_complete` — on endGame(false) victory path

---

## Cross-validation checklist (per game-planning skill Step 7)

| Check | Status |
|-------|--------|
| Every screen in flow diagram has a wireframe / elements table entry | Covered in §1 + §6 |
| Every round type in round-flow has a gameplay layout | Type A / B / C distinguished in §2 and §6 |
| Every feedback moment has a FeedbackManager call | §4 table rows each specify `FeedbackManager.sound.play(...)` or `playDynamicFeedback(...)` |
| Lives → game_over branch present | §1 flow, §3 scoring, §6 Game Over screen, §4 CASE 8 row |
| Scoring formula matches state changes | §3 (+1 per correct; -1 life per wrong; stars from roundsCompleted) matches §4 entries |
| Data-contract fields match schemas | §10 full shapes per attempt-schema.md + postmessage-schema.md |
| Preview-once invariant documented | §6 note + §9 risk #5 |
| Multi-step feedback rule documented | §4 notes + §9 risk #3 |
| CASE 8 last-life game-over SFX skip | §4 row + §9 watch-outs |
| Dual-path game_complete | §10 + §9 risk #4 |
