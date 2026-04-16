# Screens: Odd Fraction Out

## Screen Inventory

Shape 1 Standalone collapses the flow to its minimum. Only two render targets exist:

- **preview** (data-phase="preview") — PreviewScreenComponent overlay
- **gameplay** (data-phase="gameplay") — game body with four fraction cards; also hosts the in-place Feedback dwell (same screen, overlaid feedback sticker + subtitle via FeedbackManager)

No welcome, no round_intro, no results, no game_over — Shape 1 Standalone omits all transition screens.

Persistent fixtures on the gameplay screen: preview header (avatar, question label, score area, star slot) at the very top. **No progress bar** — Shape 1 Standalone hides it per `reference/shapes.md`. Lives UI is not rendered — the game has no lives.

---

## preview (data-phase="preview")

### Layout

```
+-----------------------------+
| [avatar] Question 1    ★ 0 |  <- preview header (fixed, owned by PreviewScreenComponent)
+-----------------------------+
|                             |
|                             |
|  Find the fraction that     |  <- previewInstruction (HTML, bold heading),
|  isn't equal to the others. |     centered in overlay body
|                             |
|                             |
|         [ Start ]           |  <- CTA button, centered-bottom, primary style
|                             |
+-----------------------------+
```

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top (persistent) | Avatar + "Question 1" label + star slot (shows 0 before game ends) | no |
| Preview instruction | center | `<p><strong>Find the fraction that isn't equal to the others.</strong></p>` (rendered as HTML) | no |
| Preview audio (auto, onMounted) | — | Plays TTS of `previewAudioText`: "Three of these fractions are equal. One is not. Tap the odd one out." via FeedbackManager.sound.play on mount | no |
| CTA | bottom | **"Start"** → dismisses preview overlay, stops preview audio if still playing, transitions to gameplay | tap |

### Entry condition

Game first loads — PreviewScreenComponent mounts automatically.

### Exit condition

Student taps **"Start"** → preview overlay dismisses, preview audio stops, gameplay screen becomes active (data-phase flips to "gameplay").

---

## gameplay (data-phase="gameplay")

### Layout

```
+-----------------------------+
| [avatar] Question 1    ★ 0 |  <- preview header (persistent, below viewport top)
+-----------------------------+
|                             |
| Tap the fraction that is    |  <- prompt heading, centered, upper 40%
| NOT equal to the others.    |     (min 18px)
|                             |
|   ┌───────┐    ┌───────┐    |
|   │  3    │    │  6    │    |  <- Card c1 (3/4)    Card c2 (6/8)
|   │  ─    │    │  ─    │    |     stacked fraction (min 28px)
|   │  4    │    │  8    │    |
|   └───────┘    └───────┘    |
|                             |
|   ┌───────┐    ┌───────┐    |
|   │  9    │    │  2    │    |  <- Card c3 (9/12)   Card c4 (2/3, correct)
|   │  ─    │    │  ─    │    |
|   │ 12    │    │  3    │    |
|   └───────┘    └───────┘    |
|                             |
+-----------------------------+
```

2×2 grid, cards in lower 60% (thumb zone). Card size >120×120 px on 375px-wide screens, min 8px gap.

### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top (persistent) | Avatar + "Question 1" label + star slot | no |
| Prompt heading | upper-center | "Tap the fraction that is NOT equal to the others." | no |
| Card c1 | grid row 1, col 1 | Fraction `3/4` stacked (numerator above bar, denominator below) | tap (incorrect) |
| Card c2 | grid row 1, col 2 | Fraction `6/8` stacked | tap (incorrect) |
| Card c3 | grid row 2, col 1 | Fraction `9/12` stacked | tap (incorrect) |
| Card c4 | grid row 2, col 2 | Fraction `2/3` stacked | tap (correct) |

Card base styling: `--mathai-surface` bg with `--mathai-border`. On correct-selection: `--mathai-success` green. On wrong-selection (tapped): `--mathai-danger` red flash ~600ms, then `2/3` card lights green.

### Entry condition

Student taps "Start" on Preview overlay.

### Exit condition

Student taps any card → input blocked → feedback plays in-place (SFX awaited, then TTS awaited, then correct card green-highlighted if the tap was wrong) → 2000ms dwell after TTS completes → `game_complete` postMessage fires → Game End (host resumes). No screen navigation; the feedback and end event happen on this same screen.

### Round Presentation Sequence

Within the gameplay screen, the single round follows this sequence:

1. **Question preview** — prompt heading ("Tap the fraction that is NOT equal to the others.") renders immediately on gameplay entry. Four fraction cards render simultaneously with the prompt (no staggered fade for this single-question shape).
2. **Instructions** — **NONE rendered on gameplay.** The how-to-play copy is delivered ONCE by PreviewScreenComponent via `previewInstruction` + `previewAudioText`. The gameplay-screen **prompt** ("Tap the fraction that is NOT equal to the others.") is a per-round prompt, semantically distinct from the preview instruction (preview said "find the odd one out"; gameplay prompt says "tap the non-equal one") — acceptable per skill Constraint 7.
3. **Media** — none. No auto-TTS on gameplay entry (preview already narrated). No video. No background audio.
4. **Gameplay reveal** — cards visible and tappable from the moment gameplay screen mounts. Input is unblocked on mount. No 350ms fade-in stagger needed for a single-question standalone game.

---

## Round Presentation Sequence (summary)

Single round, Type A only:
1. Prompt + cards render together.
2. No instruction panel (preview owned that copy).
3. No media.
4. Input unblocks immediately on gameplay entry.
