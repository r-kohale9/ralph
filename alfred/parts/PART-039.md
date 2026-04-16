### PART-039: Preview Screen

**Category:** MANDATORY | **Dependencies:** PART-002, PART-017, PART-025
**Source of truth:** `warehouse/parts/PART-039-preview-screen.md`

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
- MANDATORY for every game (`ScreenLayout.inject({ slots: { previewScreen: true, ... } })`).
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

**State enum:** `getState()` returns `'idle'` (pre-`show`), `'preview'` (overlay visible), or `'game'` (overlay dismissed, wrapper still mounted).

**Methods:** `show`, `pause`, `resume`, `skip`, `setPreviewData`, `getState`, `destroy`.

See `warehouse/parts/PART-039-preview-screen.md` for full detail (audio layers, timer sync rAF, verification checklist).
