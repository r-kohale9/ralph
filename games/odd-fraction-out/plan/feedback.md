# Feedback: Odd Fraction Out

## Bloom Level: L2 (Understand)

Per spec Identity section: "Bloom Level: L2 Understand." Feedback depth: context-aware explanation referencing WHY 3/4, 6/8, 9/12 are equivalent (common scaling factor) and why 2/3 is the outlier.

## Feedback Moment Table

Shape 1 Standalone omits Welcome, Round-N intro, Victory, Game Over, "Ready to improve", and "Yay stars collected!" transitions. Only the moments below exist:

| Moment | Trigger | FeedbackManager call | Subtitle template | Blocks input? | Await? | What happens after |
|--------|---------|---------------------|-------------------|---------------|--------|--------------------|
| Preview audio | PreviewScreenComponent mounts (onMounted) | `FeedbackManager.sound.play('preview_audio', { sticker: 'alfred_teacher' })` where `preview_audio` is TTS of `previewAudioText` | "Three of these fractions are equal. One is not. Tap the odd one out." | CTA visible | No (fire-and-forget with `.catch(...)`) — "Start" CTA interrupts by calling `FeedbackManager.sound.stopAll()` | Student reads HTML prompt and taps "Start" |
| Correct (single-step) | Student taps `c4` (`2/3`) | `await FeedbackManager.sound.play('correct_sound_effect', { sticker: 'celebration' })` → `await FeedbackManager.playDynamicFeedback({ audio_content: 'You got it!', subtitle: 'You got it!', sticker: 'celebration' })` | "You got it!" | Yes (via `gameState.isProcessing = true`) | Yes (sequential, both awaited) | 2000ms dwell → `game_complete` postMessage → Game End |
| Wrong (single-step, no retry) | Student taps `c1`, `c2`, or `c3` | `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: 'sad' })` → `await FeedbackManager.playDynamicFeedback({ audio_content: "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't.", subtitle: "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't.", sticker: 'sad' })` | "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't." | Yes (via `gameState.isProcessing = true`) | Yes (sequential, both awaited) | After TTS: `c4` green reveal; 2000ms dwell → `game_complete` postMessage → Game End. **No retry.** |
| Last life wrong | N/A | — | — | — | — | Game has no lives; not applicable |
| Victory | N/A (no Victory screen in Shape 1 Standalone) | — | — | — | — | `game_complete` fires directly from feedback dwell; host handles post-game |
| Game over | N/A (no Game Over screen in Shape 1 Standalone; no lives) | — | — | — | — | Not applicable |
| Visibility hidden | Page blur / tab hidden | `FeedbackManager.sound.pauseAll()` | — | — | — | Audio paused; resumes on visibility restore |
| Visibility restored | Page focus / tab visible | `FeedbackManager.sound.resumeAll()` | — | — | — | Audio resumes mid-playback |

## Subtitle Examples

Three concrete examples per type. For Shape 1 Standalone the same single subtitle is used every time (fixed content), so examples below are variants representing what game-building should render verbatim:

**Correct subtitle (fired exactly once when `c4` is tapped):**
1. "You got it!"
2. "You got it!"
3. "You got it!"

(Per spec: correctFeedbackText is fixed — "You got it!". No variants.)

**Wrong subtitle (fired exactly once on any `c1`/`c2`/`c3` tap):**
1. "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't." (tapped `c1` = 3/4)
2. "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't." (tapped `c2` = 6/8)
3. "3/4, 6/8, 9/12 are all 3/4; 2/3 isn't." (tapped `c3` = 9/12)

(Per spec: incorrectFeedbackText is fixed across all three wrong cards. The `misconception_tag` in `recordAttempt` differs per tapped card — MISC-FRAC-EQ-01/02/03 — but the TTS/subtitle string does not.)

## Animations

| Animation | Trigger | CSS class | Duration |
|-----------|---------|-----------|----------|
| Wrong card red flash | Student taps `c1`/`c2`/`c3` | `.selected-wrong` (momentary flash) | ~600ms |
| Correct card green reveal | After correct tap OR after wrong TTS completes, applied to `c4` | `.selected-correct` | 400ms fade-in, persists through dwell |
| Fade in (cards on mount) | Gameplay screen mounts | (none — cards render immediately, no stagger in single-question Standalone) | N/A |

**Excluded animations** (not applicable to Shape 1 Standalone):
- `.score-bounce` — no ongoing score display that persists past one tap.
- `.shake-wrong` — redundant with `.selected-wrong` red flash.
- `.heart-break` — no lives in this game.
- `.streak-glow` — no streak possible with totalRounds=1.
- `.star-earned` — no Results / Victory screen renders; host app handles star display post-game_complete.

## Wrong Answer Handling

- **Show correct answer:** Yes — after wrong TTS completes, `c4` (`2/3`) gets `.selected-correct` green reveal so the student sees the right answer before Game End fires.
- **Misconception-specific feedback:** Partial — the `misconception_tag` in `recordAttempt` is per-card (MISC-FRAC-EQ-01 for tapping 3/4 the base, MISC-FRAC-EQ-02 for tapping 6/8 the "bigger-looking", MISC-FRAC-EQ-03 for tapping 9/12 the "largest numbers"). However the **TTS subtitle string is shared** across all three wrong cards per spec's `incorrectFeedbackText` field — pedagogy relies on the always-visible green reveal of `c4` to drive the correction.
- **Failure recovery (3+ consecutive wrong):** N/A — only one tap is possible; no sequence of wrongs.

## Emotional Arc Notes

Single-tap game. Emotional arc is compressed into a single beat:
- **Before tap:** neutral / curious (preview narrated the challenge, prompt reinforces it).
- **Correct:** celebratory sticker + upbeat SFX + "You got it!" — immediate closure with 3 stars.
- **Wrong:** sad sticker + soft incorrect SFX + gentle corrective TTS ("3/4, 6/8, 9/12 are all 3/4; 2/3 isn't."). The red flash is brief (~600ms) and the green reveal on `c4` directly teaches the correction before Game End.

Per spec warnings: single-question games have high variance — tone of the wrong-path TTS is explanatory, not punitive, because one tap fully determines outcome and there's no retry.
