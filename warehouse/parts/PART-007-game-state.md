# PART-007: Game State Object

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** None

---

## Code

```javascript
window.gameState = {
  currentRound: 0,
  totalRounds: {{NUMBER}},
  score: 0,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  content: null,
  duration_data: {
    startTime: null,
    preview: [],
    attempts: [],
    evaluations: [],
    inActiveTime: [],
    totalInactiveTime: 0,
    currentTime: null
  }
};

let timer = null;
let visibilityTracker = null;
let signalCollector = null;
```

## Placement

Top of `<script>` block, after PART-003 (waitForPackages), before PART-004 (initialization).

## Rules

- **CRITICAL: Must use `window.gameState = {...}` — NOT `const gameState = {...}`**. Playwright tests and debug functions access `window.gameState` directly. Use `const gameState = window.gameState` as a convenience alias if desired.
- `duration_data` structure is non-negotiable — platform expects this exact shape
- `timer`, `visibilityTracker`, and `signalCollector` declared as `let` at module scope (accessible to both DOMContentLoaded and global functions)
- `content` is populated by postMessage or hardcoded fallback for testing
- Game-specific state fields are added alongside mandatory fields (not replacing them)

## Customization

Add game-specific fields alongside mandatory ones:

```javascript
window.gameState = {
  // ...all mandatory fields above...

  // Game-specific additions:
  streak: 0,
  hintsUsed: 0,
  selectedCells: [],
  currentLevel: 1,
  comboMultiplier: 1
};
```

## Contract

Must conform to `contracts/game-state.schema.json`.

## Verification

- [ ] `gameState` object exists
- [ ] Has all mandatory fields: currentRound, totalRounds, score, attempts, events, startTime, isActive, content, duration_data
- [ ] `duration_data` has: startTime, preview, attempts, evaluations, inActiveTime, totalInactiveTime, currentTime
- [ ] `timer` declared as `let` at module scope
- [ ] `visibilityTracker` declared as `let` at module scope
- [ ] `signalCollector` declared as `let` at module scope
- [ ] Game-specific fields added (not replacing mandatory fields)
