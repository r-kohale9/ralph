# Pre-Generation Plan: Cross-Logic Puzzle

**Game ID:** cross-logic
**Archetype:** Board Puzzle (#6)
**Shape:** Multi-round (Shape 2) + customizations
**Bloom Level:** L4 Analyze
**Rounds:** 6 (2 per stage, 3 stages)
**Lives:** 0 (binary per-puzzle; no game_over screen)
**Timer:** None

---

## 1. One-Liner

The student fills a logic grid with crosses (❌) and checks (✅) using tap-cycle interaction to deduce the unique pairing of subjects to two attribute categories from a small set of natural-language clues, then taps "Check my solution" to commit one binary submission per puzzle.

---

## 2. Screen Flow (Diagram)

```
┌──────────┐  tap   ┌──────────┐  auto  ┌──────────────┐  auto   ┌────────────┐
│ Preview  ├───────▶│ Welcome  ├───────▶│ Puzzle N of 6├────────▶│ Game       │
│ Screen   │        │ (trans.) │        │ (trans.,     │ (after  │ (logic     │
│ 🔊 prev  │        │ 🔊 welc. │        │  no buttons) │  sound) │  grid)     │
│   audio  │        │    VO    │        │ 🔊 "Puzzle N"│         │ 🔊 prompt  │
└──────────┘        └──────────┘        └──────────────┘         └─────┬──────┘
                                                ▲                     │ student fills
                                                │                     │ grid + taps
                                                │                     │ "Check my
                                                │                     │  solution"
                                                │                     ▼
                                                │           ┌─────────────────────┐
                                                │           │ "Checking..."       │
                                                │           │ overlay (~600ms)    │
                                                │           │ (gameplay overlay,  │
                                                │           │  not new screen)    │
                                                │           └─────────┬───────────┘
                                                │                     │
                                                │       ┌─────────────┴─────────────┐
                                                │       │                           │
                                                │   correct                       wrong
                                                │       │                           │
                                                │       ▼                           ▼
                                                │ ┌──────────────────┐  ┌──────────────────────┐
                                                │ │ Feedback (in-    │  │ Fail dialogue        │
                                                │ │ place)           │  │ (in-place overlay)   │
                                                │ │ ✓ sound_correct  │  │ "Oh no! That        │
                                                │ │   + sticker      │  │  solution doesn't    │
                                                │ │   "Puzzle solved!"│  │  fit the clues."    │
                                                │ │ progressBar bumps│  │ ✗ sound_incorrect    │
                                                │ │ FIRST            │  │ + TTS naming clue    │
                                                │ └─────────┬────────┘  │ progressBar bumps    │
                                                │           │           │ FIRST                │
                                                │           │           │ [Next] button        │
                                                │           │           └──────────┬───────────┘
                                                │           │                      │
                                                │   more puzzles            more puzzles
                                                │   remaining               remaining
                                                │           │                      │
                                                └───────────┴──────────────────────┘
                                                            │
                                                       last puzzle
                                                       resolved (correct OR wrong)
                                                            │
                                                            ▼
                                                  ┌────────────────────┐
                                                  │ Victory (status)   │
                                                  │ 0–3★               │  (reachable from
                                                  │ subtitle: "X of 6  │   every play; no
                                                  │  puzzles solved!"  │   game_over branch)
                                                  │ 🔊 sound_game_     │
                                                  │    victory →       │
                                                  │    vo_victory_     │
                                                  │    stars_N         │
                                                  └──────┬─────┬───────┘
                                                         │     │
                                            "Play Again" │     │ "Claim Stars"
                                            (only if     │     │
                                             0–2 ★)      ▼     ▼
                                   ┌──────────────────┐  ┌──────────────────────┐
                                   │ "Ready to        │  │ "Yay! 🎉             │
                                   │  improve your    │  │  Stars collected!"   │
                                   │  score? ⚡"      │  │ (trans., auto, 2500ms│
                                   │ (trans., tap)    │  │  no buttons)         │
                                   │ 🔊 sound_motiv.  │  │ 🔊 sound_stars_      │
                                   │ ["I'm ready! 🙌"]│  │    collected         │
                                   └────────┬─────────┘  └──────────┬───────────┘
                                            │ tap                    │ auto
                                            ▼                        ▼
                                   restart from Puzzle 1     postMessage('game_exit')
                                   (skips Preview + Welcome)
```

### Changes from canonical Shape 2 default

- **Removed `Game Over` branch entirely** (lives = 0; archetype Constraint 5: never add game_over to a lives=0 game).
- **Removed `Try Again → Motivation` route from Game Over side** (unreachable).
- **Inserted `Checking…` overlay** (~600ms, in-place gameplay overlay, NOT a transition screen) between Submit and the correct/wrong split.
- **Round transition relabel:** `Round N` → `Puzzle N of 6` (Board Puzzle convention).
- **Wrong path advances to next puzzle** instead of staying on round; progressBar increments on wrong submissions too (puzzle counted as attempted).
- **Victory reachable from every playthrough**, including 0-correct (subtitle reflects actual count).
- **Play Again CTA shown for 0-2★** (default is "<3★"; same condition, written explicitly because 0★ is reachable).

### Screen Inventory (data-phase values)

| # | Screen | data-phase | Backed by |
|---|--------|-----------|-----------|
| 1 | PreviewScreen | `preview` | PreviewScreenComponent |
| 2 | Welcome | `welcome` | TransitionScreenComponent |
| 3 | Puzzle N of 6 | `round_intro` | TransitionScreenComponent |
| 4 | Game (logic grid) | `gameplay` | Custom render in `#gameContent` |
| 5 | Victory | `victory` | TransitionScreenComponent |
| 6 | Motivation ("Ready to improve") | `motivation` | TransitionScreenComponent |
| 7 | Stars Collected | `stars_collected` | TransitionScreenComponent |

> **No `game_over` screen.** No `results` screen distinct from Victory.
> **In-place overlays (NOT screens, no data-phase change):** Checking… (600ms), Fail dialogue (in-place on gameplay screen, dismissed by Next button), VisibilityTracker pause overlay (popupComponent on tab-hide).

### Persistent fixtures on every non-Preview screen

- **Preview header** (top, fixed): avatar / question label "Puzzle N of 6" / score / star — owned by PreviewScreenComponent, visible in both preview and game states.
- **ProgressBar** (below header): tracks puzzle number out of 6; updates AFTER round-complete (correct or wrong) FIRST in handler, before any awaited SFX. Hidden only on PreviewScreen.

---

## 3. Screen Wireframes (375×667 mobile portrait)

### Screen 1: PreviewScreen (data-phase="preview")

```
+-------------------------------+
|  👤  Cross-Logic Puzzle  ⭐0  |  <- preview header (no progress bar yet)
+-------------------------------+
|                               |
|     🧩 Cross-Logic Puzzle     |  <- title
|                               |
|   Read the clues. Tap each    |  <- previewInstruction
|   grid cell once for cross,   |     (rendered by PreviewScreenComponent)
|   twice for check, three      |
|   times to clear. Find the    |
|   one solution that fits      |
|   every clue, then tap Check  |
|   my solution.                |
|                               |
|       [ ▶  Start Game ]       |  <- start CTA
|                               |
+-------------------------------+
```

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | "Cross-Logic Puzzle", score=0, star=0 | no |
| Title | center-top | "Cross-Logic Puzzle" | no |
| previewInstruction | center | full HTML from `fallbackContent.previewInstruction` | no |
| previewAudioText | (auto, onMounted) | spoken via FeedbackManager | no |
| Start button | bottom | "Start Game" → Welcome | tap |

**Entry:** game load. **Exit:** tap Start → Welcome screen.

### Screen 2: Welcome (data-phase="welcome")

```
+-------------------------------+
|  👤  Puzzle 1 of 6      ⭐0   |  <- preview header (persistent)
|  ▱▱▱▱▱▱  0/6                 |  <- progressBar (visible, unfilled)
+-------------------------------+
|                               |
|             👋                |  <- sticker
|                               |
|        Welcome!               |  <- title
|     Let's solve some          |  <- subtitle
|       logic puzzles!          |
|                               |
|       [ Let's Go! ]           |  <- CTA
|                               |
+-------------------------------+
```

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 0/6 filled | no |
| Sticker / Icon | top-center | `👋` (welcome sticker) | no |
| Title | center | "Welcome!" | no |
| Subtitle | center | "Let's solve some logic puzzles!" | no |
| Audio | (auto, onMounted) | `sound_welcome` + `STICKER_WELCOME` + dynamic VO "Welcome! Let's solve some logic puzzles!" | no |
| CTA 1 | bottom | "Let's Go!" → Puzzle 1 of 6 (round_intro) | tap |

**Entry:** tap Start on Preview. **Exit:** tap "Let's Go!" → Puzzle 1 of 6 transition.

### Screen 3: Puzzle N of 6 (data-phase="round_intro")

```
+-------------------------------+
|  👤  Puzzle N of 6      ⭐X   |  <- preview header
|  ▰▰▱▱▱▱  (N-1)/6              |  <- progressBar
+-------------------------------+
|                               |
|             🧩                |  <- sticker
|                               |
|       Puzzle N of 6           |  <- title (no buttons; auto-advances)
|                               |
|                               |
|                               |
+-------------------------------+
```

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture, "Puzzle N of 6" | no |
| Progress bar | below header | (N-1)/6 filled | no |
| Sticker / Icon | top-center | `🧩` (rounds sticker) | no |
| Title | center | "Puzzle N of 6" (e.g. "Puzzle 1 of 6") | no |
| Audio | (auto, onMounted) | `sound_rounds` + dynamic VO "Puzzle N of 6" | no |
| (no buttons) | — | auto-advance after sound completes | — |

**Entry:** auto from Welcome (N=1) or from previous puzzle resolution (N=2..6). **Exit:** auto after rounds-sound completes → Game (gameplay).

### Screen 4: Game / Logic Grid (data-phase="gameplay")

```
+-------------------------------+
|  👤  Puzzle 3 of 6      ⭐2   |  <- preview header
|  ▰▰▱▱▱▱  2/6                  |  <- progressBar
+-------------------------------+
|  CLUES                        |
|  [1] Aarav did not get 35.    |  <- numbered clue chips
|  [2] The student who          |     (top of play area)
|      multiplied got 35.       |
|  [3] Diya did not add.        |
+-------------------------------+
|              | Add | Mul | 12 | 35 |  <- column headers
|     Aarav    |  ·  |  ·  | ·  | ·  |  <- row
|     Diya     |  ·  |  ·  | ·  | ·  |
|                                       (vertical divider between
|                                        block 1 [Add|Mul] and
|                                        block 2 [12|35])
+-------------------------------+
|     [ Check my solution ]     |  <- submit (greyed until valid)
+-------------------------------+
```

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | (N-1)/6 filled | no |
| Clue panel | top of play area | numbered clue chips from `round.clues` (or `cluesFinal` for round 6) | no |
| Logic grid | center, dominant | rows = subjects, cols = attributeA values + divider + attributeB values; each cell shows current state (empty / ❌ / ✅) | tap (cycle) |
| Submit button | bottom | "Check my solution" | tap (when enabled) |

**Round presentation sequence (per puzzle):**
1. **Question preview** — clue panel + grid render with empty cells. Submit button greyed (disabled).
2. **Instructions** — none (preview owns the how-to-play; do NOT re-render in gameplay).
3. **Media** — none.
4. **Gameplay reveal** — grid fades in (350ms), tap input unblocks, submit becomes enabled when every row has exactly one ✅ in each attribute block.

**Overlays on this screen:**
- **Checking… overlay** (~600ms): full-screen translucent overlay with text "Checking…" after Submit tapped. `gameState.isProcessing = true` set BEFORE the await.
- **Fail dialogue overlay** (in-place): "Oh no! That solution doesn't fit the clues." + "Next" button. Renders after wrong-path SFX awaited.

**Entry:** auto from Puzzle N of 6 transition. **Exit:** correct or wrong submission → next Puzzle N of 6 OR Victory.

### Screen 5: Victory (data-phase="victory")

```
+-------------------------------+
|  👤  Puzzle 6 of 6      ⭐3   |  <- preview header
|  ▰▰▰▰▰▰  6/6                  |  <- progressBar (full)
+-------------------------------+
|                               |
|        ⭐ ⭐ ⭐               |  <- star row (driven by gameState.stars)
|                               |
|       Victory 🎉              |  <- title
|     You solved 5 of 6         |  <- subtitle (game-specific)
|        puzzles!               |
|                               |
|  [Play Again] [Claim Stars]   |  <- if 0-2★
|       OR                      |
|       [Claim Stars]           |  <- if 3★
+-------------------------------+
```

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 6/6 filled | no |
| Stars | top-center | `gameState.stars` (0/1/2/3) — drives star row rendering | no |
| Title | center | "Victory 🎉" | no |
| Subtitle | center | "You solved X of 6 puzzles!" (X = score) | no |
| Audio | (auto, onMounted) | `sound_game_victory` + `STICKER_CELEBRATE` then `vo_victory_stars_N` | no |
| CTA 1 | bottom-left | "Play Again" → Motivation (only if `stars < 3`) | tap |
| CTA 2 | bottom-right | "Claim Stars" → Stars Collected | tap |

**Entry:** last puzzle resolved (correct OR wrong). **Exit:** tap CTA → Motivation or Stars Collected.

### Screen 6: Motivation (data-phase="motivation")

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 6/6 (state preserved through restart prep) | no |
| Title | center | "Ready to improve your score? ⚡" | no |
| Audio | (auto, onMounted) | `sound_motivation` + `STICKER_MOTIVATE` | no |
| CTA 1 | bottom | "I'm ready! 🙌" → restartToRound1 (resets gameState; skips Preview + Welcome) | tap |

**Entry:** tap "Play Again" on Victory. **Exit:** tap "I'm ready! 🙌" → Puzzle 1 of 6 transition (full restart).

### Screen 7: Stars Collected (data-phase="stars_collected")

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 6/6 | no |
| Title | center | "Yay! 🎉\nStars collected!" (newline rendered via `styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }`) | no |
| Audio | (auto, onMounted) | `sound_stars_collected` + `STICKER_CELEBRATE` + ✨ animation | no |
| Duration | (auto-hide) | 2500ms | — |

**Entry:** tap "Claim Stars" on Victory. **Exit:** auto after 2500ms → `window.parent.postMessage({type:'game_exit'}, '*')`.

---

## 4. Round-by-Round Breakdown

All 6 rounds use Round Type **A: Tap-Cycle Logic Grid**. Difficulty grows by clue count, clue forms, and inference depth.

| Round | Stage | Theme | Subjects | Attribute A | Attribute B | Clues (count, forms) | Solution |
|-------|-------|-------|----------|-------------|-------------|----------------------|----------|
| 1 | 1 (Warmup) | students-animals-countries | Maya, Arjun (2) | Animal: Lion, Elephant | Country: India, Japan | 2 (DIRECT-NEG only): "Maya is not from Japan."; "Arjun likes the Lion." | Maya→Elephant+India; Arjun→Lion+Japan |
| 2 | 1 (Warmup) | students-sports-snacks | Riya, Karan (2) | Sport: Cricket, Football | Snack: Samosa, Mango | 2 (DIRECT-NEG only): "Riya does not play Football."; "The Cricket player eats Mango." | Riya→Cricket+Mango; Karan→Football+Samosa |
| 3 | 2 (Mixed) | students-operation-result | Aarav, Diya (2) | Operation: Add, Multiply | Result: 12, 35 | 3 (NEG + POS + CROSS-CAT): "Aarav did not get 35."; "The student who multiplied got 35."; "Diya did not add." | Aarav→Add+12; Diya→Multiply+35 |
| 4 | 2 (Mixed) | students-instruments-colors | Sana, Vir (2) | Instrument: Drum, Flute | Color: Red, Blue | 3 (POS + CROSS-CAT + NEG): "Sana plays the Flute."; "The Drum player likes Blue."; "Vir does not like Red." | Sana→Flute+Red; Vir→Drum+Blue |
| 5 | 3 (Hard) | students-shapes-sides | Meera, Rohan, Sara (3) | Shape: Triangle, Square, Pentagon | Sides: 3, 4, 5 | 4 (NEG + CROSS-CAT + COMPOUND/conditional + parity): "Meera did not pick the Triangle."; "The student with the Square chose 4 sides."; "Rohan's shape has more than 3 sides."; "Sara picked an odd number of sides." | Meera→Square+4; Rohan→Pentagon+5; Sara→Triangle+3 |
| 6 | 3 (Hard) | students-animals-countries-hard | Maya, Arjun, Priya (3) | Animal: Lion, Elephant, Tiger | Country: India, Japan, Brazil | 4 (use `cluesFinal`): "Maya is not from Japan."; "The Elephant lover is from Japan."; "Priya likes the Tiger."; "Maya is from India." | Maya→Lion+India; Arjun→Elephant+Japan; Priya→Tiger+Brazil |

**Renderer requirement:** grid dimensions are computed per round as `subjects.length` rows × (`attributeA.values.length` + `attributeB.values.length`) cols. Rounds 1–4 are 2×4; Rounds 5–6 are 3×6. **Round 6 MUST use `cluesFinal`** (the spec's iteration-final clue list — the original `clues` is under-determined).

---

## 5. Scoring & Lives Logic

### Points

| Action | Points | Notes |
|--------|--------|-------|
| Correct submission | +1 | Per puzzle, on the only allowed submission |
| Wrong submission | 0 | No partial credit; puzzle ends and advances |
| Cell tap (any state) | 0 | Working state, not scored |

### Formula

- `score = number of puzzles solved correctly`
- `maxScore = 6`
- `percentage = (score / 6) * 100`

### Star thresholds (spec-overridden, integer-based)

| Stars | Solved count | Notes |
|-------|--------------|-------|
| 3★ | 6 / 6 | Perfect |
| 2★ | 4–5 / 6 | |
| 1★ | 1–3 / 6 | |
| 0★ | 0 / 6 | Victory still shown (no game_over) |

### Lives

| Parameter | Value |
|-----------|-------|
| Starting lives | 0 (binary per puzzle; no life pool) |
| Lives lost per wrong | n/a |
| Game-over condition | NEVER (no game_over screen) |
| Lives display | not rendered |

> **Critical:** Wrong submission does NOT end the game. It ends the current puzzle and advances to the next. After Round 6 (correct OR wrong), Victory screen renders unconditionally with the score-driven star tier.

### Progress bar

| Parameter | Value |
|-----------|-------|
| Tracks | Puzzle number (`currentRound / 6`) |
| Position | Top of game body (below preview header), owned by ProgressBarComponent |
| Visible on | All non-Preview screens |
| Update timing | `progressBar.update(currentRound, 0)` fires FIRST in round-complete handler — BEFORE awaited SFX, BEFORE next-round transition (cross-cutting rule 0; per `feedback_pause_overlay.md` MEMORY) |
| Update on wrong | YES — wrong submission also bumps progressBar (puzzle counted as attempted) |

### Data Contract Fields

| Field | Source | Example |
|-------|--------|---------|
| score | `gameState.score` | 4 |
| totalQuestions | 6 (constant) | 6 |
| stars | derived from score | 2 |
| accuracy | percentage | 67 |
| timeSpent | `Date.now() - gameState.startTime` | 312000 |

---

## 6. Feedback Patterns Per Answer Type

### Bloom L4 Analyze — feedback depth

Wrong-answer feedback names the specific violated clue and points to the contradicting cells (misconception-specific via `round.misconception_tags`). Correct feedback affirms the deduction with a celebratory subtitle.

### Feedback Moment Table

| Moment | Trigger | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|--------|---------|----------------------|----------|---------------|--------|-------|
| Preview audio | PreviewScreen mounts | `FeedbackManager.sound.play('preview_audio', {sticker})` then dynamic VO from `previewAudioText` | n/a | No (Start button visible) | No (CTA interrupts) | Stops on CTA tap |
| Welcome | Welcome screen mounts | `await sound.play('sound_welcome', {sticker:STICKER_WELCOME})` → `await playDynamicFeedback({audio_content:'Welcome! Let\'s solve some logic puzzles!'})` | "Welcome!" | CTA visible | Yes sequential | CTA stops audio |
| Puzzle N intro | round_intro screen mounts | `await sound.play('sound_rounds', {sticker})` → `await playDynamicFeedback({audio_content:'Puzzle N of 6'})` | "Puzzle N of 6" | No CTA | Yes sequential | Auto-advance to gameplay |
| Cell tap (CASE 9) | Tap any grid cell | `FeedbackManager.sound.play('sound_micro_bubble', {}).catch(()=>{})` + `FeedbackManager._stopCurrentDynamic()` to interrupt any ongoing TTS | n/a | No | No (fire-and-forget) | Cell visual updates instantly (empty→❌→✅→empty) |
| Submit blocked | Tap disabled submit | (no FeedbackManager call) | n/a | No | n/a | Nothing happens (mobile rule 12) |
| Submit tapped → Checking | Submit tap | (no audio; just visual overlay) | "Checking…" | YES (`isProcessing=true` BEFORE 600ms timer; all cells disabled) | n/a | After 600ms, branch to correct or wrong |
| Correct (CASE 6) | Submit valid + matches solution | `progressBar.update(currentRound, 0)` FIRST → `await FeedbackManager.sound.play('sound_correct', {sticker:STICKER_CELEBRATE})` → `FeedbackManager.playDynamicFeedback({audio_content:'Puzzle solved! …', subtitle:'Puzzle solved!', sticker}).catch(()=>{})` | "Puzzle solved!" | Yes (1500ms min visual lock) | SFX awaited; TTS fire-and-forget | Auto-advance to next Puzzle N intro OR Victory |
| Wrong (CASE 7) | Submit valid but wrong solution | `progressBar.update(currentRound, 0)` FIRST → render fail dialogue overlay "Oh no! That solution doesn't fit the clues." → `await FeedbackManager.sound.play('sound_incorrect', {sticker:STICKER_SAD})` → `FeedbackManager.playDynamicFeedback({audio_content:'Clue K says …, but your grid says …', subtitle:'Clue K: …', sticker}).catch(()=>{})` → enable [Next] button | misconception-specific (names clue K + violating cells) | Yes (Next button gates) | SFX awaited; TTS fire-and-forget | Tap Next stops all audio, advances |
| Next tapped | After wrong, user taps Next | `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()` → clear fail dialogue → advance | n/a | n/a | n/a | Next Puzzle N intro OR Victory |
| Victory (CASE 12) | Last puzzle resolved | Render Victory FIRST → `window.parent.postMessage({type:'game_complete', payload:{...}}, '*')` BEFORE audio → `await sound.play('sound_game_victory', {sticker:STICKER_CELEBRATE})` → `await playDynamicFeedback({audio_content:'You solved X of 6 puzzles! …'})` | "You solved X of 6 puzzles!" | CTA visible | Yes sequential | CTA stops audio |
| Motivation | Motivation screen mounts | `FeedbackManager.sound.play('sound_motivation', {sticker:STICKER_MOTIVATE})` | n/a | CTA visible | n/a | CTA stops, restarts |
| Stars Collected | Stars Collected mounts | `FeedbackManager.sound.play('sound_stars_collected', {sticker:STICKER_CELEBRATE})` | n/a | n/a | n/a | Auto 2500ms → exit postMessage |
| Pause (CASE 14) | Tab hidden / screen lock | VisibilityTracker built-in `popupComponent` shows pause overlay; pause audio; freeze grid (taps ignored) | n/a | YES | n/a | Wait for visibility |
| Resume (CASE 15) | Tab visible again | VisibilityTracker dismisses popup automatically; resume audio; re-enable grid | n/a | n/a | n/a | Resume gameplay |

### Subtitle examples (correct)

1. (R1) "Puzzle solved! Maya likes the Elephant and Arjun likes the Lion."
2. (R3) "Puzzle solved! Aarav added to get 12, Diya multiplied to get 35."
3. (R5) "Puzzle solved! Meera picked the Square with 4 sides, Rohan picked the Pentagon with 5, Sara picked the Triangle with 3."

### Subtitle examples (wrong — misconception-specific)

1. (R1, marked Maya→Japan) "Clue 1 says Maya is not from Japan, but your grid puts Maya in Japan."
2. (R3, marked Aarav→Multiply) "Clue 2 says the student who multiplied got 35, and clue 1 says Aarav did not get 35 — so Aarav did not multiply."
3. (R6, marked Maya→Elephant) "Clue 2 says the Elephant lover is from Japan, but clue 1 says Maya is not from Japan — so Maya cannot like the Elephant."

### Animations

| Animation | Trigger | CSS class | Duration |
|-----------|---------|-----------|----------|
| Cell state change | Tap any cell | `.cell-pulse` (momentary, NOT continuous per mobile rule 30) | 150ms |
| Score bounce | Correct submission | `.score-bounce` | 400ms |
| Shake | Wrong submission | `.shake-wrong` (on grid container) | 500ms |
| Star pop | Victory star earned | `.star-earned` | 400ms |
| Fade in | Grid renders for new puzzle | `.fade-in` | 350ms |
| Stars-collected sparkle | Stars Collected mounts | `.star-sparkle` | 2500ms |

(NO `heart-break` — no lives.)

### Wrong-answer handling

- Show correct answer: NO (puzzle ends; the student does not see the canonical solution overlay — the violated-clue TTS is the instructional payload).
- Misconception-specific feedback: YES (driven by `round.misconception_tags`).
- Failure recovery: n/a (zero retries — see spec WARNING — Wrong submission ends puzzle).

### Emotional arc notes

- Stage 1 (warmup) — high success expected; subtitle confirms the deduction step.
- Stage 2 (mixed) — first chained inference; wrong feedback gently traces the chain.
- Stage 3 (hard) — even on wrong, fail dialogue celebrates the attempt and names the precise violated clue. Round 6 revisits Round 1's theme so the student feels growth.

---

## 7. Round Loop / State Machine

### Top-level `gameState` shape

```
gameState = {
  phase: 'preview' | 'welcome' | 'round_intro' | 'gameplay' | 'victory' | 'motivation' | 'stars_collected',
  currentRound: 1..6,         // 1-indexed puzzle number
  totalRounds: 6,
  score: 0..6,                // count of correctly-solved puzzles
  lives: 0,                    // unused; kept for archetype contract
  stars: 0..3,                 // computed at Victory
  startTime: <Date.now() at gameplay entry>,
  isProcessing: boolean,       // input-block flag; set TRUE before any await
  gridState: {                 // per-cell state for current puzzle
    [`${rowIdx}-${colIdx}`]: 'empty' | 'cross' | 'check'
  },
  violatedClueId: number|null, // populated on wrong submission for TTS templating
  currentRoundData: <round object from fallbackContent.rounds[currentRound-1]>
}
```

### Round loop pseudo-flow

```
function startGame():
  gameState.phase = 'preview'
  show PreviewScreen
  on Start tap → showWelcome()

function showWelcome():
  gameState.phase = 'welcome'
  transitionScreen.show({ icons:['👋'], title:'Welcome!', subtitle:'Let\'s solve some logic puzzles!',
                          buttons:[{text:"Let's Go!", type:'primary', action: () => startRound(1)}],
                          onMounted: playWelcomeAudio })

function startRound(n):
  gameState.currentRound = n
  gameState.phase = 'round_intro'
  gameState.gridState = {}                    // reset per puzzle
  gameState.violatedClueId = null
  gameState.currentRoundData = fallbackContent.rounds[n-1]
  if !gameState.startTime: gameState.startTime = Date.now()
  transitionScreen.show({ icons:['🧩'], title:`Puzzle ${n} of 6`,
                          duration: <after sound>,
                          onMounted: playRoundsSound + 'Puzzle N of 6' VO,
                          onHide: renderGameplay })

function renderGameplay():
  gameState.phase = 'gameplay'
  gameState.isProcessing = false
  render clue panel (use cluesFinal for round 6, else clues)
  render logic grid (rows = subjects, cols = attrA.values + divider + attrB.values)
  render Submit button (disabled)
  attach cellTap listener to every cell
  attach submitTap listener

function onCellTap(rowIdx, colIdx):
  if gameState.isProcessing: return
  const key = `${rowIdx}-${colIdx}`
  const cur = gameState.gridState[key] || 'empty'
  const next = cur === 'empty' ? 'cross' : cur === 'cross' ? 'check' : 'empty'
  gameState.gridState[key] = next
  updateCellDOM(rowIdx, colIdx, next)
  FeedbackManager._stopCurrentDynamic()
  FeedbackManager.sound.play('sound_micro_bubble', {}).catch(()=>{})
  refreshSubmitEnabled()                     // enables when every row has exactly 1 ✅ in each block

function refreshSubmitEnabled():
  const ok = subjects.every(s => exactlyOneCheckIn(blockA, s) && exactlyOneCheckIn(blockB, s))
  submit.disabled = !ok

async function onSubmitTap():
  if gameState.isProcessing: return
  gameState.isProcessing = true
  showCheckingOverlay()                      // ~600ms
  await sleep(600)
  hideCheckingOverlay()
  const result = evaluate(gameState.gridState, gameState.currentRoundData.solution,
                          gameState.currentRoundData.clues)
  if result.correct:
    await onCorrect()
  else:
    gameState.violatedClueId = result.violatedClueId
    await onWrong(result)

async function onCorrect():
  gameState.score += 1
  progressBar.update(gameState.currentRound, 0)            // FIRST — before any await
  await FeedbackManager.sound.play('sound_correct', { sticker: STICKER_CELEBRATE })
  FeedbackManager.playDynamicFeedback({
    audio_content: `Puzzle solved! ${describeSolution(currentRoundData)}`,
    subtitle: 'Puzzle solved!',
    sticker: STICKER_CELEBRATE
  }).catch(()=>{})
  await sleep(1500)                                        // visual lock
  advanceOrFinish()

async function onWrong(result):
  progressBar.update(gameState.currentRound, 0)            // FIRST — before any await
  showFailDialogue("Oh no! That solution doesn't fit the clues.")
  await FeedbackManager.sound.play('sound_incorrect', { sticker: STICKER_SAD })
  const msg = buildViolatedClueMessage(result.violatedClueId, gameState.currentRoundData)
  FeedbackManager.playDynamicFeedback({
    audio_content: msg, subtitle: msg, sticker: STICKER_SAD
  }).catch(()=>{})
  enableNextButton(advanceOrFinish)

function advanceOrFinish():
  FeedbackManager.sound.stopAll()
  FeedbackManager._stopCurrentDynamic()
  if gameState.currentRound < 6:
    startRound(gameState.currentRound + 1)
  else:
    showVictory()

function showVictory():
  gameState.phase = 'victory'
  gameState.stars = computeStars(gameState.score)         // 6→3, 4-5→2, 1-3→1, 0→0
  // Render FIRST, then postMessage BEFORE audio
  transitionScreen.show({
    stars: gameState.stars,
    title: 'Victory 🎉',
    subtitle: `You solved ${gameState.score} of 6 puzzles!`,
    buttons: gameState.stars === 3
      ? [{ text:'Claim Stars', type:'primary', action: showStarsCollected }]
      : [{ text:'Play Again', type:'secondary', action: showMotivation },
         { text:'Claim Stars', type:'primary', action: showStarsCollected }],
    onMounted: () => {
      window.parent.postMessage({ type:'game_complete', payload:{
        score: gameState.score, totalQuestions: 6, stars: gameState.stars,
        accuracy: Math.round((gameState.score/6)*100),
        timeSpent: Date.now() - gameState.startTime
      }}, '*')
      // then audio
      FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })
        .then(() => FeedbackManager.playDynamicFeedback({
          audio_content: victoryVoText(gameState.stars, gameState.score),
          subtitle: `You solved ${gameState.score} of 6 puzzles!`,
          sticker: STICKER_CELEBRATE
        }))
    }
  })

function showMotivation():
  gameState.phase = 'motivation'
  transitionScreen.show({
    title: 'Ready to improve your score? ⚡',
    buttons: [{ text:"I'm ready! 🙌", type:'primary', action: restartToRound1 }],
    onMounted: () => FeedbackManager.sound.play('sound_motivation', { sticker: STICKER_MOTIVATE })
  })

function restartToRound1():
  gameState.score = 0
  gameState.stars = 0
  gameState.startTime = Date.now()
  gameState.isProcessing = false
  startRound(1)                                  // skips Preview + Welcome

function showStarsCollected():
  gameState.phase = 'stars_collected'
  transitionScreen.show({
    title: 'Yay! 🎉\nStars collected!',
    styles: { title: { whiteSpace:'pre-line', lineHeight:'1.3' } },
    duration: 2500,
    onMounted: () => FeedbackManager.sound.play('sound_stars_collected', { sticker: STICKER_CELEBRATE })
  })
  // after 2500ms:
  window.parent.postMessage({ type:'game_exit' }, '*')
```

### State-change table

| Step | gameState mutated | DOM update |
|------|-------------------|------------|
| Start tap | phase='welcome' | showWelcome → transitionScreen.show |
| "Let's Go!" tap | phase='round_intro', currentRound=1, currentRoundData set | round_intro transitionScreen |
| Round intro auto-end | phase='gameplay', isProcessing=false, gridState={} | render clue panel + grid |
| Cell tap | gridState[key] cycles | cell DOM repaints; submit enabled-state recomputed |
| Submit tap | isProcessing=true | Checking… overlay shown |
| 600ms elapsed | (no mutation yet) | overlay hidden |
| Correct | score++, currentRound preserved | progressBar bumps FIRST; SFX; TTS; 1500ms lock; advance |
| Wrong | violatedClueId set | progressBar bumps FIRST; fail dialogue; SFX; TTS; Next button |
| Next tap (after wrong) | (advance) | stopAll audio; advance |
| advanceOrFinish (n<6) | currentRound++ | startRound(n+1) → round_intro |
| advanceOrFinish (n=6) | phase='victory', stars computed | Victory screen; game_complete postMessage; audio sequence |
| Play Again | phase='motivation' | motivation screen |
| I'm ready! | score=0, stars=0, currentRound=1, startTime reset | startRound(1) |
| Claim Stars | phase='stars_collected' | stars_collected screen; 2500ms; game_exit postMessage |
| Tab hidden (CASE 14) | (no mutation) | VisibilityTracker popupComponent shown; audio paused; cells frozen |
| Tab visible (CASE 15) | (no mutation) | popupComponent dismissed; audio resumed; cells re-enabled |

---

## 8. CDN Component Instantiation Order

This is the EXACT order game-building must wire into the boot path. Each component is loaded from CDN and called in sequence.

```
1. ScreenLayout.inject({
     containerId: 'app',
     gameTitle: 'Cross-Logic Puzzle',
     showProgressBar: true,
     showPreviewHeader: true
   })
   // Creates persistent fixtures: preview header (top), progress bar slot
   // (below header), gameplay container (#gameContent), transition slot.

2. PreviewScreenComponent.init({
     title: 'Cross-Logic Puzzle',
     instruction: fallbackContent.previewInstruction,
     audioText: fallbackContent.previewAudioText,
     audio: fallbackContent.previewAudio,
     showGameOnPreview: false,
     onStart: showWelcome
   })
   // Renders preview with Start CTA. PreviewScreen is MANDATORY.
   // Hides progress bar while phase==='preview'.

3. ProgressBarComponent.init({
     totalRounds: 6,
     containerId: '<progressBar slot from ScreenLayout>'
   })
   // Mounted but visually hidden until phase !== 'preview'.

4. FeedbackManager init (PART-017):
   FeedbackManager.configure({ contentDir: 'audio/', stickers: STICKERS })
   VisibilityTracker.init({ popupComponent: <built-in pause overlay> })
   // Built-in popupComponent — never custom (per MEMORY feedback_pause_overlay).

5. Game loop (driven by user taps):
   showWelcome → transitionScreen.show(welcome config)
     → on CTA tap → startRound(1)
   startRound(n) → transitionScreen.show(round_intro config)
     → on sound complete → renderGameplay()
   renderGameplay() → render clue panel + logic grid + submit button into #gameContent
     → cell taps cycle gridState
     → Submit → Checking → onCorrect / onWrong → advanceOrFinish
   advanceOrFinish → startRound(n+1) OR showVictory()

6. TransitionScreenComponent (used by Welcome, Puzzle N intro, Victory, Motivation,
   Stars Collected — same component, different config payloads):
   transitionScreen.show({ icons|stars, title, subtitle, buttons, duration,
                           onMounted, persist, styles })

7. endGame / Victory:
   showVictory() → transitionScreen.show(victory config)
     onMounted: postMessage('game_complete') BEFORE audio
                → await sound.play('sound_game_victory')
                → await playDynamicFeedback(victory VO)
   On "Claim Stars" → showStarsCollected() → 2500ms auto → postMessage('game_exit')
   On "Play Again" → showMotivation() → on CTA → restartToRound1()
```

**Boot sequence (literal call order on page load):**
1. `ScreenLayout.inject(...)`
2. `PreviewScreenComponent.init(...)`
3. `ProgressBarComponent.init(...)`
4. `FeedbackManager.configure(...)` + `VisibilityTracker.init(...)`
5. PreviewScreen renders (phase='preview'); user taps Start → game loop begins
6. Game loop runs through 6 puzzles (per round-flow above)
7. Last puzzle → `showVictory()` → endGame transitions

---

## 9. Cross-Validation Checklist

- [x] Every screen in flow diagram has a wireframe (7 screens, 7 wireframes)
- [x] PreviewScreen is mandatory and present
- [x] TransitionScreen used for Welcome, Round Intro, Victory, Motivation, Stars Collected
- [x] ProgressBar position: top of game body, below preview header, on every non-Preview screen
- [x] No `game_over` screen (lives = 0; archetype Constraint 5)
- [x] Every feedback moment maps to a FeedbackManager call
- [x] Wrong-path TTS uses misconception-specific clue-naming
- [x] `progressBar.update(...)` fires FIRST in round-complete handlers (correct AND wrong), before any await
- [x] `gameState.isProcessing = true` set BEFORE 600ms Checking… await
- [x] Victory subtitle game-specific ("You solved X of 6 puzzles!")
- [x] Round 6 uses `cluesFinal` (engineer note honored)
- [x] Grid sized from `subjects.length × (attrA.values.length + attrB.values.length)` — not hardcoded
- [x] CASE 9 cell-tap SFX is fire-and-forget, never blocks input
- [x] VisibilityTracker uses built-in popupComponent (per MEMORY)
- [x] `game_complete` postMessage fires BEFORE Victory audio
- [x] Star thresholds spec-overridden: 3★=6, 2★=4-5, 1★=1-3, 0★=0 (Victory still reachable at 0★)
