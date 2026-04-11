# Feedback: Matching Doubles

## Bloom Level: L2 (Understand)

## Feedback Moment Table

| Moment | Trigger | FeedbackManager call | Subtitle template | Blocks input? | Await? | What happens after |
|--------|---------|---------------------|-------------------|---------------|--------|--------------------|
| Left item select | Tap unselected left item | `FeedbackManager.sound.play('sound_bubble_select', {}).catch(...)` | -- | No | No (fire-and-forget) | Item highlighted, awaiting right tap |
| Left item deselect | Tap already-selected left item | `FeedbackManager.sound.play('sound_bubble_deselect', {}).catch(...)` | -- | No | No (fire-and-forget) | Selection cleared |
| Correct match | Right item value = 2x left item value | `FeedbackManager.sound.play('correct_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-95.gif' }).catch(...)` | -- | No | No (fire-and-forget) | Pair locked, continue playing |
| Wrong match (lives > 0) | Right item value != 2x left item, lives > 1 | `FeedbackManager.sound.play('incorrect_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-99.gif' }).catch(...)` | -- | No | No (fire-and-forget) | Both deselect after 600ms, life lost, continue playing |
| Wrong match (last life) | Right item value != 2x left item, lives = 1 | Skip wrong SFX entirely | -- | -- | -- | Straight to game_over |
| Round complete | All pairs in round matched | `await FeedbackManager.sound.play('all_correct', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-87.gif', subtitle: 'All matched!' })` | "All matched!" | Yes | Yes (awaited) | Next round loads |
| New round content | Next round pairs render | `FeedbackManager.sound.play('new_cards', {}).catch(...)` | -- | No | No (fire-and-forget) | Items fade in 350ms |
| Victory (3 stars) | All 9 rounds done, time <= 60s | Screen + `game_complete` first, then: `await FeedbackManager.sound.play('victory_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1759297084426-230.gif' })` then `await FeedbackManager.playDynamicFeedback({ audio_content: 'Amazing! 3 stars! You matched all doubles in record time!', subtitle: 'Amazing! 3 stars!', sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1759297084426-230.gif' })` | "Amazing! 3 stars!" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Victory (2 stars) | All 9 rounds done, time <= 90s | Screen + `game_complete` first, then: `await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-113.gif' })` then `await FeedbackManager.playDynamicFeedback({ audio_content: 'Well done! 2 stars!', subtitle: 'Well done! 2 stars!', sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-113.gif' })` | "Well done! 2 stars!" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Victory (1 star) | All 9 rounds done, time > 90s | Screen + `game_complete` first, then: `await FeedbackManager.sound.play('game_complete_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-110.gif' })` then `await FeedbackManager.playDynamicFeedback({ audio_content: 'Good try! 1 star!', subtitle: 'Good try! 1 star!', sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-110.gif' })` | "Good try! 1 star!" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Game over | Lives reach 0 | Screen + `game_complete` first, then: `await FeedbackManager.sound.play('game_over_sound_effect', { sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-103.gif' })` then `await FeedbackManager.playDynamicFeedback({ audio_content: 'You completed N rounds. Try again!', subtitle: 'You completed N rounds', sticker: 'https://cdn.mathai.ai/mathai-assets/dev/figma/assets/rc-upload-1758375013588-103.gif' })` | "You completed N rounds" | CTA visible | Yes (sequential, CTA interrupts) | CTA stops all audio |
| Restart | Tap "Play Again" or "Try Again" | `FeedbackManager.sound.stopAll()` + `FeedbackManager._stopCurrentDynamic()` + `FeedbackManager.stream.stopAll()` | -- | -- | -- | All state resets, return to start |

## Subtitle Examples

### Round complete
1. "All matched!"
2. "All matched!"
3. "All matched!"

(Same subtitle every round -- multi-step round-complete is generic, not content-specific.)

### Victory (3 stars)
1. "Amazing! 3 stars!"
2. "Fantastic! 3 stars in 45 seconds!"
3. "Perfect! All doubles matched!"

### Victory (2 stars)
1. "Well done! 2 stars!"
2. "Good job! 2 stars!"
3. "Nice work! Keep practicing for 3 stars!"

### Victory (1 star)
1. "Good try! 1 star!"
2. "You did it! Try faster for more stars!"
3. "All doubles matched! Speed up for more stars!"

### Game over
1. "You completed 4 rounds. Try again!"
2. "You completed 2 rounds. Try again!"
3. "You completed 7 rounds. So close!"

## Animations

| Animation | Trigger | CSS class | Duration |
|-----------|---------|-----------|----------|
| Score bounce | Correct match | `.score-bounce` | 400ms |
| Wrong flash | Wrong match | `.selected-wrong` | 600ms |
| Heart break | Life lost | `.heart-break` | 600ms |
| Star pop | Results star earned | `.star-earned` | 400ms |
| Fade in | New round items appear | `.fade-in` | 350ms |
| Correct lock | Correct match pair | `.selected-correct` | Permanent (stays until round ends) |

## Wrong Answer Handling

- Show correct answer: No. This is a multi-step matching game -- no correct answer reveal on wrong match. Both items simply deselect and the student tries again.
- Misconception-specific feedback: No. Multi-step games use SFX + sticker only, no dynamic TTS. Misconception tags in the content data are for analytics tracking, not student-facing feedback.
- Failure recovery: Not applicable. Wrong matches cost a life but do not escalate difficulty or change feedback tone. The life system IS the failure pressure.

## Emotional Arc Notes

- **Rounds 1-3 (Easy):** Low pressure. 3 pairs are trivially matchable for the target age group. Students build confidence and learn the mechanic. Correct-match SFX provides steady positive reinforcement.
- **Rounds 4-6 (Medium):** Moderate challenge. 4 pairs with closer double values require more mental math. Occasional wrong matches create tension via life loss. The heart-break animation provides immediate visceral feedback.
- **Rounds 7-9 (Hard):** Peak challenge. 5 pairs with high confusability (doubles within +/-10 of each other). Students must compute carefully. The count-up timer creates implicit speed pressure without punishment. If a student has lost lives earlier, the remaining-lives tension peaks here.
- **End game:** Victory screen celebrates completion with star-tiered enthusiasm. Game over screen is encouraging ("You completed N rounds") not punitive. "Try Again" CTA invites replay.
