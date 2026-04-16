# ProgressBarComponent

Slim top-of-play-area progress bar with round label, lives (hearts), and a fill track. Supports three runtime shapes: standalone, multi-round flat, and sectioned.

## Three supported shapes

### 1. Standalone (`totalRounds: 1`)

Used when a game has a single round and progress has no meaning. Create, then immediately hide:

```js
const pb = new ProgressBarComponent({ totalRounds: 1, totalLives: 3 });
pb.hide(); // display:none — takes no layout space
```

Lives may still be shown via `pb.setLivesVisible(true)` + `pb.show()` if desired.

### 2. Multi-round flat

```js
const pb = new ProgressBarComponent({
  totalRounds: 5,
  totalLives: 3
});
pb.update(2, 3); // completed 2/5, 3 lives
// Label: "Round 2/5"
// Fill:  40%
```

### 3. Sectioned (e.g. Practice + Challenge)

```js
const pb = new ProgressBarComponent({
  sections: [
    { label: 'Practice',  rounds: 3 },
    { label: 'Challenge', rounds: 3 }
  ],
  totalLives: 3
});
// totalRounds is auto-computed (3 + 3 = 6)

pb.update(4, 2);
// Auto-resolves to Challenge section (round 1 of 3 within Challenge)
// Default label: "Challenge · 1/3"
// Fill:  33.3% (scoped to current section)

// Or override the section explicitly:
pb.update(4, 2, { sectionIndex: 1 });
```

When `sections` is provided and no explicit `labelFormat` is passed, the default template is `'{sectionLabel} · {inSection}/{sectionTotal}'`.

## Label tokens

`labelFormat` may use any combination of:

| Token | Meaning |
|-------|---------|
| `{current}` | Absolute current round |
| `{total}` | Total rounds (or sum of section rounds) |
| `{sectionLabel}` | Current section label (empty if no sections) |
| `{sectionIndex}` | 1-based section number |
| `{inSection}` | Round-in-section (1-based, clamped) |
| `{sectionTotal}` | Rounds in the current section |

## Runtime methods

- `update(currentRound, currentLives, opts?)` — `opts.sectionIndex` overrides computed section. Fill track is scoped to the active section when sections are configured.
- `setLabel(template)` — swap the label template at runtime; re-renders with current state.
- `setLivesVisible(bool)` — toggle lives without destroying the element. Idempotent.
- `show()` / `hide()` — toggle root `display` between `''` and `'none'`. Hidden bar takes **no layout space**.
- `destroy()` — remove DOM + null references.

## Back-compat

Old `update(currentRound, currentLives)` callers (no `opts`) continue to work. Old element aliases (`textEl`, `livesEl`, `barEl`) remain exposed via `Object.defineProperty` getters.

## Constructor config (reference)

```js
{
  autoInject: true,
  slotId: 'mathai-progress-slot',
  totalRounds: 5,          // required unless `sections` provided
  totalLives: 3,
  labelFormat: null,       // auto-picks based on sections
  sections: null,          // optional [{label, rounds}]
  filledHeart: '❤️',
  emptyHeart: '🤍',
  showLives: true,
  showTrack: true,
  showLabel: true,
  styles: { root, header, label, lives, track, fill }
}
```
