# Default Transition Screens

Canonical designs for the four standard end-of-flow transition screens. Every generated game MUST use these templates for `game_over`, `motivation`, `victory`, and `stars_collected` unless the spec explicitly overrides a field.

Rule of application:
- **Structure** (what screens exist, their order, the buttons, the icon slot vs. stars slot, the button count logic) is FIXED — never deviates.
- **Strings** (title, subtitle, button labels) are the defaults listed here; replaced ONLY if the spec's `## Flow` or the Elements table explicitly specifies different copy.
- **Audio ids** are the defaults; replaced only if the spec or feedback plan names different sounds.

## FloatingButton ownership per screen

The Next CTA contract is split between in-card buttons and the FloatingButton. Get this wrong and you either (a) double-up Next surfaces (player taps card-Next, then floating-Next, confused which fires `next_ended`) or (b) strip required in-card buttons and break the documented end-of-flow loop.

| Screen | In-card `buttons:` | FloatingButton state on entry |
|---|---|---|
| Welcome | `[{text: "Let's go!", action: showRoundIntro(1)}]` | `setMode('hidden')` |
| Round Intro | `[]` (auto-resolves after audio) | `setMode('hidden')` |
| Game Over | `[{text: "Try Again", action: showMotivation}]` | `setMode('hidden')` |
| Motivation | `[{text: "I'm ready! 🙌", action: restartGame}]` | `setMode('hidden')` |
| **Victory** | `stars === 3` → `[Claim Stars]`<br>`stars < 3` → `[Play Again, Claim Stars]` | `setMode('hidden')` |
| Stars Collected | `[]` (persist; dismisses via FloatingButton OR setTimeout to AnswerComponent) | `answerComponent: true` → still hidden, set in `showAnswerCarousel`<br>`answerComponent: false` → `setMode('next')` in `onMounted` after audio |
| AnswerComponent reveal (not a TS) | n/a | `setMode('next')` — the only place navigation-verb Next lives |

**Rules:**
- In-card buttons own SEMANTIC end-game ACTIONS: `Play Again`, `Claim Stars`, `Try Again`, `I'm ready`, `Let's go`, `Skip`. These name a destination/branch.
- FloatingButton owns NAVIGATION VERBS: `Next`, `Continue`, `Done`, `Finish`. These advance the lifecycle.
- `floatingBtn.setMode('hidden')` MUST be called before `transitionScreen.show()` for Victory / Game Over / Motivation. Enforced by `GEN-FLOATING-BUTTON-LIFECYCLE`.
- Putting a navigation verb (`Next` etc.) inside any TS button is forbidden by `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`.
- Stripping the Victory `buttons:` array (e.g. `buttons: []` + `onDismiss` workaround) is forbidden by `GEN-VICTORY-BUTTONS-REQUIRED`.

## Game shape: when these screens apply

| Shape | totalRounds | totalLives | Game Over? | Victory? | Stars Collected? | Notes |
|---|---|---|---|---|---|---|
| Multi-round, lives | > 1 | > 0 | yes | yes | yes | Full chain. Default. |
| Multi-round, no lives | > 1 | 0 | no | yes | yes | Skip Game Over → Motivation path; <3★ Victory still has Play Again. |
| Standalone, lives | 1 | > 0 | inline panel | inline panel | inline panel | TransitionScreen FORBIDDEN (`GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN`). End-flow is `#gameContent` panel + `floatingBtn.setMode('next')`. |
| Standalone, no lives | 1 | 0 | n/a | inline panel | inline panel | Same — no TransitionScreen. |

Standalone games skip ALL end-of-flow TransitionScreens. The remaining sections of this doc apply to multi-round games only.

## Default narration strings (TTS templates)

Every prescribed TS plays an SFX → TTS pair, both awaited inside `onMounted`. The SFX and sticker are the per-screen defaults listed in the per-screen tables below; the TTS narration `audio_content` uses these canonical templates unless the spec's optional `creatorScreenAudio` block overrides a screen.

| Screen | Default `ttsText` template | Notes |
|---|---|---|
| `welcome` | `"Let's play ${gameTitle}!"` | `${gameTitle}` interpolated from `spec.title` at build time. |
| `roundIntro` | `"Puzzle ${n} of ${N}"` (Board Puzzle / Logic Grid archetypes) / `"Round ${n} of ${N}"` (other archetypes) | `${n}` from `gameState.currentRound`; `${N}` from `gameState.totalRounds`. Archetype branch is data, not creator voice. |
| `victory` | `"Victory! You got ${score} out of ${totalRounds}!"` (3★) / `"Great work! You got ${score} out of ${totalRounds}!"` (<3★) | Conditional on `gameState.stars`. `${score}` from `gameState.score`; `${totalRounds}` from `gameState.totalRounds`. |
| `gameOver` | `"You completed ${score} of ${totalRounds}. Let's try again!"` | |
| `motivation` | `"Ready to improve your ${primaryMetric}?"` | `primaryMetric` defaults to `'score'`; spec may override (see § 2). |
| `starsCollected` | `null` | **Canon exception** — Stars Collected plays SFX only, no TTS. The build skips the TTS step when `ttsText === null`. |

**These templates are runtime data interpolations, not authored prose.** Round number, game title, score, totalRounds — all come from `gameState` or `spec`. Inventing a creator-flavored string is forbidden by `spec-creation/SKILL.md` line 224; using these templates is NOT invention. Creator-flavored copy enters via `spec.creatorScreenAudio.<screen>.audioText`, which game-planning merges in when generating the `## Screen Audio` table in `pre-generation/screens.md`.

**Game-planning is the single source of truth.** It walks the prescribed TS list for the game shape (table above), pulls templates from this section, applies any `creatorScreenAudio` overrides from the spec, and writes the resolved `## Screen Audio` table into `screens.md`. The build agent reads only that table — never this doc directly, never the spec's `creatorScreenAudio` block directly.

This section reconciles with `feedback/SKILL.md` § Composition with screen primitives (rows 198-204), which prescribes the same `await safePlaySound(...) → await playDynamicFeedback({audio_content, subtitle, sticker})` shape on TS `onMounted`. The two references now agree.

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
| `onMounted` | async — `await safePlaySound('sound_game_over', { sticker: STICKER_SAD })` → `try { await playDynamicFeedback({audio_content: ttsText, subtitle: ttsText, sticker: STICKER_SAD}); } catch(e){}` where `ttsText` comes from the resolved Screen Audio table in `screens.md` (default: `"You completed ${score} of ${totalRounds}. Let's try again!"`). |

Spec may override: subtitle (if the game has a specific game-over message), onMounted sound id, narration text via `creatorScreenAudio.gameOver`.

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
| `onMounted` | async — `progressBar.update(0, totalLives)` (restart-path reset) → `await safePlaySound('sound_motivation', { sticker: STICKER_MOTIVATE })` → `try { await playDynamicFeedback({audio_content: ttsText, subtitle: ttsText, sticker: STICKER_MOTIVATE}); } catch(e){}` where `ttsText` comes from the resolved Screen Audio table (default: `"Ready to improve your ${primaryMetric}?"`). |

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
| `onMounted` | async — `postGameComplete()` (data-contract: BEFORE audio) → `await safePlaySound('sound_game_victory', { sticker: STICKER_CELEBRATE })` → `try { await playDynamicFeedback({audio_content: ttsText, subtitle: ttsText, sticker: STICKER_CELEBRATE}); } catch(e){}` where `ttsText` comes from the resolved Screen Audio table (default: `"Victory! You got ${score} out of ${totalRounds}!"` for 3★, `"Great work! You got ${score} out of ${totalRounds}!"` otherwise). |

Spec may override: subtitle (always game-specific), onMounted sound id, narration text via `creatorScreenAudio.victory`.

**FloatingButton state:** `floatingBtn.setMode('hidden')` MUST be called before `transitionScreen.show(...)` for Victory. The in-card buttons (`Play Again` / `Claim Stars`) own routing — they are SEMANTIC ACTIONS, not navigation verbs, so they do NOT trigger `GEN-FLOATING-BUTTON-TS-CTA-FORBIDDEN`. Stripping the `buttons:` array to silence that rule is itself a violation (`GEN-VICTORY-BUTTONS-REQUIRED`). The `onDismiss` callback MUST NOT be used as a substitute for the `buttons:` array — Victory dismisses via explicit button taps only, never tap-anywhere.

**Canonical code shape:**
```js
async function showVictory() {
  try { floatingBtn.setMode('hidden'); } catch (e) {}
  const stars = gameState.stars;
  const buttons = stars === 3
    ? [{ text: 'Claim Stars', type: 'primary', action: showStarsCollected }]
    : [
        { text: 'Play Again', type: 'secondary', action: showMotivation },
        { text: 'Claim Stars', type: 'primary', action: showStarsCollected }
      ];
  // ttsText resolved by game-planning into screens.md Screen Audio table; build inlines it.
  const ttsText = stars === 3
    ? `Victory! You got ${gameState.score} out of ${gameState.totalRounds}!`
    : `Great work! You got ${gameState.score} out of ${gameState.totalRounds}!`;
  await transitionScreen.show({
    stars, title: 'Victory 🎉', subtitle: getVictorySubtitle(),
    buttons, persist: true,
    onMounted: () => (async () => {
      postGameComplete();                                                      // BEFORE audio (data-contract)
      try { await safePlaySound('sound_game_victory', { sticker: STICKER_CELEBRATE }); } catch (e) {}
      if (ttsText) {
        try { await FeedbackManager.playDynamicFeedback({
          audio_content: ttsText, subtitle: ttsText, sticker: STICKER_CELEBRATE
        }); } catch (e) {}
      }
    })()
  });
}
```

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
