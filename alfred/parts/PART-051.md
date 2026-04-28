### PART-051: Answer Component (Correct Answers carousel)

**Category:** CONDITIONAL | **Condition:** Every game with at least one evaluated answer to display UNLESS the spec sets `answerComponent: false` | **Dependencies:** PART-002, PART-008 (postMessage), PART-017 (FeedbackManager), PART-050 (FloatingButton — `next` click drives the post-celebration exit)

**Purpose:** post-celebration `Correct Answers!` carousel that reveals the *evaluated* portion of each round AFTER the player has finished playing AND seen the celebration beats (Victory transition if any, then the Stars Collected yay + star animation). The component never appears during preview state, never appears mid-round, and is the last in-game card the player interacts with — its Next click signals iframe teardown via `next_ended`.

---

## Opt-out (`answerComponent: false`) — CREATOR-ONLY

When the spec declares a top-level `answerComponent: false`, this part **does not apply**:

- `AnswerComponentComponent` MUST NOT be instantiated, imported, or referenced.
- `ScreenLayout.inject()` MUST NOT pass `answerComponent: true` in its `slots` — omit the key entirely.
- The game ends at final feedback → celebration TransitionScreen(s) with no answer review surface.
- All validator rules listed below (`GEN-ANSWER-COMPONENT-*`) are auto-skipped.

**`answerComponent: false` is a CREATOR-ONLY decision.** Unlike most opt-outs in the pipeline, this flag MUST NOT be auto-filled by an LLM at any step. It only appears in `spec.md` when the human creator EXPLICITLY requests opt-out — quoted creator language must be present in the spec body or in the Warnings section.

Two valid reasons the creator may request opt-out:
1. **The game has no meaningful per-round answer to review** — pure exploration / sandbox / canvas-only flows where "correct answer" isn't a concept the player can re-read.
2. **The creator deliberately wants the inline feedback panel to be the only answer surface** — and they say so explicitly.

**Step 1 rule (spec-creation):** the spec-author LLM MUST NOT auto-default `answerComponent` to `false`. The default is silent `true`. Auto-filling `false` because the game is a one-question standalone, because an inline feedback panel exists, or because the creator was silent on answer review is a violation. See [`spec-creation/SKILL.md`](../skills/spec-creation/SKILL.md) § "answerComponent exception" for the full rule and banned reasoning.

**Step 2 rule (spec-review):** the reviewer LLM MUST FAIL any spec containing `answerComponent: false` without quoted creator opt-out language. See [`spec-review/SKILL.md`](../skills/spec-review/SKILL.md) check H5.

**Step 4 rule (build):** the build-time LLM MUST NOT write `answerComponent: false` into `spec.md` to silence validator rules. Same trust model as PART-039 / PART-050 — spec mutations during build are a visible scope violation in `git diff`.

---

## Overview

Visual design (locked to mathai-client `generic-answer-renderer` reference):

```
┌────────────────────────────────────────────────────┐
│ ✅  Correct Answers!              ⟨   1/3   ⟩      │   ← yellow header strip (#FCF6D7CC)
├────────────────────────────────────────────────────┤
│                                                    │
│           [ game-rendered answer view ]            │   ← mint body (#DAFEDC)
│                                                    │
└────────────────────────────────────────────────────┘
```

- Header: light-yellow strip; left = green-tick badge + `Correct Answers!` label; right = prev arrow / `i/N` counter / next arrow.
- Body: pale-mint background; the game mounts its evaluated DOM into the slide container.
- Card max-width: 400 px. Sits at the bottom of `.game-stack` after `#gameContent` and `#mathai-transition-slot`.
- Component starts hidden (`display: none`). Only revealed by `show()`.

Key properties:

- **Visibility is game-state-driven, not interaction-driven.** The component is hidden during preview state, hidden during gameplay, hidden during celebration TransitionScreens, and only revealed AFTER the Stars Collected celebration beat hands off (via its `onMounted` setTimeout that calls the answer-reveal function — `transitionScreen.hide()` is NOT part of the hand-off; the celebration card stays mounted as the backdrop and tears down together with everything else on the single-stage Next click).
- **Comes AFTER the celebration, not before.** The Stars Collected (yay / star-collected) TransitionScreen plays the `victory_sound_effect` + `show_star` animation FIRST. Only after that animation lands does the TS auto-hide and AnswerComponent appear. Placing the answer card in front of the celebration steals the celebration moment AND forces a multi-stage Next handler — both regressions.
- **Carousel of one slide per evaluated answer.** Multi-round games: N rounds → N slides. Standalone games with one answer: 1 slide → prev/next disabled (opacity 0.3, no pointer events). Standalone games with N answers: N slides.
- **Renders only the evaluated elements.** For drag-drop questions the slide should show the drop-zones in their solved state, not the draggable bank. Game owns the rendering; component is content-agnostic.
- **Slide payload is render-callback only.** Each slide is `{ render(container) { ... } }`. `html` / `element` keys are not supported — validator rule `GEN-ANSWER-COMPONENT-SLIDE-SHAPE` rejects them. Restricting to one shape keeps behaviour predictable across games.

---

## ScreenLayout configuration

```javascript
ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,
    transitionScreen: true,
    floatingButton: true,
    answerComponent: true   // reserves #mathai-answer-slot at the end of .game-stack
  }
});
```

The slot is the last child of `.game-stack`, after `#gameContent` and `#mathai-transition-slot`. Visual order matches the spec rule "instructions → play area → answer component".

## Instantiation (in DOMContentLoaded, after ScreenLayout.inject)

```javascript
const answerComponent = new AnswerComponentComponent({
  slotId: 'mathai-answer-slot'
  // headerLabel: 'Correct Answers!'  // default — override only if spec demands it
});
```

## Public API

| Method | Purpose |
|--------|---------|
| `show({ slides, headerLabel? })` | Reveal component, render N slides. Each slide MUST be `{ render(container) }`. Counter shows `i/N`; nav auto-disables when `slides.length === 1`. |
| `hide()` | `display: none` on the root. State preserved. |
| `update({ slides, headerLabel? })` | Replace slides without toggling visibility. |
| `setSlideIndex(i)` | Jump to slide `i` (clamped). |
| `isVisible()` | Returns `true` while root is rendered. |
| `destroy()` | Removes DOM, clears slides. Call from `floatingBtn.on('next', ...)` and from `restartGame()`. |

### Slide payload

```javascript
{
  render(container) {
    // mount evaluated answer DOM into `container`
    // component clears the container before each invocation
  }
}
```

The component clears the slide container before every render (on `show`, on every nav, on `update` if index didn't change). Games can therefore reuse a single render function that constructs DOM from `gameState` / round data without worrying about leaks.

---

## Lifecycle

1. **Page load.** `new AnswerComponentComponent(...)` runs in DOMContentLoaded. Component starts hidden.
2. **Preview state.** Component stays hidden — `show()` MUST NOT be called while `previewScreen.isActive()` is true.
3. **Gameplay (rounds).** Component stays hidden. Per-round answer reveal is done inline in `#gameContent` (existing PART-017 / inline-feedback patterns), NOT in this component.
4. **End-of-game (multi-round).** Final round feedback ends → `endGame()` posts `game_complete` and routes to the appropriate celebration screen (Victory if there's an intermediate transition with Claim Stars, otherwise straight to Stars Collected). Stars Collected's `onMounted` plays the yay sound + `show_star` animation, then via a `setTimeout` calls the answer-reveal function (typically `showAnswerCarousel()`). The Stars Collected TS stays mounted (`persist: true`) and acts as the celebration backdrop. The answer-reveal function calls `answerComponent.show({ slides })` and `floatingBtn.setMode('next')`. Player taps Next → single-stage exit tears down everything (AnswerComponent + Stars Collected TS + preview + floating button) and posts `next_ended`. **AnswerComponent never appears inside `endGame()` or before celebration screens.**
5. **End-of-game (standalone).** Final answer feedback ends → inline feedback panel rendered into `#gameContent` → `answerComponent.show({ slides })` → `floatingBtn.setMode('next')` → Next click destroys component and posts `next_ended`. (Standalone games do not use TransitionScreen per `GEN-FLOATING-BUTTON-STANDALONE-TS-FORBIDDEN`.)
6. **Restart.** `restartGame()` calls `answerComponent.destroy()` (or `hide()`+ `update({ slides: [] })` if the same instance is being reused).

### End-game sequence (multi-round, with Victory + Stars Collected)

```
final-round feedback
        │
        ▼
endGame() ─→ postGameComplete()
             showVictory()                            (optional intermediate)
                  │
                  │ user taps "Claim Stars"
                  ▼
             showStarsCollected()                     (celebration TS — stays visible)
                  │  buttons: [], persist: true
                  │  onMounted:
                  │    await sound.play('victory_sound_effect')
                  │    window.postMessage({type:'show_star', ...})   ← star animation
                  │    setTimeout(() => {
                  │      showAnswerCarousel()                        ← hand-off (TS stays mounted)
                  │    }, ~1500)
                  ▼
        ┌─────────────────────────────────────────┐
        │ showAnswerCarousel():                   │
        │   answerComponent.show({ slides })      │
        │   floatingBtn.setMode('next')           │   ← Next appears HERE, once
        └────────────────┬────────────────────────┘
                         │ user taps Next
                         ▼
        floatingBtn.on('next', () => {              ← single-stage exit
          answerComponent.destroy()
          window.parent.postMessage({ type: 'next_ended' }, '*')
          previewScreen.destroy()                    (if applicable)
          floatingBtn.destroy()
        })
```

### End-game sequence (multi-round without intermediate Victory)

`endGame()` calls `showStarsCollected()` directly. Stars Collected hands off to AnswerComponent via the same `onMounted` setTimeout pattern. Same single-stage Next handler.

### End-game sequence (standalone)

```
final feedback
        │
        ▼
renderInlineFeedbackPanel(correct)
postGameComplete()
answerComponent.show({ slides: buildAnswerSlides() })
floatingBtn.setMode('next')
        │
        ▼ user taps Next
answerComponent.destroy()
window.parent.postMessage({ type: 'next_ended' }, '*')
floatingBtn.destroy()
```

---

## Content / data contract

The answer payload itself is **game-specific** — same model as the question payload. The harness does not validate the inner shape; the component is dumb about types.

- Each round in `content.rounds[i]` MAY include an `answer` field (any shape — object, array, scalar) that the game uses to render the slide.
- For a standalone game with multiple evaluated answers, use `totalRounds: 1` and put an `answers: [...]` array on the single round; the game maps each entry to a slide.
- The spec.md MUST document the per-round answer shape under "Content schema" (same place where the question shape is documented). See [spec-creation.md](../skills/spec-creation.md) for the required spec section.
- The deployment step adds the `answer` / `answers` field to `inputSchema.json` for content-set validation.

Example access pattern in game code:

```javascript
function buildAnswerSlidesForAllRounds() {
  return rounds.map(function (round) {
    return {
      render: function (container) {
        // render the evaluated answer view for `round` into `container`
        // — drop-zones in solved state, grid with correct queens, table
        // with correct rows highlighted, etc.
      }
    };
  });
}
```

---

## Invariants

- Component starts hidden and is ONLY revealed via `show()`. No CSS / DOM trick that auto-reveals.
- `show()` MUST be called AFTER `await FeedbackManager.play(...)` completes for the final round / final answer. Calling earlier is a regression — players see the answer before the feedback animation lands.
- `show()` MUST NOT be called while `previewScreen.isActive()` is true.
- **Multi-round games: `answerComponent.show(...)` MUST NOT appear inside `endGame()` (and MUST NOT appear before any Stars Collected / yay TransitionScreen).** It must be reached only through a hand-off from the Stars Collected screen's `onMounted` setTimeout — i.e. after the celebration sound + `show_star` animation lands, the screen calls the answer-reveal function (typically `showAnswerCarousel()`). The Stars Collected TS itself stays mounted (`persist: true`) and acts as the celebration backdrop while the answer card appears below it. Validator rule `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` enforces this. Placing it in `endGame()` (or in the Victory `Claim Stars` action) skips the celebration beat AND forces a multi-stage Next handler.
- **Single-stage Next handler ONLY.** `floatingBtn.on('next', ...)` MUST tear down everything (AnswerComponent + Stars Collected TS + preview + floating button) and post `next_ended` in one click. A two-stage handler that uses the first Next click to mount the next celebration screen is the regression this rule was written to prevent — by the time Next is visible, the player has already seen all celebration screens. Validator rule `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE` enforces this.
- Slides use `render` callbacks only — no `html` strings, no pre-built DOM nodes. Restricting the API to one shape avoids drift between games and keeps validator + tests narrow.
- Component container lives in `#mathai-answer-slot` inside `.game-stack`. NOT inside `#gameContent`, NOT inside the floating-button slot.
- Single-slide path: when `slides.length === 1`, prev/next buttons are disabled (`aria-disabled="true"`, opacity 0.3, no pointer events) and counter shows `1/1`.

## Integration with FeedbackManager (PART-017) and TransitionScreen (PART-025)

The component is shown AFTER feedback AND after the celebration TransitionScreen(s) have played. For multi-round games, the standard pattern is:

```javascript
async function endGame(/* multi-round, called after the last round resolves */) {
  await FeedbackManager.play(/* final round */);
  postGameComplete();
  if (gameState.stars > 0) {
    showVictory();              // optional Victory transition with Claim Stars button
  } else {
    showGameOver();              // game-over branch (no AnswerComponent)
  }
}

// Victory's "Claim Stars" action calls showStarsCollected() directly.
// Stars Collected is the celebration beat that hands off to the answer reveal:
async function showStarsCollected() {
  await transitionScreen.show({
    title: 'Yay! Stars collected!',
    stars: gameState.stars,
    buttons: [],
    persist: true,
    onMounted: function () {
      (async function () {
        await FeedbackManager.sound.play('victory_sound_effect', { sticker: STICKER_CELEBRATE });
        window.postMessage({
          type: 'show_star',
          data: { count: gameState.stars, variant: 'yellow', score: gameState.score + '/' + gameState.totalRounds }
        }, '*');
        // After the star animation lands, reveal the answer carousel. The
        // Stars Collected TS stays mounted (persist: true) — the celebration
        // is the backdrop for the answer review, not a separate "page".
        // Both surfaces tear down together on the single-stage Next click.
        setTimeout(function () {
          showAnswerCarousel();
        }, 1500);
      })();
    }
  });
}

function showAnswerCarousel() {
  answerComponent.show({
    slides: rounds.map(function (r) {
      return { render: function (c) { renderAnswerForRound(r, c); } };
    })
  });
  floatingBtn.setMode('next');
}

floatingBtn.on('next', function () {
  // Single-stage exit. Player has already seen Victory + Stars Collected + AnswerComponent.
  answerComponent.destroy();
  window.parent.postMessage({ type: 'next_ended' }, '*');
  if (previewScreen) previewScreen.destroy();
  floatingBtn.destroy();
});
```

For standalone games (no TransitionScreen at all), `endGame()` is the SINGLE 5-beat orchestrator (PART-050 standalone variant). AnswerComponent reveal slots in alongside `show_star`:

```javascript
async function endGame(correct /* standalone */) {
  // Beat 1 — SFX + sticker (awaited, min 1500 ms).
  await FeedbackManager.sound.play(correct ? 'correct_sound_effect' : 'incorrect_sound_effect', { sticker });

  // Beat 2 — render inline feedback panel + post game_complete (SYNC).
  renderInlineFeedbackPanel(correct);
  postGameComplete();

  // Beat 3 — dynamic TTS AWAITED (standalone exception per feedback/SKILL.md).
  try {
    await FeedbackManager.playDynamicFeedback({ audio_content: ttsText, subtitle, sticker });
  } catch (e) { /* TTS failures must not block the end sequence */ }

  // Beat 4 — show_star + AnswerComponent reveal.
  if (correct) {
    window.postMessage({
      type: 'show_star',
      data: { count: gameState.stars || 1, variant: 'yellow', score: gameState.score + '/1' }
    }, '*');
  }
  answerComponent.show({ slides: buildAnswerSlides() });

  // Beat 5 — reveal Next AFTER the 1 s star animation.
  setTimeout(function () { floatingBtn.setMode('next'); }, 1100);
}

floatingBtn.on('next', function () {
  window.parent.postMessage({ type: 'next_ended' }, '*');
  answerComponent.destroy();
  if (previewScreen) previewScreen.destroy();   // destroy here, NOT in endGame()
  floatingBtn.destroy();
});
```

---

## Validator rules enforced

Skipped entirely when spec has `answerComponent: false`.

| Rule | What it checks |
|------|----------------|
| `GEN-ANSWER-COMPONENT-CDN` | Script tag for `answer-component/index.js` OR the `components/index.js` bundle is present when `AnswerComponentComponent` is referenced. |
| `GEN-ANSWER-COMPONENT-SLOT` | `slots.answerComponent: true` in `ScreenLayout.inject()` when the component is instantiated. |
| `GEN-ANSWER-COMPONENT-INSTANTIATE` | `new AnswerComponentComponent({...})` exists at DOMContentLoaded. |
| `GEN-ANSWER-COMPONENT-SHOW-AFTER-FEEDBACK` | `.show(` for the answer ref appears inside the end-game path AFTER `await FeedbackManager.play(`. |
| `GEN-ANSWER-COMPONENT-AFTER-CELEBRATION` | Multi-round games (`totalRounds > 1`) that use TransitionScreen MUST NOT call `answerComponent.show(...)` inside `endGame()`, inside a Victory transition's `Claim Stars` button action, or anywhere before the Stars Collected celebration. The reveal must be reached only through the Stars Collected `onMounted` setTimeout that calls the answer-reveal function. (The celebration TS stays mounted — no `transitionScreen.hide()` in the hand-off; everything tears down together on Next.) Catches the regression where AnswerComponent appears before/instead of celebration screens. |
| `GEN-ANSWER-COMPONENT-NEXT-SINGLE-STAGE` | The `floatingBtn.on('next', ...)` handler MUST be a single-stage exit — destroy AnswerComponent + post `next_ended` + destroy floating button (and preview if applicable) in one click. A two-stage handler that branches on a flag (`if (!gameState.starsCollectedShown) { showStarsCollected(); ... } else { ... }`) is forbidden. By the time Next is visible, the player has already seen all celebration screens. |
| `GEN-ANSWER-COMPONENT-NOT-IN-PREVIEW` | `.show(` is not called inside any branch gated by `previewScreen.isActive()` / `state === 'preview'`. |
| `GEN-ANSWER-COMPONENT-DESTROY` | `.destroy()` is called from the `floatingBtn.on('next', ...)` handler and from `restartGame()`. |
| `GEN-ANSWER-COMPONENT-SLIDE-SHAPE` | All `slides[]` entries use `render` callback only — no `html` / `element` keys. |

---

## Verification checklist

- [ ] `new AnswerComponentComponent({ slotId: 'mathai-answer-slot' })` runs at DOMContentLoaded.
- [ ] Component is hidden during preview state.
- [ ] Component is hidden during gameplay (every round except after the celebration).
- [ ] `show({ slides })` is called AFTER `await FeedbackManager.play(...)` for the final round.
- [ ] **Multi-round:** `answerComponent.show(...)` is NOT called inside `endGame()`. It is reached only through the Stars Collected `onMounted` setTimeout calling the answer-reveal function. The Stars Collected TS stays mounted (no `transitionScreen.hide()` in the hand-off).
- [ ] `floatingBtn.setMode('next')` is called immediately after `answerComponent.show(...)` inside the answer-reveal function.
- [ ] **Single-stage Next handler:** `floatingBtn.on('next', ...)` destroys AnswerComponent, posts `next_ended`, and destroys the floating button (and preview if applicable) in one click. No `if (!firstClick)` branching.
- [ ] For a multi-round game, slide count equals round count and counter shows `1/N` … `N/N`.
- [ ] For a `totalRounds: 1` standalone game with one answer, prev/next are disabled and counter shows `1/1`.
- [ ] Slide payloads use `render(container)` only — no `html` / `element` keys.
- [ ] `node lib/validate-static.js <game-html>` exits 0.
