# Game Flow — Three Base Shapes

The skill infers exactly one shape from the spec's ASCII user-flow diagram. Standalone collapses the flow to its minimum; multi-round runs the full machinery; sectioned adds section-intro transitions between grouped loops. A single runtime handles all three.

| Shape | Diagram / config hint | Runtime behavior |
|---|---|---|
| **Standalone** | `totalRounds: 1` (no `sections`) | Preview → Game → Feedback → Game End. **No transition screens** — no Welcome, no Round-N intro, no Victory, no Game Over, no "Ready to improve", no "Stars collected". **No retry, no Play Again.** Stars awarded automatically at feedback end (no Claim Stars tap). Lives are tracked; UI display TBD (no progress bar in this shape). |
| **Multi-round** | `totalRounds: N ≥ 2` (no `sections`) | Full standard flow; Round-N intro before each round; progress bar `i/N`; full Victory/Game-Over branches. Play Again skips Preview + Welcome. |
| **Sectioned** | `sections: [...]` present | Section-intro transition at each boundary; rounds grouped; progress bar shows section + round; full Victory/Game-Over branches. |

## Shape 1 — Standalone (`totalRounds: 1`)

```
┌──────────┐ tap    ┌────────────┐ submit  ┌──────────────────┐
│ Preview  ├───────▶│ Game (Q1)  ├────────▶│ Feedback 2s      ├──▶ Game End
│ 🔊 prev  │        │ 🔊 prompt  │         │ ✓ / ✗            │    {stars, correct,
└──────────┘        │ no progress│         │ stars auto-given │     livesLeft}
                    │ bar        │         │ lives decr if ✗  │    → host resumes
                    └────────────┘         └──────────────────┘
```

No Welcome, no Round-N intro, no Victory/Game-Over screens, no "Ready to improve your score?", no "Yay stars collected!". Wrong answers do **not** retry — feedback plays, stars and lives are finalized, Game End fires. Correct and wrong both terminate via the same Game End event; the host gets `{ correct, stars, livesLeft }` in the payload.

**Lives UI in standalone is deferred** — since there's no progress bar, how/whether to show the lives count on the Game screen is TBD. Placeholder options: top-right hearts overlay, header slot, or host-rendered. Revisit before implementing standalone.

## Shape 2 — Multi-round (`totalRounds: N ≥ 2`)

See [default-flow.md](default-flow.md) for the canonical multi-round diagram. Every rounds-based spec starts from that diagram.

## Shape 3 — Sectioned (`sections: [...]` present)

```
Preview ─▶ Welcome ─▶ Section 1 intro ─▶ Round 1 ─▶ Game ─▶ … ─▶ Game (last of S1) ─┐
🔊 prev    🔊 vo     🔊 section vo       🔊"R 1"    🔊prompt                         │
           [ready]   [ready]             auto       progress: S1 · i/k               │
                                                                                     │
            ┌────────────────────────────────────────────────────────────────────────┘
            ▼
   Section 2 intro ─▶ Round k+1 ─▶ Game ─▶ … ─▶ Game (last of last section) ─▶ Victory
   🔊 section vo     🔊"R k+1"    🔊prompt                                     1–3★
   [ready]           auto         progress: S2 · j/m
```

Section intros are tap-to-advance (same sub-type as Level N / Practice / Challenge). Game-Over and Victory branches behave identically across all three shapes — only the body between Welcome and the end differs.
