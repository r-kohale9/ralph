### PART-039: Preview Screen

**Category:** CONDITIONAL (default ON) | **Dependencies:** PART-002, PART-017, PART-025
**Source of truth:** `warehouse/parts/PART-039-preview-screen.md`

**Scope:** This part applies only when `spec.previewScreen !== false` (i.e. the flag is absent or `true`). When the spec sets `previewScreen: false`, skip this part entirely — do NOT instantiate `PreviewScreenComponent`, do NOT pass `slots.previewScreen` to `ScreenLayout.inject()`, and let `DOMContentLoaded` call the first TransitionScreen directly.

**Purpose:** Persistent wrapper for the entire game session. Starts in `preview` state (instruction + audio/5s timer + skip button), transitions to `game` state (header stays, overlay removed, game interactable). NOT a transient screen — stays mounted until `endGame()` calls `destroy()`.

**Constructor:**
```js
const previewScreen = new PreviewScreenComponent({ slotId: 'mathai-preview-slot' });
```

**show() options:**

| Option | Type | Notes |
|---|---|---|
| `instruction` | string | HTML allowed (bold, images, video) |
| `audioUrl` | string\|null | Preview audio; null → runtime TTS fallback |
| `showGameOnPreview` | boolean | Default false. If true, render game behind transparent blocking overlay |
| `timerConfig` | object\|null | `{ type: 'decrease'\|'increase', startTime, endTime }` |
| `timerInstance` | TimerComponent\|null | Reference to game timer for header sync |
| `onComplete` | function | Called with `previewData` when preview ends (skip or timer) |
| `onPreviewInteraction` | function | Called when `setPreviewData()` fires |

**Invariants:**
- Default ON — every game includes the preview (`ScreenLayout.inject({ slots: { previewScreen: true, ... } })`) UNLESS the spec explicitly sets `previewScreen: false`.
- **Wrapper persistence (CRITICAL):** the preview wrapper DOM (`mathai-preview-slot`, `.game-stack`, `#gameContent`) stays mounted and visible from page load until the single session-final `endGame()` cleanup. Victory / Game Over / Play Again / Try Again / any phase transition render **inside** the wrapper — the header (avatar, question label, score, star) is visible during all of them. Do NOT `style.display='none'`, add `.hidden`, set `hidden` attribute, or remove `mathai-preview-slot` during any phase transition.
- **No DOM re-parenting at runtime (CRITICAL):** after `ScreenLayout.inject()`, `#gameContent` stays inside `.game-stack` inside the preview wrapper for the entire session. No `appendChild` / `insertBefore` / `replaceWith` / `remove` targeting `#gameContent` outside init. You may mutate children INSIDE `#gameContent` freely; you may NOT move `#gameContent` itself.
- **`destroy()` called exactly once (CRITICAL):** in a single `endGame()` function whose sole purpose is post-`game_complete` teardown. MUST NOT be called from `showVictory`, `showGameOver`, `restartGame`, `resetGame`, answer handler, or any phase transition. Calling `destroy()` mid-session breaks the persistent wrapper contract and produces the very bug this rule prevents.
- Do NOT pass `questionLabel`, `score`, `showStar` — read from `game_init` payload automatically.
- `hide()` does NOT exist.
- Game DOM MUST be rendered into `#gameContent` BEFORE `previewScreen.show()` is called.
- `gameState.startTime` is set in `startGameAfterPreview()`, NOT before.
- DOMContentLoaded calls `setupGame()` directly — do NOT show a TransitionScreen ("Let's go!") before preview.
- `restartGame()` MUST NOT call `previewScreen.show()` or `setupGame()` — split reset from preview. Calling `show()` twice auto-skips.
- Game does NOT render its own header; preview header is the only one.
- `duration_data.preview[]` is populated with `{ duration }` in `startGameAfterPreview()`.
- `game_complete` payload includes `previewResult: gameState.previewResult || null`.
- Preview audio flows through `FeedbackManager.sound.preload`/`.play` — no `new Audio()`.
- **Standalone-fallback gate (CRITICAL).** Any `setTimeout` standalone fallback inside `DOMContentLoaded` that calls `startGame()`, `showRoundIntro()`, or `injectGameHTML()` MUST, as its first statement, check `if (previewScreen && previewScreen.isActive && previewScreen.isActive()) return;`. The fallback exists only to recover from `waitForPackages()` timeout / CDN failure. Preview does NOT mutate `gameState.phase`, so the phase === 'start_screen' gate alone is insufficient — it stays true for the entire preview duration and lets the fallback fire Round 1 audio on top of preview audio, causing the welcome transition to be silently skipped.

**State enum:** `getState()` returns `'idle'` (pre-`show`), `'preview'` (overlay visible), or `'game'` (overlay dismissed, wrapper still mounted).

**Methods:** `show`, `pause`, `resume`, `skip`, `setPreviewData`, `getState`, `destroy`.

See `warehouse/parts/PART-039-preview-screen.md` for full detail (audio layers, timer sync rAF, verification checklist).
