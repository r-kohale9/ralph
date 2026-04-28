# Default Transition Screens

Canonical designs for the four standard end-of-flow transition screens. Every generated game MUST use these templates for `game_over`, `motivation`, `victory`, and `stars_collected` unless the spec explicitly overrides a field.

Rule of application:
- **Structure** (what screens exist, their order, the buttons, the icon slot vs. stars slot, the button count logic) is FIXED — never deviates.
- **Strings** (title, subtitle, button labels) are the defaults listed here; replaced ONLY if the spec's `## Flow` or the Elements table explicitly specifies different copy.
- **Audio ids** are the defaults; replaced only if the spec or feedback plan names different sounds.

## 1. Game Over

Shown when `gameState.lives` decrements to 0 during gameplay.

| Field | Default |
|---|---|
| `icons` | `['😔']` |
| `title` | `"Game Over"` |
| `subtitle` | `"You ran out of lives!"` |
| `stars` | — (do NOT pass; conflicts with `icons`) |
| `buttons` | `[{ text: 'Try Again', type: 'primary', action: showMotivation }]` |
| `persist` | `true` |
| `onMounted` | `FeedbackManager.sound.play('sound_game_over', { sticker: STICKER_SAD })` |

Spec may override: subtitle (if the game has a specific game-over message), onMounted sound id.

## 2. Motivation ("Ready to improve")

Shown after `Try Again` on Game Over, and after `Play Again` on a < 3★ Victory. One tap advances to Round 1 restart (preview + welcome SKIPPED).

| Field | Default |
|---|---|
| `icons` | — (none — no emoji slot on this screen) |
| `title` | `"Ready to improve your score? ⚡"` |
| `subtitle` | — (none) |
| `stars` | — (none) |
| `buttons` | `[{ text: "I'm ready! 🙌", type: 'primary', action: restartToRound1 }]` |
| `persist` | `true` |
| `onMounted` | `FeedbackManager.sound.play('sound_motivation', { sticker: STICKER_MOTIVATE })` |

Spec may override: the word `"score"` in the title (e.g. `"speed"`, `"accuracy"`, `"time"`) when the game has a non-accuracy primary metric. Default is `"score"`.

**Progress bar on this screen — reset to initial state.** When the default flow is used (Motivation exists), the restart-path reset is placed here: on entering Motivation (from Game Over `Try Again` or from <3★ Victory `Play Again`), call `progressBar.update(0, totalLives)` inside the `onMounted` callback alongside the motivation VO, so the bar paints `0/N` with full hearts the instant the screen mounts. This is what visually signals "game is ready to start fresh — are you ready?" before the student taps "I'm ready!".

If a spec overrides the default flow and omits Motivation, the reset moves to `restartGame()` instead — the rule is tied to the restart action, not to this screen specifically. `restartGame()` always calls `update(0, totalLives)` as a safety net, so the invariant holds either way. See `alfred/skills/game-building/reference/flow-implementation.md` § "Restart-path reset — placement by flow shape".

## 3. Victory

Shown when the last round is cleared with `lives >= 1`.

| Field | Default |
|---|---|
| `icons` | — (do NOT pass; conflicts with `stars`) |
| `title` | `"Victory 🎉"` |
| `subtitle` | **game-specific** — e.g. `"Completed within 15 seconds!"`, `"You got 9 of 9 right!"`, `"Perfect score!"`. The spec / feedback plan provides this string. |
| `stars` | `gameState.stars` (0, 1, 2, or 3 — drives the star row rendering) |
| `buttons` | conditional on `gameState.stars`:  <br>• `stars === 3` → `[{ text: 'Claim Stars', type: 'primary', action: showStarsCollected }]`  <br>• `stars < 3` → `[{ text: 'Play Again', type: 'secondary', action: showMotivation }, { text: 'Claim Stars', type: 'primary', action: showStarsCollected }]` (horizontal layout — component handles it) |
| `persist` | `true` |
| `onMounted` | `FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })` |

Spec may override: subtitle (always game-specific), onMounted sound id.

## 4. Stars Collected

Shown after tapping `Claim Stars` on Victory. Short celebration. Persists until the student taps the FloatingButton `Next` — see Exception note below.

| Field | Default |
|---|---|
| `icons` | — (none) |
| `title` | `"Yay! 🎉\nStars collected!"` — two bold lines; newline rendered via per-call style override. |
| `subtitle` | — (none) |
| `stars` | — (none) |
| `buttons` | — (none — auto-dismisses) |
| `styles` | `{ title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }` — required so the `\n` in the title renders as a line break. |
| `onMounted` | `FeedbackManager.sound.play('sound_stars_collected', { sticker: STICKER_CELEBRATE })` |
| After Next tap | transitionScreen.hide() + previewScreen.destroy() + window.parent.postMessage({ type: 'game_exit' }, '*') |

**Exception to the no-button auto-dismiss rule.** Generated games normally emit `await FeedbackManager.sound.play(...); transitionScreen.hide();` inside `onMounted` for no-button transition screens (per PART-024). Stars Collected is the terminal end-of-game surface and must opt out: the screen must stay visible after audio ends, so the star animation (fired via `show_star` postMessage) and the FloatingButton "Next" mode appear over the celebration screen instead of against an empty background. Do NOT call `transitionScreen.hide()` in the Stars Collected `onMounted`. Sequence: `await sound.play(...)` → fire `show_star` → `setTimeout(1100) → floatingBtn.setMode('next')`. The FloatingButton's `on('next', ...)` handler owns the eventual `transitionScreen.hide()` + `previewScreen.destroy()` + `game_exit`.

Spec may override: onMounted sound id. Title is FIXED.

## Screens.md Elements table (copy-paste template)

When the planner writes `screens.md`, each of the four screens' Elements table should match these defaults exactly. Example for Game Over:

```markdown
### Elements

| Element | Position | Content | Interactive? |
|---------|----------|---------|-------------|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 0 lives, last attempted round | no |
| Sticker / Icon | top-center | `😔` | no |
| Title | center | "Game Over" | no |
| Subtitle | center | "You ran out of lives!" | no |
| Audio | (auto, onMounted) | `sound_game_over` + `STICKER_SAD` | no |
| CTA 1 | bottom | "Try Again" → motivation | tap |
```

The strings in quotes must match the default templates verbatim unless the spec specifies a different string.

## Conflicts and constraints

- `stars` and `icons` share the same DOM slot (see PART-024). Victory uses `stars`; Game Over / Motivation / Stars Collected use `icons` or neither.
- `duration` is documented on TransitionScreenComponent but unimplemented (PART-024) — never rely on it. Stars Collected persists until the FloatingButton `Next` tap; all other screens use `buttons` for dismiss.
- Inline emoji (🎉 in "Victory 🎉", ⚡ in the motivation title, 🙌 in "I'm ready! 🙌") live INSIDE the `title` / button `text` string — NOT in a separate `icons: [...]` array.

## Enforcement

`test/content-match.test.js` verifies the Elements table strings match the generated `transitionScreen.show({...})` call. `stars+icons` conflict and duplicate-star rendering are also caught.
