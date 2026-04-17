# Position Maximizer — Pre-Generation Plan

**Game ID:** `position-maximizer` | **Archetype:** Board Puzzle (#6) | **Bloom:** L4 Analyze | **Shape:** 1 (Standalone, `totalRounds: 1`) | **Rounds:** 1 | **Lives:** 1 | **Timer:** none | **Stars:** 0 or 1 (binary) | **Drag/Drop:** PART-033

**One-liner:** Student drags three digit tiles into three empty cells of a cross-shaped grid that encodes three numbers simultaneously, committing one placement that must equal the maximum achievable N1 + N2 + N3 — a single-shot analytical choice rewarded binarily.

PART flags active: PART-001 (state machine), PART-004 (FeedbackManager hooks), PART-005 (preview), PART-007 (audio), PART-008 (sticker), PART-009 (SFX), PART-010 (dynamic TTS), PART-017 (single-step feedback), PART-019 (data contract), PART-025 (visibility pause), PART-027 (accessibility), PART-033 (drag-and-drop), PART-042 (content validation). PART-006 (timer), PART-023 (progress bar), PART-039 (preview-skip on restart) are all OMITTED.

---

## 1. Screen Flow

Shape 1 Standalone — NO Welcome, NO Round-N intro, NO Victory, NO Game Over, NO "Ready to improve", NO "Stars collected", NO retry, NO Play Again, NO Claim Stars, NO progress bar. Stars are awarded automatically at feedback end.

```
┌──────────────┐ tap Start  ┌────────────────────────┐ tap Submit  ┌────────────────────────┐
│ Preview      ├───────────▶│ Gameplay (cross-grid)  ├────────────▶│ Feedback (inline)      │
│ PreviewScreen│            │ TransitionScreen-free  │             │ SFX+sticker awaited,   │
│ (PART-005)   │            │ drag + tap + Submit    │             │ then TTS+subtitle+     │
│ 🔊 previewVO │            │ 🔊 prompt VO (optional)│             │ sticker awaited        │
│ Start CTA    │            │ Submit disabled until  │             │ 1 star or 0 stars      │
└──────────────┘            │ all 3 slots filled     │             │ lives -> 1 (✓) / 0 (✗) │
                            └────────────────────────┘             └───────────┬────────────┘
                                                                               │ auto, after feedback audio
                                                                               ▼
                                                                      ┌─────────────────┐
                                                                      │ Game End event  │
                                                                      │ {stars, correct,│
                                                                      │  livesLeft}     │
                                                                      │ host resumes    │
                                                                      └─────────────────┘
```

### Screen inventory

| # | Screen | CDN Component | `data-phase` | Buttons | Exit trigger |
|---|--------|---------------|--------------|---------|--------------|
| 1 | Preview | `PreviewScreenComponent` (PART-005) | `start` | `Start` (single CTA) | tap Start → Gameplay |
| 2 | Gameplay | none (custom cross-grid layout inside `#gameContent`) | `gameplay` | `Submit` (bottom, disabled until 3 slots filled) | tap Submit → Feedback |
| 3 | Feedback | none (inline feedback layer on Gameplay — FeedbackManager drives sticker + TTS + subtitle over a semi-transparent veil) | `gameplay` (retained) → `results` (on completion) | none | after TTS audio resolves → `game_complete` postMessage (fired BEFORE audio per Rule; host then navigates away) |

**No `TransitionScreen` instances** — Shape 1 Standalone explicitly excludes Welcome / Round-N / Victory / Game Over / motivation / stars-collected screens. Do NOT enumerate or render any `transitionScreen.show({...})` call.

**No `ProgressBar`** — Shape 1 hides the progress bar. The 1-life counter is NOT rendered in the HUD; it lives in `gameState.livesLeft` and is reported in the `game_complete` payload.

### Preview screen content (exact strings — these feed `PreviewScreenComponent`)

| Field | Value |
|-------|-------|
| `previewInstruction` (HTML) | `<p><strong>Place the 3 digit tiles into the empty slots to make the biggest total!</strong></p><p>Add Number&nbsp;1 + Number&nbsp;2 + Number&nbsp;3. Think about which slot is worth the most before you submit — you only get one try.</p>` |
| `previewAudioText` | `"Place three digit tiles into the empty slots on the cross grid. You want to make the biggest total when you add all three numbers together. Each slot is worth a different amount, so think carefully about where each digit goes. You only get one chance to submit."` |
| `previewAudio` | `null` (TTS generated at deploy time) |
| `showGameOnPreview` | `false` |
| CTA label | `"Start"` (platform default; do not override) |

### Gameplay screen layout (375×667 mobile portrait)

```
+---------------------------------------------+
| [preview header — avatar | "Question 1" |   |  ← persistent fixture, 56px
|  score | star]                              |
+---------------------------------------------+
|  Goal: make N1 + N2 + N3 as big as you can  |  ← prompt banner, 40px
+---------------------------------------------+
|                                             |
|                 [N1 label]                  |
|            ┌───┐                            |
|            │ _ │  ← S1 (dashed, empty)      |
|            ├───┤                            |
|  [N2 label]│ 7 │       ← shared fixed cell  |
|     ┌───┬──┴───┴──┬───┬───┐                 |
|     │ _ │  7 │  8 │ _ │  ← S2 | 7 | 8 | S3  |
|     └───┴──┬───┬──┴───┴───┘  row = N2      |
|            │ 6 │        ┌───┐               |
|            ├───┤        │ 7 │  [N3 label]   |
|            │ 3 │        ├───┤               |
|            ├───┤        │ 6 │               |
|            │ 3 │        └───┘               |
|            └───┘                            |
|                                             |
+---------------------------------------------+
|   Tile tray (drag from here):               |
|      ┌──┐    ┌──┐    ┌──┐                   |
|      │ 9│    │ 2│    │ 2│                   |
|      └──┘    └──┘    └──┘                   |
+---------------------------------------------+
|          [  Submit  ]  (disabled)           |  ← 56px bar bottom
+---------------------------------------------+
```

Column-0 usage note: S2 sits at `(1,0)` (leftmost of N2), S1 sits at `(0,0)` (top of N1). S1 and S2 are both in column 0 in spec coords, but S1 is on row 0 (above N2's row) and S2 is on row 1 (the N2 row). The visual above shows the N1 vertical column shifted to grid column 1 (visually centered) and S2 rendered to the left of the shared (1,1) cell — same logical `(row,col)` coords, centered horizontally.

**Element list:**

| Element | Position | Content | Interactive? |
|---------|----------|---------|--------------|
| Preview header | top (fixed, 56px) | avatar, "Question 1", score, star | no |
| Prompt banner | below header, 40px tall | "Goal: make N1 + N2 + N3 as big as you can" | no |
| Number labels (N1, N2, N3) | floating next to each number's first cell | `Number 1 (5 digits)` / `Number 2 (4 digits)` / `Number 3 (3 digits)` | no |
| Fixed cells (7 of them) | in the cross grid | digit printed, **solid border**, filled background `var(--mathai-surface-2)` | no |
| Empty slot S1 | `(0,0)` — top of N1 | dashed border, empty interior, `data-slot-id="S1"` | drop target, tap-to-clear when filled |
| Empty slot S2 | `(1,0)` — leftmost of N2 | dashed border, empty interior, `data-slot-id="S2"` | drop target, tap-to-clear when filled |
| Empty slot S3 | `(1,3)` — rightmost of N2 / top of N3 (shared) | dashed border **with a small "shared" badge corner icon**, empty interior, `data-slot-id="S3"` | drop target, tap-to-clear when filled |
| Tile tray | below grid | 3 draggable tiles labeled `9`, `2`, `2`, `data-tile-id="T0"/"T1"/"T2"` | drag |
| Submit button | bottom bar | label `"Submit"`; `disabled` until `filledSlots == 3`; otherwise highlighted | tap |
| Feedback veil + sticker + subtitle | centered overlay on Submit | shown after Submit tap by FeedbackManager | no (input blocked) |

---

## 2. Single-Round Breakdown

Single puzzle. Coordinate system `(row, col)`, rows 0–4, cols 0–3.

### 2.1 Board configuration (from spec — verbatim)

| Coord | Belongs to | Place value | State |
|-------|-----------|-------------|-------|
| `(0,0)` | N1 | ten-thousands (×10 000) | **Empty — slot S1** |
| `(1,0)` | N2 | thousands (×1 000) | **Empty — slot S2** |
| `(1,1)` | N1 thousands + N2 hundreds | ×1 000 + ×100 | Fixed = `7` |
| `(1,2)` | N2 | tens (×10) | Fixed = `8` |
| `(1,3)` | N2 ones + N3 hundreds (shared) | ×1 + ×100 | **Empty — slot S3** |
| `(2,1)` | N1 | hundreds (×100) | Fixed = `6` |
| `(2,3)` | N3 | tens (×10) | Fixed = `7` |
| `(3,1)` | N1 | tens (×10) | Fixed = `3` |
| `(3,3)` | N3 | ones (×1) | Fixed = `6` |
| `(4,1)` | N1 | ones (×1) | Fixed = `3` |

Any other `(r,c)` is a structural void — no border, no interaction, `visibility: hidden` / absent from DOM.

### 2.2 Tiles

| Tile id | Digit |
|---------|-------|
| T0 | 9 |
| T1 | 2 |
| T2 | 2 |

T1 and T2 are semantically interchangeable (same digit). Identity tracked by `data-tile-id`; equality checked by digit value.

### 2.3 Slot weights (derived, engine confirms at load)

| Slot | Belongs to | Weight |
|------|-----------|--------|
| S1 | N1 (ten-thousands only) | 10 000 |
| S2 | N2 (thousands only) | 1 000 |
| S3 | N2 ones + N3 hundreds (shared) | 1 + 100 = 101 |

### 2.4 Fixed-cell contribution (constant regardless of placement)

- N1 fixed: 7 000 + 600 + 30 + 3 = 7 633
- N2 fixed: 700 + 80 = 780
- N3 fixed: 70 + 6 = 76
- `fixedBase = 8 489` (spec pre-computed)

### 2.5 Maximum sum (correct target)

- S1 ← 9 → 90 000
- S2 ← 2 → 2 000
- S3 ← 2 → 202
- Slots total: 92 202; grand total `maxSum = 100 691`.

Two 2-tiles are swappable between S2 and S3 (`S2=2,S3=2` is the only maximum pattern; which physical tile id sits in which slot does not matter).

### 2.6 Student interaction sequence

1. **Enter gameplay.** Prompt banner animates in; tiles render in tray; Submit is `disabled`; `gameState.phase = "gameplay"`; `gameState.filledSlots = 0`.
2. **Drag a tile from the tray.** `pointerdown` on tile → tile lifts with `.tile-dragging` class (scale 1.05, shadow). Soft tracking; tile follows pointer via `translate3d`. During drag, each empty slot shows a hover highlight on `pointerenter`.
3. **Drop on an empty slot.** `pointerup` over a dashed slot:
   - Valid: tile snaps into slot (100 ms `ease-out`), slot switches to `.slot-filled` state (digit rendered, dashed border → solid accent color `var(--mathai-accent)`); tray leaves an empty ghost where the tile was; fire-and-forget SFX `sound_piece_place` (or soft snap SFX mapped in FeedbackManager).
   - Invalid (drop outside any slot, or on a fixed/already-filled slot): tile springs back to its tray slot over 200 ms `cubic-bezier(.5,1.5,.5,1)`; NO SFX.
4. **Submit button re-evaluates each placement change:**
   - If `gameState.filledSlots === 3` → enable Submit; add `.cta-highlight` pulse (once).
   - Else → disable Submit; remove highlight.
5. **Return a tile from a filled slot (tap).** Tap a `.slot-filled` cell:
   - Tile animates back to its tray origin (150 ms linear); slot reverts to empty dashed state; fire-and-forget `sound_deselect`. Submit disables.
6. **Free rearrangement.** Repeat steps 2–5 until satisfied. No attempt counting during this phase, no hints, no timer.
7. **Tap Submit (all 3 slots filled).**
   - `gameState.isProcessing = true` — input blocked (tiles and slots set `pointer-events: none`).
   - Engine computes `submittedSum = fixedBase + S1.weight * S1.digit + S2.weight * S2.digit + S3.weight * S3.digit`.
   - Branch to §3 (correct) or §4 (wrong).

### 2.7 What the student sees — summary

- **Pre-Submit:** a cross with 7 fixed digits visible, 3 dashed slots (one of which carries a small shared-slot icon), a tile tray of [9, 2, 2], a prompt banner, a disabled Submit button.
- **During drag:** tile follows pointer; valid slot highlights; invalid drop bounces back.
- **Post-Submit (correct):** veil, celebration sticker, TTS worked-example congratulations, 1-star animation, then game ends.
- **Post-Submit (wrong):** veil, sad sticker, TTS worked-example hint naming the specific magnitude error, 0-star state, then game ends.

---

## 3. Scoring and Lives Logic

### 3.1 `gameState` shape (minimum)

| Field | Type | Initial | Transitions |
|-------|------|---------|-------------|
| `phase` | `"start"|"gameplay"|"results"` | `"start"` | `start` on Preview mount → `"gameplay"` on Start tap → stays `"gameplay"` through feedback → flipped to `"results"` immediately before `game_complete` is posted |
| `totalRounds` | number | `1` | const |
| `currentRound` | number | `1` | const |
| `lives` | number | `1` | `-1` on wrong Submit → `0`; never increases |
| `livesLeft` | number | `1` | alias for `lives`; used in payload |
| `score` | number | `0` | `+1` on correct Submit |
| `stars` | number | `0` | `1` on correct Submit; `0` on wrong Submit |
| `filledSlots` | number | `0` | increments on drop, decrements on return-to-tray |
| `placements` | `{S1:number|null, S2:number|null, S3:number|null}` | `{null, null, null}` | mutated by drag/drop and tap-return |
| `tileTray` | `Array<{id, digit, inSlot: string|null}>` | `[{T0,9,null},{T1,2,null},{T2,2,null}]` | mirrors `placements` |
| `isProcessing` | boolean | `false` | `true` during feedback; blocks all input |
| `startTime` | number | `Date.now()` captured at gameplay mount | const |

### 3.2 State transitions on Submit

```
Submit tapped
  → isProcessing = true
  → submittedSum = fixedBase + Σ(slot.weight * slot.digit)
  → if submittedSum === maxSum (100 691):
        score = 1
        stars = 1
        lives = livesLeft = 1   (unchanged)
        phase = "results"
        → fire recordAttempt({correct: true, ...}) synchronously
        → fire game_complete postMessage BEFORE audio
        → run correct feedback sequence (§4)
  → else:
        score = 0
        stars = 0
        lives = livesLeft = 0   (decremented from 1)
        phase = "results"
        → determine misconceptionKey (see §6)
        → fire recordAttempt({correct: false, misconception_tag, ...}) synchronously
        → fire game_complete postMessage BEFORE audio
        → run wrong feedback sequence (§4)
  → (after feedback audio resolves) dispatch `Game End` event; host resumes
```

### 3.3 `recordAttempt` payload (fires exactly once per game)

```
recordAttempt({
  is_correct:        true | false,
  misconception_tag: null | <one of: "intersection-overweighting", "magnitude-error",
                                     "fill-the-first-blank", "partial-application">,
  round_number:      1,
  response_time_ms:  Date.now() - gameState.startTime,
  input_of_user:     "S1=<d>,S2=<d>,S3=<d>",   // e.g. "S1=9,S2=2,S3=2"
  correct_answer:    "S1=9,S2=2,S3=2",         // canonical max (any equivalent-maximum placement is still correct; tag is null)
  difficulty_level:  1,
  question_id:       "cross-9-2-2"
})
```

### 3.4 `game_complete` postMessage (fires BEFORE feedback audio)

```
window.parent.postMessage({
  type: "game_complete",
  data: {
    correct:   true | false,
    stars:     1 | 0,
    livesLeft: 1 | 0,
    score:     1 | 0,
    totalQuestions: 1,
    accuracy:  100 | 0,
    timeSpent: Date.now() - gameState.startTime,
    metrics: {
      accuracy: 100 | 0,
      time:     <ms>,
      stars:    1 | 0,
      attempts: 1,
      totalLives: 1,
      tries:    1
    }
  }
}, "*");
```

Rule: `game_complete` is posted synchronously **before** `FeedbackManager.sound.play(...)` begins. Verified by `test/content-match.test.js` and static validator.

### 3.5 Stars

- `1 star` iff `submittedSum === maxSum` (100 691).
- `0 stars` otherwise. No 2-star / 3-star tiers. No partial credit.
- Stars are animated in during the feedback sequence (via `.star-earned` 400 ms CSS animation) but the payload `stars` value is fixed before audio.

### 3.6 Lives

- `livesLeft` starts at 1, decrements to 0 on wrong Submit, stays at 1 on correct Submit.
- NOT rendered in HUD (Shape 1 has no progress bar; lives UI deferred).
- Tracked only for `game_complete.data.livesLeft` and `metrics.totalLives`.

---

## 4. Feedback Patterns (single-step — SFX + sticker then TTS + subtitle, awaited)

Bloom L4 Analyze, Standalone shape, single commitment → **single-step feedback sequence** (per feedback/SKILL.md Cases 4 & 6 adapted). Both correct and wrong paths use `await sound.play → await playDynamicFeedback`. Input is blocked via `gameState.isProcessing = true` throughout.

### 4.1 Correct path (Submit matches max sum)

| # | Action | API | Await? | Notes |
|---|--------|-----|--------|-------|
| 1 | Block input | `gameState.isProcessing = true` | — | disables tiles + Submit + slot taps |
| 2 | Paint placement result | add `.placement-correct` to each filled slot (soft green glow) | — | purely cosmetic, 300 ms fade-in |
| 3 | Fire `recordAttempt({correct: true, ...})` | — | — | sync, before audio |
| 4 | Post `game_complete` postMessage | — | — | sync, BEFORE audio |
| 5 | SFX + celebration sticker | `await FeedbackManager.sound.play('correct_sound_effect', { sticker: 'celebration' })` | **yes** | awaited |
| 6 | Dynamic TTS + subtitle + sticker | `await FeedbackManager.playDynamicFeedback({ audio_content: correctHint, subtitle: correctHint, sticker: 'celebration' })` | **yes** | `correctHint` = `"Perfect! Placing 9 in the ten-thousands slot adds 90,000 — the biggest jump possible. Maximum sum: 100,691."` |
| 7 | Star animation | `.star-earned` CSS | — | 400 ms |
| 8 | Dispatch Game End event | `window.dispatchEvent(new CustomEvent('game_end'))` | — | host navigates |

If the student submits the alternate equivalent-maximum placement (S1=9, S2 and S3 both hold 2s but swapped tile identity), this path still fires — equality is by digit value in slot, not tile id.

### 4.2 Wrong path (Submit ≠ max sum)

| # | Action | API | Await? | Notes |
|---|--------|-----|--------|-------|
| 1 | Block input | `gameState.isProcessing = true` | — | |
| 2 | Determine misconception key | engine logic §6 | — | pick one of `"9-in-S3"`, `"9-in-S2"`, `"2-in-S1"`, `"2-in-S2-and-9-in-S3"`, `"default"` |
| 3 | Paint placement result | add `.placement-wrong` to the slot holding the highest-magnitude error (soft red ring); optionally render a small `×` badge | — | 300 ms fade-in |
| 4 | Fire `recordAttempt({correct: false, misconception_tag: ..., ...})` | — | — | sync, before audio |
| 5 | Post `game_complete` postMessage | — | — | sync, BEFORE audio |
| 6 | SFX + sad sticker | `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: 'sad' })` | **yes** | awaited |
| 7 | Dynamic TTS + subtitle + sticker | `await FeedbackManager.playDynamicFeedback({ audio_content: wrongHints[key], subtitle: wrongHints[key], sticker: 'sad' })` | **yes** | Worked-example hint from spec `wrongHints` table |
| 8 | NO retry, NO Game Over screen | — | — | Standalone shape: Feedback is terminal. |
| 9 | Dispatch Game End event | `window.dispatchEvent(new CustomEvent('game_end'))` | — | host navigates |

### 4.3 During-drag / tap feedback (fire-and-forget, not awaited)

| Event | Behavior | API call |
|-------|----------|----------|
| Tile picked up | Class `.tile-dragging`; no SFX | — |
| Tile dropped on empty slot | Snap animation 100 ms; fire-and-forget SFX | `FeedbackManager.sound.play('sound_piece_place').catch(()=>{})` |
| Invalid drop (off-grid, on fixed cell, on filled slot) | Bounce back 200 ms; no SFX | — |
| Tap filled slot → return tile | Return animation 150 ms; fire-and-forget SFX | `FeedbackManager.sound.play('sound_deselect').catch(()=>{})` |
| All 3 slots filled | Submit enables, `.cta-highlight` pulses once | — (no audio) |

### 4.4 Visibility / pause

| Event | Behavior |
|-------|----------|
| `document.visibilitychange` → hidden | `FeedbackManager.pauseAll()`; show semi-transparent "Game Paused" overlay; cancel any in-flight drag (tile returns to tray) |
| `document.visibilitychange` → visible | `FeedbackManager.resumeAll()`; dismiss overlay; state preserved |

### 4.5 Subtitle templates and examples

| Key | Subtitle (verbatim) |
|-----|---------------------|
| correct | `"Perfect! Placing 9 in the ten-thousands slot adds 90,000 — the biggest jump possible. Maximum sum: 100,691."` |
| `"9-in-S3"` | `"Not quite! You placed 9 in a slot worth 101, contributing 909. In the ten-thousands slot it would have contributed 90,000."` |
| `"9-in-S2"` | `"Not quite! You placed 9 in the thousands slot, contributing 9,000. In the ten-thousands slot it would have contributed 90,000."` |
| `"2-in-S1"` | `"Not quite! You placed 2 in the ten-thousands slot, contributing only 20,000. The 9 there would have contributed 90,000."` |
| `"default"` | `"Not quite! The biggest digit belongs in the slot with the biggest place value — the ten-thousands slot of Number 1."` |

Subtitle text is identical to `audio_content` (per single-step pattern). All strings must appear verbatim in `fallbackContent.rounds[0].wrongHints` and `fallbackContent.rounds[0].correctHint` — validator `5f-CONTENT-MATCH` enforces this.

### 4.6 Animations

| Animation | Class | Duration | Trigger |
|-----------|-------|----------|---------|
| Tile drag lift | `.tile-dragging` | while dragging | pointerdown |
| Tile snap into slot | `.tile-snapping` | 100 ms | valid drop |
| Tile bounce back | `.tile-bounce` | 200 ms | invalid drop |
| Tile return to tray | `.tile-returning` | 150 ms | tap-to-clear |
| Submit CTA pulse | `.cta-highlight` | 600 ms, once | filledSlots reaches 3 |
| Placement correct glow | `.placement-correct` | 300 ms fade, persistent | correct Submit |
| Placement wrong ring | `.placement-wrong` | 300 ms fade, persistent | wrong Submit |
| Star earned | `.star-earned` | 400 ms | correct Submit feedback |
| Feedback veil | `.feedback-veil` | 200 ms fade-in | Submit |

No heart-break animation — lives are not HUD-rendered.

---

## 5. Grid Rendering Plan

### 5.1 Technique: CSS Grid (single `display:grid` container, 5 rows × 4 cols)

Reason: the cross shape is naturally expressible as a 5×4 matrix where each of the 10 listed `(row,col)` entries maps to a `grid-row / grid-column` placement; structural voids are simply cells with no child. This is more robust than absolute positioning (reflows correctly on mobile, honors safe-area) and simpler than SVG (sticker overlay + pointer hit-testing both work natively on DOM cells).

```
#crossGrid {
  display: grid;
  grid-template-columns: repeat(4, 56px);
  grid-template-rows:    repeat(5, 56px);
  gap: 8px;             /* PART-027: 8px minimum spacing */
  justify-content: center;
  align-content: center;
  margin: 16px auto;
  touch-action: none;   /* prevent scroll-during-drag on iOS */
}
```

Each cell element is placed with `grid-column: <col+1>` / `grid-row: <row+1>`. Structural voids are omitted entirely — no empty placeholder divs.

### 5.2 Cell types and visual distinction

| Type | DOM | Border | Background | Cursor | Content |
|------|-----|--------|------------|--------|---------|
| Fixed cell | `<div class="cell cell-fixed" data-r data-c>` | **Solid** 2 px `var(--mathai-accent)` | `var(--mathai-surface-2)` | default | digit in `font-weight:700`, `font-size:24px` |
| Empty slot (S1, S2) | `<div class="cell cell-slot" data-slot-id data-r data-c>` | **Dashed** 2 px `var(--mathai-accent-muted)` | transparent | `pointer` on hover | empty; pseudo-element `::before` renders faint `_` hint |
| Empty slot S3 (shared) | as above + `.cell-slot-shared` | Dashed + a 14 px "shared" badge at top-right corner (absolute, icon `⇆` or a tiny chain glyph) | transparent | `pointer` | same as other slots |
| Filled slot | `.cell-slot.cell-slot-filled` | Solid 2 px `var(--mathai-accent)` | `var(--mathai-accent-10)` tint | `pointer` (tap to clear) | digit |
| Structural void | (no DOM) | — | — | — | — |

`--mathai-accent` / `--mathai-accent-muted` / `--mathai-accent-10` are the only color vars — honors CLAUDE.md CSS var rule.

### 5.3 Number labels

Rendered as absolutely-positioned `<span class="number-label">` children of the grid container:
- `N1` label: `"Number 1 (5 digits)"` — positioned above `(0,0)`, baseline-aligned with the top of S1.
- `N2` label: `"Number 2 (4 digits)"` — positioned to the left of `(1,0)`, vertically centered on the N2 row.
- `N3` label: `"Number 3 (3 digits)"` — positioned above `(1,3)`, baseline-aligned with the top of S3.

Label font: 12 px, `font-weight:600`, color `var(--mathai-text-muted)`.

### 5.4 Tile tray

```
.tile-tray {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 16px;
  min-height: 72px;     /* 44+padding — PART-027 touch target */
}
.tile {
  width: 56px; height: 56px;
  border-radius: 12px;
  background: var(--mathai-tile-bg);
  box-shadow: 0 2px 6px rgba(0,0,0,.08);
  display: flex; align-items: center; justify-content: center;
  font-size: 28px; font-weight: 700;
  touch-action: none;
  cursor: grab;
}
.tile.tile-placed { opacity: 0.3; pointer-events: none; } /* ghost while in a slot */
```

When a tile is placed in a slot, its tray origin keeps a faded ghost (`.tile-placed`) so the student can tap-return and restore the tile to the same tray position.

### 5.5 Drag-and-drop wiring (PART-033)

**Library:** use the repo's existing DnD helper (see `simplify` note — match the pattern used in `games/jigsaw-puzzle/index.html` and `games/matching-doubles/index.html`; prefer pointer-events-based custom DnD over HTML5 drag API for touch fidelity). If `@dnd-kit` is loaded via CDN in the base template, use it; otherwise roll a pointer-events implementation (as below).

**Pointer-events flow:**

1. `pointerdown` on `.tile`:
   - `e.preventDefault()`; set `pointer-capture` on document.
   - Store `dragState = { tileId, startX, startY, originEl }`.
   - Add `.tile-dragging` class (scale 1.05, z-index 1000, pointer-events off on the tile itself so elementFromPoint passes through).
2. `pointermove` (document-level listener):
   - Translate tile via `transform: translate3d(dx, dy, 0)`.
   - `const target = document.elementFromPoint(e.clientX, e.clientY)`; if `target.closest('.cell-slot:not(.cell-slot-filled)')` → add `.slot-hover` to it and remove from any other slot.
3. `pointerup` (document-level):
   - Compute drop target via `elementFromPoint`. If it matches an empty slot → call `placeTile(tileId, slotId)` (snap 100 ms, update `gameState.placements`, update `filledSlots`, re-evaluate Submit enabled state). Else → `bounceBack(tileEl)` (200 ms cubic-bezier).
   - Remove `.tile-dragging`; release pointer capture.
4. `pointerdown` on `.cell-slot-filled`:
   - Call `returnTile(slotId)`: remove digit from slot, restore tile ghost in tray, decrement `filledSlots`, re-evaluate Submit, fire-and-forget `sound_deselect`.

**Invariants enforced by DnD logic:**
- A tile can only be dropped on an empty slot. Fixed cells and filled slots reject drops (bounce-back).
- At most one tile per slot.
- Tile identity preserved: T1 (2) and T2 (2) are distinguishable by `data-tile-id` even though both render as `2`. Engine evaluation uses digit value, not tile id.
- `touch-action: none` on `.tile`, `.cell-slot`, `#crossGrid`, `.tile-tray`, and `#gameContent` prevents iOS scroll-hijack.

### 5.6 Responsive behavior

- Cells are fixed at 56×56 px (meets 44 px touch target + 8 px spacing per PART-027).
- Grid total: 4×56 + 3×8 = 248 px wide × 5×56 + 4×8 = 312 px tall.
- Centered on viewport (375×667). Top offset 100 px (below header + prompt banner).
- Tile tray sits at top 450 px; Submit bar at top 595 px (fixed), giving 56 px of safe area below.
- No rotation / landscape support; portrait-only.

---

## 6. Evaluation Logic

### 6.1 Correctness check

```
submittedSum = fixedBase
             + S1.weight * placements.S1
             + S2.weight * placements.S2
             + S3.weight * placements.S3
             = 8489 + 10000*placements.S1 + 1000*placements.S2 + 101*placements.S3
correct = (submittedSum === maxSum)   // maxSum = 100691
```

Evaluation mode is `"max-sum"` (spec) — do NOT compare per-slot digits against `correctAnswer.S1/S2/S3` literally, because `{S1:9, S2:2, S3:2}` has two equivalent realizations (T1↔T2 swap). The `===` total comparison accepts any digit assignment that hits 100 691.

### 6.2 Misconception classification (picks wrongHint template)

Evaluated only when `correct === false`. Engine inspects `placements` and chooses a key via this precedence (first match wins):

| Priority | Condition | `misconceptionKey` | `misconception_tag` |
|----------|-----------|--------------------|---------------------|
| 1 | `placements.S3 === 9` AND `placements.S1 !== 9` | `"9-in-S3"` | `intersection-overweighting` |
| 2 | `placements.S2 === 9` AND `placements.S1 !== 9` | `"9-in-S2"` | `magnitude-error` |
| 3 | `placements.S1 === 2` (the 9 ended up elsewhere) | `"2-in-S1"` | `fill-the-first-blank` |
| 4 | `placements.S2 === 2` AND `placements.S3 === 9` (from rule 1, but explicit 4-key tag) | `"2-in-S2-and-9-in-S3"` (hint copy fallbacks to `"9-in-S3"` text) | `intersection-overweighting` |
| 5 | catch-all | `"default"` | `partial-application` |

Note: the engine chooses ONE hint subtitle + ONE misconception_tag per submission. Priority 4 is structurally covered by Priority 1's condition (both require S3=9), but the spec distinguishes tag for the specific `S2=2 & S3=9` pattern; implementation may collapse rule 1 and rule 4 into a single branch on S3=9 and use the S2 value to pick between two tag-pointers — both still emit the `"9-in-S3"` subtitle string. (The subtitle-vs-tag mapping table from `wrongHints` and `misconception_tags` is intentionally many-to-many.)

### 6.3 Pseudocode

```
function evaluate(placements) {
  const total = 8489
              + 10000 * placements.S1
              + 1000  * placements.S2
              + 101   * placements.S3;
  if (total === 100691) {
    return {
      correct: true,
      subtitle: fallbackContent.rounds[0].correctHint,
      misconception_tag: null
    };
  }
  let key;
  if      (placements.S3 === 9)                       key = placements.S2 === 2 ? "2-in-S2-and-9-in-S3" : "9-in-S3";
  else if (placements.S2 === 9)                       key = "9-in-S2";
  else if (placements.S1 === 2)                       key = "2-in-S1";
  else                                                key = "default";
  const hints = fallbackContent.rounds[0].wrongHints;
  const tags  = fallbackContent.rounds[0].misconception_tags;
  // Hint subtitle: spec only ships 4 wrongHints ("9-in-S3", "9-in-S2", "2-in-S1", "default").
  // "2-in-S2-and-9-in-S3" shares the "9-in-S3" subtitle but carries its own tag.
  const subtitleKey = (key === "2-in-S2-and-9-in-S3") ? "9-in-S3" : key;
  return {
    correct: false,
    subtitle: hints[subtitleKey] || hints["default"],
    misconception_tag: tags[key] || tags["any-other-nonmax"]
  };
}
```

### 6.4 Validation invariants (pipeline T1 / contract checks)

- `fallbackContent.rounds[0].maxSum === 100691`
- `fallbackContent.rounds[0].fixedBase === 8489`
- `fallbackContent.rounds[0].tiles.sort() === [2,2,9]`
- Every string in `wrongHints` and `correctHint` appears verbatim as a subtitle in the runtime DOM when the corresponding path fires (content-match test).
- Every `misconception_tags` key corresponds to either (a) a direct `wrongHints` lookup or (b) an explicit fallback branch documented in §6.2.
- `evaluation === "max-sum"` — engine does NOT do per-slot literal compare.

---

## 7. Content Contract Cheatsheet (for game-building)

Strings that must appear verbatim in HTML (subject to `5f-CONTENT-MATCH`):

- Preview: `previewInstruction` HTML block, `Start` CTA label.
- Gameplay prompt banner: `"Goal: make N1 + N2 + N3 as big as you can"` (derived from `spec.rounds[0].prompt`; builder may use spec prompt `"Place the 3 tiles to make N1 + N2 + N3 as big as possible."` verbatim — pick ONE and commit).
- Number labels: `"Number 1 (5 digits)"`, `"Number 2 (4 digits)"`, `"Number 3 (3 digits)"`.
- Submit button: `"Submit"`.
- Correct feedback subtitle: `correctHint` verbatim.
- Wrong feedback subtitle: one of the 4 `wrongHints` values verbatim.

Strings that must NOT appear (Shape 1 exclusions — validator flags presence):
- `"Welcome"`, `"Let's Go"`, `"Ready"`, `"Play Again"`, `"Try Again"`, `"Claim Stars"`, `"Round 1"`, `"Round N"`, `"Level N"`, `"Game Over"`, `"Victory"`, `"Stars collected"`.

---

## 8. Implementation Risks / Open Questions

1. **Single prompt vs preview instruction duplication risk.** Spec provides both `previewInstruction` (shown once by PreviewScreenComponent) and a per-round `prompt`. The plan renders the prompt as a small banner ("Goal: …") that is semantically distinct from the preview's "how-to-play" copy. Builder MUST NOT re-render `previewInstruction` inside `#gameContent` (game-planning constraint 7).
2. **Shared slot visual affordance.** The plan adds a small ⇆ badge to S3 to convey shared membership. If the builder cannot render the badge accessibly, fall back to a distinct secondary border color — but keep the dashed empty-state convention.
3. **Tile identity vs digit equality.** T1 and T2 both carry digit 2 and are truly interchangeable for scoring. Builder must key tile state by `data-tile-id` but evaluate by digit value.
4. **Misconception branch for `"2-in-S2-and-9-in-S3"`.** This tag is distinct from `"9-in-S3"` in `misconception_tags`, but the spec does not ship a dedicated subtitle — it reuses `wrongHints["9-in-S3"]`. Plan §6.3 collapses the two.
5. **`game_complete` BEFORE audio.** Critical ordering rule. Common miss — verify test coverage.
6. **No progress bar + no HUD lives.** Builder must suppress ProgressBar completely; the 1-life counter lives in `gameState.livesLeft` only.
7. **iOS scroll-hijack during drag.** `touch-action: none` must be applied to `#gameContent`, `#crossGrid`, `.tile-tray`, `.tile`, `.cell-slot`. Missing any one causes drag-glitch on Safari.
8. **Equivalent-maximum placements.** Engine evaluation uses total sum compare — NOT per-slot literal match. A student who puts T2 in S2 and T1 in S3 (both digit 2) still wins.
9. **Feedback screen identity.** There is no separate Feedback transitional screen — feedback is an inline overlay on Gameplay. `data-phase` flips to `"results"` silently (for analytics) without a screen transition animation.
10. **Fixed-digit order in grid.** Verify `(1,1)=7, (1,2)=8, (2,1)=6, (2,3)=7, (3,1)=3, (3,3)=6, (4,1)=3` are painted exactly — a single mislabeled digit changes `fixedBase` and the correct-submit will never fire.
11. **Emotional safety on wrong.** Spec Warning: the 0-stars outcome is emotionally heavy. Builder must NOT add "Game Over" text; the wrong feedback subtitle is the terminal copy. Consider the subtitle the final message the student sees in-game.
12. **Grid ambiguity (spec Warning).** The 3 empty slots are (0,0), (1,0), (1,3). If the creator intended different empties, the tile set and `maxSum` must be recomputed. Plan commits to the spec-frozen triple.
