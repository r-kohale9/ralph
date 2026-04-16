# Flow Gallery — Shapes 4–8 + Translation Table

The three base shapes (`shapes.md`) cover the defaults. This gallery shows how the same runtime scales to non-default flows by tweaking `steps`. Every gallery entry is just an edit to the preset the skill started from.

## Shape 4 — Multi-round with custom intro added after Preview

Edit: insert a `transition` step between the `preview` and `welcome` steps —
`{ "type":"transition", "title":"Chapter 1", "voiceOver":"vo_chapter1", "buttons":[{"text":"Begin"}] }`

```
┌─────────┐ tap ┌──────────┐ tap ┌─────────┐ auto ┌──────────┐ auto ┌──────────┐ submit ┌──────────┐
│ Preview ├────▶│ Chapter 1├────▶│ Welcome ├─────▶│ Round i  ├─────▶│ Game(Qi) ├───────▶│ Feedback │
│ 🔊 prev │     │ (custom) │     │ 🔊 vo   │      │ 🔊"R i"  │      │ progress │        │ 2s ✓/✗   │
└─────────┘     │ 🔊 vo_ch1│     │ [ready] │      │ auto     │      │ bar: i/N │        └────┬─────┘
                │ [Begin]  │     └─────────┘      └──────────┘      └──────────┘             │
                └──────────┘                            ▲                                    │
                                                        └── correct AND i < N (loop) ────────┤
                                               wrong, lives=0 ──▶ Game Over                  │
                                               correct AND i = N ──▶ Victory ────────────────┘
```

The custom transition uses the same `TransitionScreenComponent` API as built-in variations. Hooks fire in declared order; multiple hooks at the same point chain sequentially.

## Shape 5 — Welcome removed (speedrun / returning player)

Edit: delete the `welcome` step from `steps`.

```
┌─────────┐ tap ┌──────────┐ auto ┌──────────┐ submit ┌──────────┐  ...
│ Preview ├────▶│ Round 1  ├─────▶│ Game(Q1) ├───────▶│ Feedback │
│ 🔊 prev │     │ 🔊"R 1"  │      │ progress │        │ 2s ✓/✗   │
└─────────┘     │ auto     │      │ bar: 1/N │        └──────────┘
                └──────────┘      └──────────┘
```

Deleting any step skips it entirely. The runtime routes preview-complete straight to the next remaining step.

## Shape 6 — Unequal sections (Warm-up + Level 1 + Level 2 + Boss)

```json
"steps": [
  { "type": "preview" },
  { "type": "transition", "id": "welcome" },
  { "type": "transition", "id": "warmupIntro", "title": "Warm-up", "voiceOver": "vo_warmup", "buttons": [{"text":"I'm ready"}] },
  { "type": "loop", "id": "warmup", "count": 2, "lives": 0, "body": [
      { "type": "transition", "title": "Round {{i}}", "sound": "sound_round_n", "waitForSound": true },
      { "type": "round" }
  ]},
  { "type": "transition", "id": "level1Intro", "title": "Level 1", "voiceOver": "vo_level_1", "buttons": [{"text":"I'm ready"}] },
  { "type": "loop", "id": "level1", "count": 5, "body": [ /* ... */ ] },
  { "type": "transition", "id": "level2Intro", "title": "Level 2", "voiceOver": "vo_level_2", "buttons": [{"text":"I'm ready"}] },
  { "type": "loop", "id": "level2", "count": 3, "body": [ /* ... */ ] },
  { "type": "transition", "id": "bossIntro", "title": "Boss round", "voiceOver": "vo_boss", "buttons": [{"text":"Ready!"}] },
  { "type": "loop", "id": "boss", "count": 1, "lives": 1, "starModel": "firstAttempt", "body": [ /* ... */ ] }
]
```

```
Preview ─▶ Welcome ─▶ Warm-up intro ─▶ R1 ─▶ R2 ─┐     (2 rounds, lives disabled)
🔊 prev    🔊 vo     🔊 vo_warmup      auto        │     progress: Warm-up · i/2
           [ready]   [ready]                        │
                                                    ▼
       Level 1 intro ─▶ R3 ─▶ R4 ─▶ R5 ─▶ R6 ─▶ R7 ─┐   (5 rounds, lives: 3 inherited)
       🔊 vo_level_1                                  │   progress: Level 1 · i/5
       [ready]                                        │
                                                      ▼
       Level 2 intro ─▶ R8 ─▶ R9 ─▶ R10 ─┐             (3 rounds)
       🔊 vo_level_2                      │             progress: Level 2 · i/3
       [ready]                             │
                                           ▼
       Boss intro ─▶ R11 ─▶ Victory      (1 round, lives:1, firstAttempt stars)
       🔊 boss vo   firstAttempt          progress: Boss round · 1/1
       [ready]      star model
```

Per-loop overrides (`lives`, `starModel`) swap rules mid-game. The progress-bar component reads the current loop's metadata and updates its label.

## Shape 7 — Mid-game pep-talk every 3 rounds

Edit: inside `mainLoop.body`, add a conditional transition —
`{ "type":"transition", "when":"round % 3 === 0 && round > 0", "title":"Keep going!", "voiceOver":"vo_peptalk", "waitForSound": true }`

```
... Round 3 ─▶ Feedback ─▶ 🎉 Pep-talk ─▶ Round 4 intro ─▶ Game(Q4) ─▶ ...
               2s ✓/✗      🔊 vo_peptalk   🔊"R 4"         submit
                           auto-dismiss    auto
```

The `when` field gates step execution. The pep-talk is auto-dismiss (no buttons, `waitForSound: true`) so it chains smoothly into the next Round-N intro.

## Shape 8 — Custom Play-Again flow

Edit: replace the transition in `onPlayAgain` with —
`{ "type":"transition", "title":"Try a new strategy", "sticker":"alfred_think", "voiceOver":"vo_retry", "buttons":[{"text":"I'll try", "emits":"restart"}] }`

```
Victory (1–2★) ─▶ [Play Again] ─▶ Try a new strategy ─▶ Round 1 ─▶ Game ─▶ ...
                                   🔊 vo_retry            auto        submit
                                   🧠 alfred_think
                                   [I'll try]
```

Replaces the default "Ready to improve your score?" screen entirely. The default Claim-Stars → "Yay, stars collected!" path is unchanged.

## Translation table

The common rule: **every user-visible screen the author draws becomes a step; conditional branches in the drawing become `when` expressions**.

| # | Flow the author draws | Runtime-config result (internal) |
|---|---|---|
| 1 | Standalone (Preview → Game → End) | `presets/standalone.json` |
| 2 | 9-round standard | `presets/multi-round.json` |
| 3 | 3 equal levels | `presets/sectioned.json` |
| 4 | Practice + Challenge | `presets/practice-challenge.json` |
| 5 | Unequal sections — Warm-up(2) · L1(5) · L2(3) · Boss(1) | Multiple `loop` steps with per-section `count`/`lives`/`starModel` |
| 6 | Custom "Chapter 1" intro between Preview and Welcome | Extra `transition` step inserted |
| 7 | Pep-talk every 3 rounds | Conditional `transition` with `when: "round % 3 === 0 && round > 0"` |
| 8 | Welcome omitted from the diagram | No `welcome` step |
| 9 | Round-N intro omitted from the diagram | No `roundIntro` step in `mainLoop.body` |
| 10 | Custom "Try a new strategy" after Play Again | `onPlayAgain` branch fields updated |
| 11 | Stats + intro after each section | Two trailing `transition` steps per section loop |
| 12 | Author declares custom timing thresholds | `starModel: "custom"` + `starRules` |
| 13 | Celebration only on 3-star victory | `when: "stars === 3"` on that transition |
| 14 | Learning-mode worked example | `lives: 0`, `starModel: "accuracy"` (GameBody hooks render the worked example) |
| 15 | Early end at round 3 if perfect | `exitFlow` step with `when: "round===3 && wrongCount===0"`, `to: "onVictory"` |
| 16 | Cumulative-failure early Game-Over | `exitFlow` step with `when: "wrongCount >= 3"`, `to: "onGameOver"` |
