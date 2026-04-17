### PART-017: Feedback Integration
**Purpose:** Audio feedback and sticker animations on correct/incorrect answers.
**Condition:** Game has audio feedback or sticker moments.
**API (preload):** `await FeedbackManager.sound.preload([{ id, url }, ...])` — NO `register()` method
**API (play):** `await FeedbackManager.sound.play('correct_tap', { subtitle, sticker: { image, duration } })`
**Key rules:**
- Simple games: preload `correct_tap` + `wrong_tap`
- Multi-part games: preload `all_correct`, `partial_correct_attempt1`, `partial_correct_last_attempt`, `all_incorrect_attempt1`, `all_incorrect_last_attempt`
- Sticker object: `{ image: URL, duration: seconds }` — shows animated GIF overlay
- Use `preload()` with array of `{id, url}` — there is NO `register()` method
- **No `Promise.race` on FeedbackManager calls (CRITICAL).** `sound.play()` / `playDynamicFeedback()` are already bounded internally by the package (audio-duration + 1.5s guard timeout; 60s streaming safety; 3s TTS API timeout). Templates MUST `await` them directly inside `try/catch`. Any `Promise.race([FeedbackManager..., setTimeout(...)])` or helper like `audioRace` is an error — validator rule `5e0-FEEDBACK-RACE-FORBIDDEN`. See PART-026 Anti-Pattern 32.
- **Minimum Feedback Duration (CRITICAL).** `sound.play()` can resolve BEFORE the audio finishes playing. All answer-feedback `sound.play()` calls (`sound_life_lost`, `sound_correct`, `wrong_tap`, `correct_tap`, `sound_incorrect`, `all_correct`, `all_incorrect_*`, `partial_correct_*`) MUST be wrapped in `Promise.all` with a 1500ms minimum delay: `await Promise.all([ FeedbackManager.sound.play(id, { sticker }), new Promise(function(r) { setTimeout(r, 1500); }) ]);`. This guarantees the audio/sticker fully plays before the game proceeds to the next action (round advance, tile reset, game-over check). Does NOT apply to VO or transition audio. Validator rule `5e0-FEEDBACK-MIN-DURATION`. See PART-026 Anti-Pattern 34.

## Verification Checklist

- [ ] No `Promise.race(...)` wrapping `FeedbackManager.sound.play` / `playDynamicFeedback` / `audioRace` helper; templates await FeedbackManager calls directly inside `try/catch`
- [ ] Answer-feedback `sound.play()` calls wrapped in `Promise.all` with 1500ms minimum delay — bare `await` resolves before audio finishes (Anti-Pattern 34, validator rule `5e0-FEEDBACK-MIN-DURATION`)
