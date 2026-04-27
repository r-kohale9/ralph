# Screens: Add 15 Numbers

## Screen Inventory

Every screen rendered by this game, with its `data-phase` value. Every screen listed here is a required render target; every button listed is a required `transitionScreen.show` button label to be copied VERBATIM by game-building.

- `preview` (data-phase="preview") — PreviewScreenComponent (PART-039)
- `welcome` (data-phase="welcome") — TransitionScreen
- `round_intro` (data-phase="round_intro") — TransitionScreen (auto-advance, no buttons; one per round 1..5)
- `gameplay` (data-phase="gameplay") — primary game body (timer + grid + MCQ)
- `round_complete_interstitial` (data-phase="round_complete_interstitial") — TransitionScreen (auto, no buttons, 2000ms)
- `game_over` (data-phase="game_over") — TransitionScreen
- `motivation` (data-phase="motivation") — TransitionScreen ("Ready to improve your score?")
- `victory` (data-phase="victory") — TransitionScreen
- `stars_collected` (data-phase="stars_collected") — TransitionScreen (auto-dismiss)

Persistent fixtures (rendered on every non-preview screen):
- **Preview header** at the very top — owned by PreviewScreenComponent (avatar, question label, score, star). Timer mounts inside `.mathai-preview-header-center` during gameplay.
- **Progress bar** immediately below the header — owned by `ScreenLayout + ProgressBarComponent` (PART-023), shows `currentRound/5` and 3 heart icons. Visible on every screen except `preview`.

---

## preview (data-phase="preview")

### Layout

```
+-----------------------------+
|  (no progress bar on        |
|   preview — it lives on     |
|   the game body)            |
|                             |
|   Preview header (avatar,   |
|   "Add 15 Numbers", score 0)|
|                             |
|   Objective card            |
|   "Add the given list of    |
|    numbers and tap on       |
|    their sum!"              |
|                             |
|   "You have 15 seconds      |
|    per round. 3 lives.      |
|    5 rounds."               |
|   "Tap a tile to cross it   |
|    out — it helps you       |
|    keep track."             |
|                             |
|   🔊 (preview audio auto-   |
|       plays on mount)       |
|                             |
|   [     Let's play!      ]  |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | avatar + "Add 15 Numbers" label + score 0 + star icon | no |
| previewInstruction body | center | "Add the given list of numbers and tap on their sum! You have 15 seconds per round. 3 lives. 5 rounds. Tap a tile to cross it out — it just helps you keep track." (HTML from spec fallbackContent) | no |
| Preview audio | (auto, onMounted) | `previewAudioText` is TTS-narrated on mount; visible audio button available to replay | tap (replay only) |
| CTA 1 | bottom | "Let's play!" → routes to `welcome` | tap |

### Entry condition
Initial game load.

### Exit condition
Student taps "Let's play!" → `welcome`.

---

## welcome (data-phase="welcome")

### Layout

```
+-----------------------------+
|  [preview header (persistent)]
|  [progress bar: 0/5, 3 ❤]   |
|                             |
|                             |
|           👋                |
|                             |
|      "Let's get started!"   |
|                             |
|  "Tap each tile, find the   |
|   sum, beat the clock!"     |
|                             |
|   🔊 welcome VO             |
|                             |
|                             |
|    [    I'm ready!    ]     |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `0/5`, 3 hearts full | no |
| Sticker / Icon | top-center | `👋` | no |
| Title | center | "Let's get started!" | no |
| Subtitle | center | "Tap each tile, find the sum, beat the clock!" | no |
| Audio | (auto, onMounted) | `sound_welcome` + `STICKER_WAVE` + dynamic VO: "Let's get started! Tap each tile, find the sum, beat the clock!" | no |
| CTA 1 | bottom | "I'm ready!" → routes to `round_intro` for Round 1 | tap |

### Entry condition
From `preview` via "Let's play!" tap.

### Exit condition
Student taps "I'm ready!" → `round_intro` (Round 1).

---

## round_intro (data-phase="round_intro")  — one per round N ∈ {1..5}

### Layout

```
+-----------------------------+
|  [preview header (persistent)]
|  [progress bar: (N-1)/5, L ❤]
|                             |
|                             |
|                             |
|          Round N            |
|                             |
|   (subtitle varies by       |
|    stage — see table)       |
|                             |
|   🔊 "Round N" VO + sound   |
|                             |
|                             |
|    (no buttons — auto       |
|     advances after sound)   |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `(N-1)/5`, current lives | no |
| Sticker / Icon | top-center | `🔢` (Round 1-4) or `🏆` (Round 5 Boss) | no |
| Title | center | "Round 1" / "Round 2" / "Round 3" / "Round 4" / "Round 5" | no |
| Subtitle | center | R1: "Warm-up — 12 numbers"; R2: "Keep going — 12 numbers"; R3: "Getting bigger — 14 numbers"; R4: "Stay sharp — 14 numbers"; R5: "Boss round — 15 numbers!" | no |
| Audio | (auto, onMounted) | `rounds_sound_effect` + dynamic VO "Round N" (awaited sequential, then auto-advance) | no |

No buttons — TransitionScreen auto-advances to `gameplay` after audio completes (~1200ms).

### Entry condition
From `welcome` (first round), from `round_complete_interstitial` (rounds 2-5), or from `motivation` (restart to round 1).

### Exit condition
Audio finishes → automatic advance to `gameplay`.

---

## gameplay (data-phase="gameplay")

### Layout

```
+---------------------------------+
|  [preview header]               |
|   ┌─────────────────────────┐   |
|   │ avatar │ Add 15 Numbers │   |
|   │        │ [⏱ 15s ████░] │   |  <- TimerComponent mounted in
|   │        │ score: 3  ⭐   │   |     .mathai-preview-header-center
|   └─────────────────────────┘   |     (PART-006)
|  [progress bar: 2/5, 3 ❤]       |
|                                 |
|  "Add the given list of         |
|   numbers and tap on their sum!"|
|                                 |
|   ┌────┬────┬────┐              |
|   │  5 │  8 │  3 │              |
|   ├────┼────┼────┤              |
|   │  7 │  6 │  2 │              |
|   ├────┼────┼────┤              |  <- grid of 12-15 tiles,
|   │  9 │  4 │  8 │              |     3 cols × 4-5 rows
|   ├────┼────┼────┤              |
|   │  5 │  3 │  7 │              |
|   └────┴────┴────┘              |
|                                 |
|   [  64  ] [  67  ] [  77  ]    |  <- 3 MCQ buttons, single row
|                                 |
+---------------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture (avatar + title + score + star) | no |
| Timer | inside `.mathai-preview-header-center` | PART-006 TimerComponent — shrinking horizontal bar + "15s" → "0s" countdown. Mount via `new TimerComponent({container: '#timer-container', duration: 15000, onTimeout: handleTimeout})` | no (visual only) |
| Progress bar | below header, full width | PART-023 `currentRound/5` with 3 heart icons reflecting current lives | no |
| Prompt banner | centered, above grid | "Add the given list of numbers and tap on their sum!" (game-specific per-round prompt, NOT a duplicate of preview instructions) | no |
| Grid | center-body | 12-15 number tiles in 3-column CSS grid. Tile shows integer (1-20). Tap toggles `.struck` class (gray fill + red diagonal line). Tap fires CASE 9 bubble/deselect SFX. Does NOT submit. Min 44×44 CSS px touch target. 8px spacing. | tap (toggle strike) |
| MCQ button row | bottom-body, above safe area | 3 buttons in a single horizontal row, each labelled with an integer candidate sum. Tap is the commit action. Min 44×44 touch target. 8px spacing. | tap (commit) |

### Entry condition
From `round_intro` after Round N intro audio completes.

### Exit condition
- Student taps an MCQ button → `gameplay` runs feedback (inline, same screen) → `round_complete_interstitial`.
- Timer hits 0s → timeout handler runs feedback (inline, same screen) → `round_complete_interstitial`.
- If feedback ran and lives just reached 0 → skip interstitial, go to `game_over`.
- If feedback ran on correct answer and N === 5 → skip interstitial, go to `victory`.

### Round Presentation Sequence

1. **Question preview** (0-350ms) — grid tiles fade in with `.fade-in` (350ms). MCQ buttons render with `opacity: 0` and `pointer-events: none`.
2. **Instructions** — NONE rendered on gameplay. The how-to-play copy is owned exclusively by PreviewScreenComponent (`previewInstruction` + `previewAudioText`) and shown once before Round 1. The round-type change (tile count / value range per stage) is conveyed by the `round_intro` TransitionScreen subtitle (e.g. "Boss round — 15 numbers!"), not by a banner on gameplay. The per-round prompt "Add the given list of numbers and tap on their sum!" is a semantically-distinct call-to-action (WHAT to tap now), not the full how-to-play.
3. **Media** — no audio or video plays during round presentation. Timer SFX optional (tick in final 3s is OUT-OF-SCOPE — spec does not list).
4. **Gameplay reveal** (350ms) — MCQ buttons fade in (`.fade-in`), TimerComponent starts counting down (15000ms), grid tiles become tappable (`isProcessing = false`).

---

## round_complete_interstitial (data-phase="round_complete_interstitial")

### Layout

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: N/5, L ❤]   |
|                             |
|                             |
|           ⏱                 |
|                             |
|   "Average time: 8.4s"      |
|                             |
|   "2/5 rounds complete"     |
|                             |
|   🔊 short next-round SFX   |
|       (fire-and-forget)     |
|                             |
|    (no buttons — auto       |
|     advances after 2000ms)  |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `N/5` (already bumped), current lives | no |
| Sticker / Icon | top-center | `⏱` | no |
| Title | center | "Average time: X.Xs" (X.X = running average per-round response time in seconds, one decimal) | no |
| Subtitle | center | "N/5 rounds complete" where N = currentRound just finished | no |
| Audio | (auto, onMounted) | `FeedbackManager.sound.play('sound_next_round', {sticker: null}).catch(function(e){})` — fire-and-forget, no subtitle | no |

No buttons — auto-advances after 2000ms duration to `round_intro` for Round N+1.

### Entry condition
From `gameplay` after a non-fatal feedback (correct or wrong-with-lives-remaining) AND N < 5.

### Exit condition
2000ms elapsed → advance to `round_intro` for Round N+1.

---

## game_over (data-phase="game_over")

### Layout

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: N/5, 0 ❤]   |
|                             |
|                             |
|           😔                |
|                             |
|        "Game Over"          |
|                             |
|   "You ran out of lives!"   |
|                             |
|   🔊 sound_game_over        |
|                             |
|                             |
|    [     Try Again     ]    |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | last attempted round / 5, 0 hearts | no |
| Sticker / Icon | top-center | `😔` | no |
| Title | center | "Game Over" | no |
| Subtitle | center | "You ran out of lives!" | no |
| Audio | (auto, onMounted) | `sound_game_over` + `STICKER_SAD` | no |
| CTA 1 | bottom | "Try Again" → `motivation` | tap |

### Entry condition
From `gameplay` after wrong/timeout feedback when `lives === 0`. The wrong SFX sequence finishes first (Promise.all ≥1500ms), then `game_complete` postMessage fires BEFORE this screen's audio (feedback/SKILL.md CASE 8/12).

### Exit condition
Student taps "Try Again" → `motivation`.

---

## motivation (data-phase="motivation")

### Layout

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: preserved]  |
|                             |
|                             |
|                             |
|   "Ready to improve your    |
|           score? ⚡"         |
|                             |
|                             |
|   🔊 motivation VO          |
|                             |
|                             |
|    [   I'm ready! 🙌    ]   |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | preserved from previous screen (until restart hits Round 1) | no |
| Title | center | "Ready to improve your score? ⚡" | no |
| Audio | (auto, onMounted) | `sound_motivation` + `STICKER_MOTIVATE` | no |
| CTA 1 | bottom | "I'm ready! 🙌" → `restartToRound1` (resets gameState.lives=3, score=0, currentRound=1; routes to `round_intro` for Round 1, skipping Preview + Welcome) | tap |

### Entry condition
From `game_over` ("Try Again"), OR from `victory` with `stars < 3` ("Play Again").

### Exit condition
Student taps "I'm ready! 🙌" → `round_intro` (Round 1 of restart).

---

## victory (data-phase="victory")

### Layout (3-star variant)

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: 5/5, L ❤]   |
|                             |
|                             |
|        ⭐ ⭐ ⭐              |
|                             |
|        "Victory 🎉"         |
|                             |
|  "You completed all 5       |
|   rounds! Avg time: 9.2s"   |
|                             |
|   🔊 sound_game_victory     |
|                             |
|                             |
|    [   Claim Stars    ]     |
+-----------------------------+
```

### Layout (1-2 star variant)

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: 5/5, L ❤]   |
|                             |
|                             |
|        ⭐ ⭐ ☆              |
|                             |
|        "Victory 🎉"         |
|                             |
|  "You completed all 5       |
|   rounds! Avg time: 11.3s"  |
|                             |
|   🔊 sound_game_victory     |
|                             |
|  [ Play Again ] [Claim Stars]|
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `5/5`, lives remaining reflected in hearts | no |
| Stars | top-center | `gameState.stars` (1, 2, or 3) — drives star-row render; do NOT pass `icons` | no |
| Title | center | "Victory 🎉" | no |
| Subtitle | center | "You completed all 5 rounds! Average time: X.Xs" (X.X from gameState averageTime, spec override of default Victory subtitle) | no |
| Audio | (auto, onMounted) | `sound_game_victory` + `STICKER_CELEBRATE` + VO "vo_victory_stars_N" where N = stars tier | no |
| CTA 1 (if stars === 3) | bottom | "Claim Stars" → `stars_collected` | tap |
| CTA 1 (if stars < 3) | bottom-left | "Play Again" → `motivation` | tap |
| CTA 2 (if stars < 3) | bottom-right | "Claim Stars" → `stars_collected` | tap |

### Entry condition
From `gameplay` after correct feedback on Round 5 AND `lives >= 1`. ProgressBar bumps to 5/5 FIRST (cross-cutting rule 0 — MEMORY progress_bar_round_complete), `game_complete` postMessage fires BEFORE audio.

### Exit condition
"Claim Stars" → `stars_collected`, OR "Play Again" (if visible) → `motivation`.

---

## stars_collected (data-phase="stars_collected")

### Layout

```
+-----------------------------+
|  [preview header]           |
|  [progress bar: 5/5, L ❤]   |
|                             |
|                             |
|            ✨               |
|                             |
|          "Yay! 🎉"          |
|      "Stars collected!"     |
|                             |
|   🔊 sound_stars_collected  |
|   + star animation          |
|                             |
|                             |
|    (no buttons — auto       |
|     dismisses @ 2500ms,     |
|     then posts game_exit)   |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `5/5`, final hearts | no |
| Title | center | "Yay! 🎉\nStars collected!" (two bold lines; `styles.title.whiteSpace = 'pre-line'`) | no |
| Audio | (auto, onMounted) | `sound_stars_collected` + `STICKER_CELEBRATE` | no |
| Duration | — | `2500` ms auto-hide | no |

No buttons — on hide, `window.parent.postMessage({ type: 'game_exit' }, '*')`.

### Entry condition
From `victory` "Claim Stars" tap.

### Exit condition
2500ms elapsed → exit (postMessage to host).
