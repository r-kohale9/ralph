# Behavioral Transcript — Design Doc

**Status:** Implementing
**Motivation:** Tests generated from spec descriptions diverge from actual game behavior, requiring 2-3 fix iterations. Tests generated from *observed* behavior pass on iteration 1.

---

## Problem

The current Step 2.5 DOM snapshot captures **static structure** (element IDs at a point in time).
The test generator then *assumes* how the game behaves based on spec language.

These assumptions fail because:
- Timing: spec says "animation plays" → LLM guesses 500ms → actual is 800ms
- Selectors: spec says "answer buttons" → LLM guesses `.answer-btn` → actual is `.option-btn`
- Interaction model: spec says "select cells" → LLM uses `answer()` → game needs click-cells + submit
- State shape: spec says "score increases" → LLM checks `gameState.score` → actual is `gameState.points`
- Payload: spec describes postMessage → LLM constructs shape → actual differs in nesting

**Evidence:** Only build 208 (doubles — trivial game) passed all categories on iteration 1.
Every CDN game with any complexity required 2-5 fix iterations.

---

## Solution: Step 2.5b — Behavioral Transcript

After the existing DOM snapshot (element capture), the same headless browser session:
1. Fires `game_init` to start the game
2. Reads actual round data from `window.gameState`
3. Performs a **sample correct interaction** using known-correct answer data
4. Records state snapshots + timestamps before/after each action
5. Captures any `postMessage` the game sends
6. Performs a **sample wrong interaction** to observe feedback behavior
7. Returns a structured transcript injected into every test-gen prompt

The test generator sees *ground truth* — no assumptions needed.

---

## Transcript Format (injected into test-gen prompt)

```
OBSERVED GAME BEHAVIOR — ground truth from running the game (write tests that match exactly):

GAME STATE at round start:
  phase: "playing"
  lives: 3
  score: 0
  round: { targetSum: 10, gridNumbers: [2,5,3,7,1,4,8,6,9,2], validSolution: [0,2], gridSize: 3 }

CORRECT INTERACTION observed:
  [T=0ms]    Clicked .grid-cell:nth(0)  → runningSum=2, cell gained class 'selected'
  [T=80ms]   Clicked .grid-cell:nth(2)  → runningSum=5
  [T=160ms]  Clicked #btn-submit        → submit triggered
  [T=900ms]  Animation complete         → score=1, lives=3, new round loaded

WRONG INTERACTION observed:
  [T=0ms]    Clicked .grid-cell:nth(1)  → runningSum=5
  [T=80ms]   Clicked #btn-submit        → wrong answer
  [T=400ms]  Feedback shown             → lives=2, same round active

POSTMESSAGE captured (endGame):
  { type: 'gameOver', score: 3, stars: 2, lives: 1, metrics: { ... }, ...signalPayload }
  ↳ Sent at T=12400ms after skipToEnd()

TIMING NOTES:
  - Correct submit animation: ~900ms before next round
  - Wrong answer feedback: ~400ms before re-enabling
  - Use waitForTimeout(1000) after submit before asserting new state
```

---

## Implementation

### Where: `captureGameDomSnapshot()` in `lib/pipeline.js`

After the existing game-screen DOM capture (line ~554), before `browser.close()`:

```
[existing] startDom = extractDom()
[existing] click transition → gameDom = extractDom()
[existing] gameContent = window.gameState?.content
[NEW]      fire game_init → observe interactions → capture transcript
[existing] browser.close()
```

### Interaction Strategy by `specMeta.interaction` type

| Interaction | Correct action | Wrong action |
|-------------|---------------|--------------|
| `grid-click` | Click cells at `validSolution` indices, then `#btn-submit` | Click wrong index, then submit |
| `button-tap` | Click option matching `correctAnswer` value | Click first non-correct option |
| `tap` | Click button matching `correctAnswer` | Click first non-matching |
| `text-input` | Type correct answer into input, press Enter | Type wrong answer |
| `drag-drop` | Skip — too complex for automated interaction |
| `swipe` | Skip — not automatable headlessly |

Round data source (in priority order):
1. `window.gameState.round` — current round object
2. `window.gameState.content?.[0]` — first round from content array
3. `window.gameState` top-level fields (for simple games)

### postMessage capture

Intercept via `page.on('console')` — games call `window.parent.postMessage()` which is logged.
Alternative: override `window.parent.postMessage` in `addInitScript` to push to a capture array,
then read `window.__postMessageLog` via evaluate.

### skipToEnd for postMessage capture

After correct/wrong interaction observations, call `window.endGame()` or `skipToEnd` to
trigger the final postMessage and capture its payload.

### Failure handling

All behavioral transcript steps are wrapped in try/catch. If any step fails:
- Log the error
- Return whatever partial transcript was built
- Never block the pipeline — transcript is enhancement only

---

## Edge Cases

| Case | Handling |
|------|----------|
| Game has no `game_init` (non-CDN) | Skip interaction; use DOM snapshot only |
| `validSolution` is undefined | Try first cell / first button as "correct guess" |
| No submit button (auto-submit on click) | Detect by watching state change after cell click |
| Phase doesn't change to 'playing' in 5s | Timeout → skip behavioral transcript |
| All interactions timeout | Log warning, proceed with empty transcript |
| CDN packages still loading | Add 5s wait after game_init before interacting |

---

## Expected Impact

| Metric | Current | With Behavioral Transcript |
|--------|---------|---------------------------|
| Iter-1 pass rate (non-contract) | ~60% | ~85% |
| Iter-1 pass rate (contract) | ~30% | ~70% |
| Avg fix iterations to APPROVED | 3-5 | 1-2 |
| Build time | ~30 min | ~32 min (+2min for transcript) |

The 2-minute overhead is small compared to the time saved by eliminating fix iterations
(each iteration = ~5-8 minutes of triage + fix LLM + Playwright re-run).

---

## Files Changed

- `lib/pipeline.js` — extend `captureGameDomSnapshot()` with `captureGameBehavioralTranscript()`
- `lib/pipeline.js` — inject transcript into test-gen prompt (Step 2b)
- `docs/behavioral-transcript.md` — this doc

---

## Non-Goals

- Full test recording (not replaying entire test suite)
- Deterministic answer finding (we use best-effort from round data)
- Supporting all interaction types (drag-drop, swipe excluded for now)
