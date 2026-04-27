# Feedback: Add 15 Numbers

## Bloom Level: L3 Apply

At L3, feedback must be **context-aware** (references the actual sum / misconception), not purely generic. The spec includes misconception tags per distractor (`MISC-ADD-01`, `MISC-ADD-02`, `MISC-CARRY-01`), so wrong-answer TTS should cite the correct sum AND optionally use the misconception explanation from fallbackContent.

## Feedback Moment Table

| Moment | Trigger | FeedbackManager call | Subtitle template | Blocks input? | Await? | What happens after |
|--------|---------|---------------------|-------------------|---------------|--------|--------------------|
| Preview audio | Preview screen mounts | `FeedbackManager.sound.play('preview_audio', {sticker: null})` then dynamic VO of `previewAudioText` | "Add the given list of numbers and tap on their sum..." (full previewAudioText) | No (CTA visible) | No (fire-and-forget) | Student taps "Let's play!" when ready — stopAll on tap |
| Welcome transition | Welcome screen mounts | `await FeedbackManager.sound.play('sound_welcome', {sticker: STICKER_WAVE})` → `await FeedbackManager.playDynamicFeedback({audio_content: "Let's get started! Tap each tile, find the sum, beat the clock!", subtitle: "Let's get started!", sticker: STICKER_WAVE})` | "Let's get started!" | No (CTA visible) | Yes (sequential, CTA interrupts with stopAll) | CTA tap routes to round_intro |
| Round N intro (auto) | round_intro screen mounts (N=1..5) | `await FeedbackManager.sound.play('rounds_sound_effect', {sticker: N===5?'🏆':'🔢'})` → `await FeedbackManager.playDynamicFeedback({audio_content: 'Round ' + N, subtitle: 'Round ' + N, sticker: null})` | "Round 1" / "Round 2" / "Round 3" / "Round 4" / "Round 5" | No CTA | Yes (sequential) | Auto-advance to gameplay after both complete |
| Tile strike-on (CASE 9) | Grid tile tapped (no `.struck` → `.struck`) | `FeedbackManager.sound.play('sound_tile_select', {sticker: null}).catch(function(e){})` | — | No | No (fire-and-forget) | Continue playing, no round effect |
| Tile strike-off (CASE 9) | Grid tile tapped (`.struck` → no `.struck`) | `FeedbackManager.sound.play('sound_tile_deselect', {sticker: null}).catch(function(e){})` | — | No | No (fire-and-forget) | Continue playing, no round effect |
| MCQ correct (single-step, CASE 4) | Student taps MCQ == correctSum | `isProcessing=true` FIRST → `progressBar.update()` FIRST → `await FeedbackManager.sound.play('correct_sound_effect', {sticker: STICKER_CELEBRATE})` → `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}).catch(...)` | "Correct sum! That's <correctSum>!" | Yes (`isProcessing=true`) | SFX yes (awaited ~1s), TTS no (fire-and-forget) | Auto-advance to round_complete_interstitial (or victory if N===5) |
| MCQ wrong, lives > 1 (single-step, CASE 7) | Student taps MCQ ≠ correctSum AND lives will remain > 0 | `isProcessing=true` FIRST → life decrement → `progressBar.update()` FIRST → `await FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_SAD})` → `FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker}).catch(...)` | "Oops! This is not the correct sum!" (subtitle); "Not quite — the sum was <correctSum>" (TTS) | Yes | SFX yes (awaited ~1s), TTS no | Auto-advance to round_complete_interstitial (no retry; student still advances to next round) |
| Timer timeout, lives > 1 (CASE 7) | TimerComponent onTimeout fires, no MCQ tapped, lives will remain > 0 | Same as wrong-MCQ except subtitle changes | "Time's up! The sum was <correctSum>" (both subtitle and TTS) | Yes | SFX yes (awaited ~1s), TTS no | Auto-advance to round_complete_interstitial |
| Last life wrong / Last life timeout (CASE 8) | Wrong MCQ OR timeout AND lives after decrement === 0 | `isProcessing=true` FIRST → life decrement → `progressBar.update()` FIRST → `await Promise.all([FeedbackManager.sound.play('incorrect_sound_effect', {sticker: STICKER_SAD}), FeedbackManager.playDynamicFeedback({audio_content, subtitle, sticker})])` — minimum 1500ms total awaited | "Not quite — the sum was <correctSum>" | Yes | Yes (AWAITED, do NOT skip) | Then game_complete postMessage, then Game Over screen |
| Round-complete interstitial | Non-fatal feedback ends AND N < 5 | `FeedbackManager.sound.play('sound_next_round', {sticker: null}).catch(function(e){})` | Title: "Average time: X.Xs" / Subtitle: "N/5 rounds complete" | No (no CTA) | No (fire-and-forget) | Auto-dismiss after 2000ms, advance to round_intro N+1 |
| Victory (CASE 11) | Correct MCQ on Round 5 OR wrong/timeout on Round 5 with lives > 0 | `progressBar.update(5, lives)` FIRST → `postMessage game_complete` → TransitionScreen mounts → `FeedbackManager.sound.play('sound_game_victory', {sticker: STICKER_CELEBRATE})` → fire-and-forget VO matching star tier (`vo_victory_stars_1` / `..._2` / `..._3`) | "Victory 🎉" / "You completed all 5 rounds! Average time: X.Xs" | Yes (CTA visible, persist:true) | Yes (sequential, CTA stopAll) | CTA tap routes to stars_collected or motivation |
| Game Over (CASE 12) | Last life lost | `postMessage game_complete` fires BEFORE audio → TransitionScreen mounts → `FeedbackManager.sound.play('sound_game_over', {sticker: STICKER_SAD})` + VO "You completed <N> rounds. Nice try!" | "Game Over" / "You ran out of lives!" | Yes (CTA visible) | Yes | CTA tap routes to motivation |
| Motivation ("Ready to improve") | motivation screen mounts (after Try Again or Play Again) | `FeedbackManager.sound.play('sound_motivation', {sticker: STICKER_MOTIVATE})` + optional VO "Ready to give it another shot?" | "Ready to improve your score? ⚡" | Yes (CTA visible) | Yes | CTA tap restarts from Round 1 (skipping preview + welcome) |
| Stars Collected | stars_collected screen mounts | `FeedbackManager.sound.play('sound_stars_collected', {sticker: STICKER_CELEBRATE})` | "Yay! 🎉\nStars collected!" (title only, no subtitle) | No (auto-dismiss 2500ms) | No (fire-and-forget) | Auto-hide after 2500ms, postMessage game_exit |
| Visibility hidden (CASE 14) | `document.visibilitychange` → hidden | VisibilityTracker handles — `autoShowPopup: true` triggers default PopupComponent pause overlay. Timer + all audio pause automatically. | "Paused" (component default) | Yes (via overlay) | — | Wait for visibility restore |
| Visibility restored (CASE 15) | `document.visibilitychange` → visible | VisibilityTracker auto-dismisses popup. Timer resumes. Audio resumes. | — | No | — | Gameplay continues from pause point |
| Audio failure (CASE 16) | Any FeedbackManager call throws | `.catch(function(e){})` swallows error. Visuals still render. Game continues. | — | — | — | Continue |

## Subtitle Examples

Using actual fallbackContent content:

### Correct (MCQ correct, context-aware)
1. Round 1 (correctSum=67): "Correct sum! That's 67!"
2. Round 3 (correctSum=102): "Correct sum! That's 102!"
3. Round 5 (correctSum=150): "Correct sum! That's 150!"

### Wrong (MCQ wrong, lives remain)
Subtitle (displayed immediately):
1. "Oops! This is not the correct sum!"
2. "Oops! This is not the correct sum!"
3. "Oops! This is not the correct sum!"

TTS (fire-and-forget, context-aware with correctSum):
1. Round 1: "Not quite — the sum was 67."
2. Round 3: "Not quite — the sum was 102."
3. Round 5: "Not quite — the sum was 150."

### Timeout (no tap within 15s, lives remain)
1. Round 1: "Time's up! The sum was 67"
2. Round 3: "Time's up! The sum was 102"
3. Round 5: "Time's up! The sum was 150"

### Round-complete interstitial (title + subtitle)
1. After Round 1 (8.4s): Title "Average time: 8.4s", Subtitle "1/5 rounds complete"
2. After Round 3 (9.1s avg): Title "Average time: 9.1s", Subtitle "3/5 rounds complete"
3. After Round 4 (9.8s avg): Title "Average time: 9.8s", Subtitle "4/5 rounds complete"

### Victory (per star tier)
1. 3★: "Victory 🎉" / "You completed all 5 rounds! Average time: 7.6s"
2. 2★: "Victory 🎉" / "You completed all 5 rounds! Average time: 10.2s"
3. 1★: "Victory 🎉" / "You completed all 5 rounds! Average time: 12.4s"

### Game Over
1. After Round 1 game-over: Title "Game Over", Subtitle "You ran out of lives!"
2. Same strings regardless of which round triggered the game-over — spec uses default Game Over copy.

## Animations

| Animation | Trigger | CSS class | Duration |
|-----------|---------|-----------|----------|
| Score bounce | Correct MCQ tap (after progressBar.update) | `.score-bounce` | 400ms |
| Correct flash (green) | Correct MCQ tap; also correct option reveal on wrong | `.correct` | 600ms |
| Wrong flash + shake | Wrong MCQ tap | `.wrong` + `.shake-wrong` | 600ms (flash) / 500ms (shake) |
| Heart break | Life lost (wrong or timeout) | `.heart-break` on the just-lost heart | 600ms |
| Tile strike-on | Grid tile tap toggle on | `.struck` (gray fill + red diagonal line) | Instant (no timing) |
| Tile strike-off | Grid tile tap toggle off | Remove `.struck` | Instant |
| Round fade-in | Grid tiles render on new round | `.fade-in` | 350ms |
| MCQ fade-in | MCQ buttons reveal after grid | `.fade-in` | 350ms |
| Star pop | Victory star earned | `.star-earned` | 400ms (staggered per star) |

Note: streakGlow is NOT included (spec does not track streaks). heartBreak IS included (lives > 0 in this game).

## Wrong Answer Handling

- **Show correct answer: always.** On wrong MCQ or timeout, the correct option receives `.correct` (green) so the student sees it.
- **Misconception-specific feedback: partial.** The subtitle is generic ("Oops!" / "Time's up!") to keep the feedback window short and predictable; the fire-and-forget TTS is context-aware ("Not quite — the sum was X"). The spec includes `misconception_tags` and `misconception_explanations` per distractor — these are REFERENCE DATA for analytics / future depth but are NOT spoken in v1. This avoids bloating the wrong-answer window to >3s, which would compound the per-round timer pressure.
- **Failure recovery: not needed.** There is no retry on wrong answer — the student advances through all 5 rounds regardless (wrong answers cost a life, not the round). No "3+ consecutive wrong" softening path.
- **No partial credit.** Wrong or timeout = 0 points for that round AND -1 life.

## Emotional Arc Notes

- **Warmup (R1-2) mood:** light, encouraging — small numbers, gentle distractors. TTS uses affirming tone on correct, neutral-informative on wrong.
- **Core (R3-4) mood:** focused, activating — make-ten pairs in tile sets invite strategy. Correct feedback emphasizes the achievement ("That's 102!").
- **Boss (R5) mood:** heightened — Boss intro uses 🏆 sticker. Victory subtitle includes the summary metric (average time). 3★ players get a pure celebration (no "Play Again"). 1-2★ players see "Play Again" first (secondary button) to invite a retry.
- **Game Over mood:** gentle — "You ran out of lives!" is the default copy (non-punitive). "Try Again" routes through motivation which nudges the student back in.
- **Warning from spec:** Timer + Lives compounds difficulty. If playtest shows excessive Round-1 game-overs, consider softening timeout to 0-points-but-no-life-lost. Not implemented in v1 per creator spec.
