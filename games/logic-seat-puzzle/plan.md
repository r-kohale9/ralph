# Pre-Generation Plan: Logic Seating Puzzle

**Game ID:** logic-seat-puzzle
**Archetype:** Board Puzzle (#6) — Shape 2 (Multi-round)
**Bloom:** L4 Analyze
**Interaction:** P6 Drag-and-Drop (Pick & Place, with swap-on-occupied-seat)
**Rounds:** 7 (Stage 1: R1-2, Stage 2: R3-5, Stage 3: R6-7)
**Lives:** None (no Game Over branch)
**Timer:** None
**PreviewScreen:** YES (mandatory per PART-039)

---

## 1. Screen Flow

```
          ┌─────────────────────────────────────────────────────────────────┐
          │                     PreviewScreen wrapper                        │
          │  (persistent: header bar + scroll area + progress-bar slot)     │
          │                                                                  │
          │   DOMContentLoaded                                               │
          │        │                                                         │
          │        ▼                                                         │
          │   setupGame() ── renderInitialState() ── previewScreen.show() ──┐
          │                                                                  │   │
          │                                                                  │   ▼
          │                                                     ┌─── Preview State ────┐
          │                                                     │ instruction HTML:    │
          │                                                     │ "Seat everyone…"     │
          │                                                     │ "Skip & start" CTA   │
          │                                                     └──────────┬───────────┘
          │                                                                │ skip / audio-end
          │                                                                ▼
          │                                                      startGameAfterPreview()
          │                                                                │
          │                                                                ▼
          │                       ┌────────── TransitionScreen: "Round N" (N=1..7) ─────────┐
          │                       │  title "Round N"  ·  sticker rounds_sticker             │
          │                       │  onMounted: sound 'rounds_sound_effect'                  │
          │                       │  auto-advance after SFX + short delay (≈900ms)           │
          │                       └────────────────────┬─────────────────────────────────────┘
          │                                            │ auto
          │                                            ▼
          │          ┌──────────────── Gameplay Round N (data-phase="gameplay") ─────────────┐
          │          │  persistent preview header  ·  ProgressBar (N/7 segments)              │
          │          │  Clue Panel (3–5 clues, read-only)                                     │
          │          │  Table Diagram (4 / 5-head / 6 numbered seats)                         │
          │          │  Character Pool (4 / 5 / 7 chips below table)                          │
          │          │  CHECK button (disabled until every seat filled)                        │
          │          │                                                                        │
          │          │  (drag loop: pool→seat, seat→seat, seat→pool — replace-on-occupied)   │
          │          └───────┬────────────────────────────────────────────────────────────────┘
          │                  │ tap CHECK (enabled)
          │                  ▼
          │          ┌─── Whole-board validator runs against clue[] ───┐
          │          └───────┬───────────────────────────────┬─────────┘
          │          all clues satisfied                at least one clue violated
          │                  │                                 │
          │                  ▼                                 ▼
          │     ┌── Correct Feedback (inline) ──┐   ┌── Wrong Feedback (inline) ──┐
          │     │ all seats flash green 400ms    │   │ conflict seats flash red    │
          │     │ await sfx correct + sticker    │   │ await sfx incorrect + sad   │
          │     │ fire-and-forget TTS            │   │ fire-and-forget TTS         │
          │     │ recordAttempt(pass:true)       │   │ recordAttempt(pass:false)   │
          │     │ auto-advance after ≈1500ms     │   │ CHECK morphs → NEXT button  │
          │     └───────────┬────────────────────┘   │ +1500ms: reveal solution    │
          │                 │                         │ (characters slide to soln) │
          │                 │                         │ NEXT tappable any time     │
          │                 │                         └───────────┬─────────────────┘
          │                 │                                     │ NEXT tap OR auto after ≈3500ms
          │                 ▼                                     ▼
          │          ┌───── routing on N ─────┐ ─── same routing ───┐
          │          │ if N < 7 → Round N+1   │
          │          │ if N == 7 → Victory    │
          │          └─────────┬──────────────┘
          │                    │
          │        N<7 ▼                   N==7 ▼
          │   (loop to Round N+1          ┌──── Victory ────┐
          │    intro transition)          │ stars 0..3      │
          │                               │ subtitle: spec  │
          │                               │  "You solved    │
          │                               │   X of 7!"      │
          │                               └───┬────┬────────┘
          │                                   │    │
          │                       stars<3 │    │ any stars
          │                   [Play Again] │    │ [Claim Stars]
          │                                │    │
          │                                ▼    ▼
          │                  ┌─ Motivation ─┐  ┌─ Stars Collected ─┐
          │                  │ "Ready to    │  │ "Yay! 🎉          │
          │                  │ improve      │  │  Stars collected!"│
          │                  │ your score?"│  │ auto 2500ms        │
          │                  │ [I'm ready!] │  │ → postMessage      │
          │                  └──────┬───────┘  │   game_exit        │
          │                         │ tap      └─────────┬──────────┘
          │                         ▼                    ▼
          │           restart from Round 1             exit
          │          (skips Preview + Welcome;
          │           resets gameState; roundIndex=0)
          └─────────────────────────────────────────────────────────────────┘
```

**Shape:** Shape 2 Multi-round.

**Changes from canonical default (per spec `## Flow`):**
1. **No Game Over branch / no lives** — the "wrong AND lives = 0" edge is removed entirely.
2. **No retry loop on wrong** — the wrong-answer path advances to the next round via a CHECK→NEXT button morph (with a brief solution reveal), instead of looping back to the same round.
3. **Submit is an explicit button tap** — CHECK button replaces the implicit "submit" transition; CHECK is disabled until every seat is filled.

**Entry/exit triggers table:**

| Screen | data-phase | Entry trigger | Exit trigger |
|---|---|---|---|
| PreviewScreen (preview state) | `start` | `DOMContentLoaded` → `setupGame()` → `previewScreen.show()` AFTER initial render | skip button OR audio-finish OR fallback → `onComplete` → `startGameAfterPreview()` |
| PreviewScreen (game state / wrapper) | — | `startGameAfterPreview()` | persists for entire session; only `endGame()` calls `previewScreen.destroy()` |
| Round N transition | `round_intro` | before each round (N=1..7) via `transitionScreen.show({ title: 'Round N', … })` | auto-advance after `rounds_sound_effect` completes + ≈900ms |
| Gameplay Round N | `gameplay` | transition auto-complete → `renderRound(roundIndex)` | CHECK tap with all seats filled → validator |
| Inline Feedback (correct) | `gameplay` (inline overlay) | validator returns pass | auto-advance ≈1500ms → next round transition or Victory |
| Inline Feedback (wrong) | `gameplay` (inline overlay) | validator returns fail | NEXT tap OR auto-advance ≈3500ms → next round transition or Victory |
| Victory | `results` | after Round 7 feedback exits AND `roundIndex==6` | "Claim Stars" → Stars Collected; "Play Again" (if stars<3) → Motivation |
| Motivation | `results` (transition) | "Play Again" on Victory stars<3 | "I'm ready! 🙌" → `restartToRound1()` |
| Stars Collected | `results` (transition) | "Claim Stars" on Victory | auto 2500ms → `postMessage({type:'game_exit'})` |

**ProgressBar** (top of game body, below the fixed preview header, owned by ScreenLayout + ProgressBarComponent):
- 7 segments. Advance exactly ONE segment per round on entering Round N+1 (or on transition-to-Victory after Round 7). Never advances mid-round.
- Counter increment convention: `progressBar.update(currentRound, lives=0)` is the FIRST action fired in `round-complete` handler, BEFORE any awaited SFX, per MEMORY.md rule `progress_bar_round_complete`, so the final round Victory does not render `6/7`.
- Persists across rounds. Reset fires ONLY on entering Round 1 of the restart path after Motivation.

---

## 2. Round-by-Round Breakdown

Every round uses Pattern P6 drag-and-drop with check-on-submit. Clue text, pool, seats, and the authoritative solution come from `fallbackContent.rounds[]` in the spec — never hand-invented. Solutions below are copied verbatim from the spec.

| R | Stage/Type | Seats (layout) | Clue count | Pool (chips) | Solution (seat→char) | Primary misconceptions | Target 1st-CHECK rate |
|---|---|---|---|---|---|---|---|
| 1 | S1 / A | 4 (rect-4: 1,2 top; 3,4 bottom) | 2 | 4 (Anu, Ravi, Priya, Meera) | 1:anu, 2:ravi, 3:priya, 4:meera | swap-across-for-next-to, arbitrary-fill | 70–80% |
| 2 | S1 / A | 4 (rect-4) | 3 (adds `same_side`) | 4 (Kiran, Neha, Dev, Sara) | 1:kiran, 2:neha, 3:dev, 4:sara | same-side-as-next-to, across-direction-error | 70–80% |
| 3 | S2 / B | 5 (rect-5-head: 1 head; 2,3 top; 4,5 bottom) | 3 (adds `at_seat`, `between`) | 5 (Tara, Veer, Ishan, Lila, Omar) | 1:tara, 2:veer, 3:ishan, 4:lila, 5:omar | between-as-adjacent-to-one, head-seat-ignored | 55–70% |
| 4 | S2 / B | 5 (rect-5-head) | 4 (adds `left_of`) | 5 (Bela, Chand, Dia, Esh, Farah) | 1:chand, 2:bela, 3:esh, 4:dia, 5:farah | mirror-left-right, across-chained-wrong | 55–70% |
| 5 | S2 / B | 5 (rect-5-head) | 4 (two `between` clues) | 5 (Hari, Ina, Joy, Kabir, Lena) | 1:hari, 2:ina, 3:joy, 4:kabir, 5:lena | between-on-wrong-side, overlook-second-between | 55–70% |
| 6 | S3 / C | 6 (rect-6: 1-3 top, 4-6 bottom) | 4 | 7 (Arjun, Bhavna, Cyrus, Divya, Eshaan, Farida, **Gopal: distractor**) | 1:bhavna, 2:arjun, 3:cyrus, 4:eshaan, 5:divya, 6:farida | seat-every-pool-char, between-ignores-sides, parallel-across-ignored | 45–60% |
| 7 | S3 / C | 6 (rect-6) | 5 (adds `not_next_to` negation) | 7 (Aarav, Brinda, Chetan, Deepa, Ekansh, Fiza, **Gaurav: distractor**) | 1:brinda, 2:aarav, 3:chetan, 4:deepa, 5:fiza, 6:ekansh | seat-every-pool-char, negation-as-positive, ekansh-fiza-swap | 45–60% |

**Adjacency semantics (hard-coded per layout):**

- `rect-4` (Stage 1):
  - next_to: {1-2, 3-4}
  - across: {1-3, 2-4}
  - same_side: top = {1,2}; bottom = {3,4}
- `rect-5-head` (Stage 2): seat 1 is the head (short end, top); seats 2,3 top long side (2 near head, 3 far); seats 4,5 bottom long side (4 near head, 5 far).
  - next_to: {1-2, 1-4, 2-3, 4-5}
  - across: {2-4, 3-5}; seat 1 (head) has NO across partner.
  - same_side: top={2,3}; bottom={4,5}; head={1}.
  - left_of / right_of: "X is on the left of Y" = X is immediately to screen-left of Y (spec standardizes on student's-left). For rect-5-head this resolves pairwise: (2 is left_of 1), (1 is left_of 4) does NOT apply because the head is above; only resolve within the same row. On the top row, (2 left_of 3); on the bottom row, (4 left_of 5). (Head seat appears above; left_of involving seat 1 is only satisfied if seat 1 is the Y and X is seat 2 — i.e., "seat 2 is left of seat 1" on screen.) Planner note: the spec's Round 4 clue "Bela sits on the left of Chand" with Chand at seat 1 (head) and Bela at seat 2 matches this rule.
- `rect-6` (Stage 3):
  - next_to: {1-2, 2-3, 4-5, 5-6} — same side only. 1-4, 2-5, 3-6 are across, NOT next to.
  - across: {1-4, 2-5, 3-6}
  - same_side: top={1,2,3}; bottom={4,5,6}.
  - left_of: top row (1 left_of 2, 2 left_of 3); bottom row (4 left_of 5, 5 left_of 6).

**Clue-type → validator function (pure, idempotent):**

| Clue type | Satisfied when |
|---|---|
| `at_seat(char, seatId)` | `seatMap[seatId] === char` |
| `next_to(a, b)` | `{seatOf(a), seatOf(b)}` is in the layout's next_to set |
| `across_from(a, b)` | `{seatOf(a), seatOf(b)}` is in the layout's across set (seat 1 head cannot participate) |
| `same_side(a, b)` | `sideOf(a) === sideOf(b)` |
| `left_of(a, b)` | `seatOf(a)` is immediately left of `seatOf(b)` on the same row |
| `between(x, y, z)` | `seatOf(x)` is adjacent (next_to) to BOTH `seatOf(y)` AND `seatOf(z)` |
| `not_next_to(a, b)` | `{seatOf(a), seatOf(b)}` is NOT in the next_to set |

**Conflict-seat derivation (drives red highlighting on wrong CHECK):**

- For each violated clue, add all seat-IDs of every character named in that clue's `args` to the `conflictSet`.
- Special case for distractor rounds: if a `distractor:true` character is seated at `s`, add `s` AND the seat of the displaced valid character (the valid character now in the pool but named in some clue) to `conflictSet`.
- Seats not in `conflictSet` stay neutral (grey) — NOT red. This is the signal to the student about which seats to reconsider.

---

## 3. Drag-and-Drop Interaction Logic (Pattern P6)

**Drag sources:** character chip in pool OR character chip currently seated.
**Drag targets:** any numbered seat (empty OR occupied).

**Invariant (P6 R2 `tagSource` discipline):** every chip carries `tagSource = 'pool' | seatId` so replace/evict logic can restore correctly across bank→seat, seat→seat, seat→pool transitions.

**Drag start**
- From pool: `pointerdown`/`touchstart` on a pool chip → `dragState = { chipId, source: 'pool', offset }`. Chip lifts (scale 1.06, soft drop-shadow). Pool slot dims.
- From seat: `pointerdown` on a seated chip → `dragState = { chipId, source: <seatId> }`. Seat clears (chip detaches into drag layer). The seat's "empty" visual returns immediately.
- Use Pointer Events with `setPointerCapture` on `pointerdown`; `touch-action: none` on every chip and seat.

**Drag over (live hover)**
- Each `pointermove` computes the hit seat via `elementsFromPoint` filtered by `.seat`.
- If hovering a seat: seat border highlights in primary color. No audio.
- If hovering OUTSIDE the table: no highlight, no ghost.

**Drop — onto empty seat**
- Snap chip into seat (150ms transform).
- `seatMap[seatId] = chipId`; remove chip from pool OR clear origin seat based on `dragState.source`.
- Fire-and-forget snap SFX: `FeedbackManager.sound.play('snap').catch(function(){})`.
- Recompute `isBoardFull`; enable CHECK button if true.
- `recordAttempt` is NOT fired on per-drop; only on CHECK. Per-drop telemetry is captured in the rolling `gameState.dropLog[]` and flushed into the CHECK `recordAttempt` payload.

**Drop — onto occupied seat (swap/evict)**
- The prior occupant animates back to the pool (300ms ease-out to its slot or the end of the pool row; pool reflow if necessary). If the drag source was `'pool'`: new chip lands in seat, old occupant fills pool.
- If the drag source was `seatId_src` (seat→seat): prior occupant of the target seat is moved to `seatId_src` (swap), not the pool. `tagSource` bookkeeping: dragged chip's new `tagSource = targetSeatId`; swapped chip's `tagSource = seatId_src`.
- Snap SFX (fire-and-forget).
- Board-full state unchanged (pool->seat swap keeps count stable; seat->seat swap likewise).

**Drop — from seat back to pool**
- Drop the chip on the pool region (or release outside the table).
- Chip returns to pool (soft deselect SFX fire-and-forget).
- Seat cleared. CHECK disables if any seat empty.

**Drop — cancelled (released outside any valid target)**
- If source was pool: chip returns to its pool slot (no SFX, no state change).
- If source was seat: chip returns to its origin seat (P6 R4 "snap-back to origin").
- No `recordAttempt`, no drop-log entry.

**Touch + mouse parity**
- Pointer Events (`pointerdown`/`move`/`up`/`cancel`) with `element.setPointerCapture(event.pointerId)` on `pointerdown`.
- `touch-action: none` on chips, seats, and the pool container.
- Minimum touch target: 44×44 CSS px per chip and per seat on 375px viewport.

---

## 4. State Machine

**gameState shape:**

```
gameState = {
  phase: 'start' | 'round_intro' | 'gameplay' | 'feedback_correct' | 'feedback_wrong' | 'round_complete' | 'results',
  roundIndex: 0..6,                          // 0-based
  round: {                                   // snapshot of current round from content[]
    round, stage, type, layout, seats, pool, clues, solution, misconception_tags
  },
  seatMap: { [seatId:number]: chipId|null }, // current board state
  poolChips: [chipId, ...],                   // chips still in pool (order preserved per spec; chip order randomized at round-start but clue names stable)
  isBoardFull: boolean,
  validationResult: null | { pass: bool, violatedClueIds: [], conflictSeats: [] },
  isProcessing: boolean,                      // set BEFORE any await (blocks drag + CHECK)
  firstCheckSolves: 0..7,                      // feeds stars
  attempts: [],                                // buffered for recordAttempt per round
  dropLog: [ { ts, chipId, src, dst, action: 'place'|'swap'|'evict'|'cancel' } ],
  roundsCompleted: 0..7,
  startTime: null | ms,
  isActive: false | true,
  duration_data: { preview: [], startTime: ISO }
}
```

**Phase transitions:**

| From | Event | To | Side effects |
|---|---|---|---|
| `start` | `DOMContentLoaded` | preview (component state) | `setupGame()` injects layout, renders Round 1 scaffold, `previewScreen.show()` |
| `start` | preview `onComplete` | `round_intro` | `startGameAfterPreview()`: set `startTime`, `isActive=true`, show Round 1 transition |
| `round_intro` | rounds SFX finishes (or CTA) | `gameplay` | `renderRound(roundIndex)` — reset `seatMap`, `poolChips`, `isBoardFull`, `dropLog`, `isProcessing=false`; `syncDOMState()` |
| `gameplay` | valid drop | `gameplay` | update `seatMap`/`poolChips`; recompute `isBoardFull`; append `dropLog` |
| `gameplay` | tap CHECK (isBoardFull) | `feedback_correct` OR `feedback_wrong` | `isProcessing=true` (BEFORE any await); run validator; `recordAttempt(...)` BEFORE audio |
| `feedback_correct` | after awaited SFX + ≈1500ms | `round_complete` | `firstCheckSolves += 1`, `roundsCompleted += 1`, `progressBar.update(…)` FIRST, then SFX sequence |
| `feedback_wrong` | CHECK→NEXT morph + ≈1500ms | (inline) solution-reveal animation | slide characters into `solution` seats, keep `feedback_wrong` phase |
| `feedback_wrong` | NEXT tap OR auto ≈3500ms | `round_complete` | `roundsCompleted += 1`, `progressBar.update(…)` FIRST |
| `round_complete` | (roundIndex < 6) | `round_intro` | `roundIndex += 1`, show "Round N" transition |
| `round_complete` | (roundIndex === 6) | `results` | compute stars, render Victory, fire `game_complete` BEFORE audio |
| `results` | "Claim Stars" | (transition screen: stars_collected) | auto 2500ms → `postMessage({type:'game_exit'})` |
| `results` | "Play Again" (stars<3) | (transition screen: motivation) | "I'm ready!" → `restartToRound1()` |
| `motivation` | "I'm ready!" | `round_intro` (Round 1) | reset gameState except `duration_data`; `roundIndex=0`, `firstCheckSolves=0`, `roundsCompleted=0`; skip Preview + Welcome |

**Validator (canonical pure function):**

```
function validate(seatMap, clues, pool, layout):
  conflictSeats = Set()
  violated = []
  for clue in clues:
    if NOT satisfies(clue, seatMap, layout):
      violated.push(clue.id)
      for characterId in clue.args.filter(isCharId):  // args may mix chipId + seatId
        s = seatOfChip(seatMap, characterId)
        if s != null: conflictSeats.add(s)
  // Distractor special-case: any seated chip with distractor:true → add that seat
  // AND the seat of the displaced clue-character who remains in the pool.
  for chipId, seatId in seatMap:
    chip = poolDef.find(chipId)
    if chip.distractor:
      conflictSeats.add(seatId)
      // the displaced clue-character whose absence caused a clue to fail is already
      // captured via the violated-clue loop above; this guards the general case.
  return { pass: violated.length === 0, violatedClueIds: violated, conflictSeats: Array.from(conflictSeats) }
```

Validator is deterministic, idempotent, and NEVER mutates `seatMap`.

---

## 5. Scoring & Progression Logic

- **Points:** `+1` per round solved on FIRST CHECK (`validationResult.pass === true`). Max 7.
- **Lives:** None. No game-over screen exists; `gameState.lives` not maintained.
- **Timer:** None. `previewScreen.show()` passes `timerConfig: null, timerInstance: null`.
- **Star rating** (computed once on transition to `results`, from `firstCheckSolves`, matching spec):
  - **3★** = `firstCheckSolves >= 6` (i.e., 6 or 7 rounds)
  - **2★** = `firstCheckSolves >= 4` (i.e., 4 or 5)
  - **1★** = `firstCheckSolves >= 1` (i.e., 1–3)
  - **0★** = `firstCheckSolves === 0` (still reaches Victory; renders 0 filled stars)
- **ProgressBar:**
  - 7 discrete segments.
  - `progressBar.update(roundsCompleted, 0)` called as the FIRST action in the `round_complete` handler (MEMORY.md: `progress_bar_round_complete`).
  - Completed segments persist across rounds; reset ONLY on restart-from-Round-1 after Motivation.
- **Victory subtitle** (game-specific per default-transition-screens §3, spec-driven copy):
  - `"You solved ${firstCheckSolves} of 7 on the first try!"` — the only dynamic Victory string.

---

## 6. Feedback Patterns

Cross-reference: `alfred/skills/feedback/SKILL.md` 17 behavioral cases + await/fire-and-forget priority table. Bloom L4 → context-aware TTS on CHECK resolution; per-drop audio is silent-or-fire-and-forget.

| Event | Trigger | FeedbackManager call | Subtitle | Blocks input? | Await? | After |
|---|---|---|---|---|---|---|
| Chip picked up | `pointerdown` on pool/seat chip | — (no audio) | — | No | — | chip floats, border highlights on hover |
| Chip hovers seat | `pointermove` over `.seat` | — | — | No | — | seat border primary color |
| Drop on empty seat | valid drop | `FeedbackManager.sound.play('snap').catch(…)` | — | No | No (FAF) | chip snaps, CHECK enables if full |
| Drop on occupied seat | valid drop to occupied | `FeedbackManager.sound.play('snap').catch(…)` | — | No | No (FAF) | prior occupant animates to pool/origin |
| Drop cancelled | release outside target | — | — | No | — | chip returns to source |
| Drag from seat back to pool | drop in pool region | `FeedbackManager.sound.play('soft_deselect').catch(…)` (fallback: reuse 'snap' if unavailable) | — | No | No (FAF) | seat cleared, CHECK disables |
| Round N intro | transition mount | `await FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_ROUNDS })` | (no dynamic TTS for intro) | No CTA | Yes (sequential) | auto-advance to gameplay |
| CHECK correct | `pass=true` | `isProcessing=true` → seats flash green 400ms → `await FeedbackManager.sound.play('correct_sound_effect', { sticker: STICKER_CELEBRATE })` → `FeedbackManager.playDynamicFeedback({ audio_content: correctLine, subtitle: correctLine, sticker: STICKER_CELEBRATE }).catch(function(){})` | "Great thinking! You matched every clue." (context-aware variants in Examples below) | Yes | Yes (SFX) + FAF (TTS) | auto-advance after ≈1500ms |
| CHECK wrong | `pass=false` | `isProcessing=true` → conflict seats red 400ms → `await FeedbackManager.sound.play('incorrect_sound_effect', { sticker: STICKER_SAD })` → `FeedbackManager.playDynamicFeedback({ audio_content: wrongLine, subtitle: wrongLine, sticker: STICKER_SAD }).catch(…)` → CHECK button morphs to NEXT | "Oh no! That's not right!" (matches source-concept copy) | Yes | Yes (SFX) + FAF (TTS) | after ≈1500ms: solution reveal; NEXT interruptible |
| Solution reveal | `feedback_wrong` + ≈1500ms | — (silent; optional soft whoosh FAF) | — | Yes (still) | — | characters slide into `solution` seats over 800ms; NEXT remains visible |
| NEXT tapped | button tap | `FeedbackManager.sound.stopAll()` | — | — | — | transition to Round N+1 intro OR Victory |
| Round complete (correct or wrong+next) | entering `round_complete` | `progressBar.update(roundsCompleted, 0)` FIRST, then continue audio sequence | — | — | — | next round or Victory |
| Victory | all 7 rounds done | Render screen FIRST → `game_complete` postMessage → `await FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE })` → `await FeedbackManager.playDynamicFeedback({ audio_content: victoryVO, subtitle: victoryVO, sticker: STICKER_CELEBRATE })` | "You solved X of 7 on the first try!" | CTA visible | Yes (sequential, CTA interrupts via `stopAll`) | CTA tap → Motivation or Stars Collected |
| Visibility hidden | `visibilitychange` | `VisibilityTracker` handles pause overlay + `pauseAll()` | — | — | — | overlay shown by VisibilityTracker PopupComponent, not custom (MEMORY.md: `feedback_pause_overlay`) |
| Visibility restored | `visibilitychange` | `VisibilityTracker.resume()` | — | — | — | state continues |

**Subtitle examples (3 per type):**

- Correct (round 1): "Anu sits next to Ravi, and Priya is across from Anu — every clue matches!"
- Correct (round 5): "Ina is between Hari and Joy, and Kabir is between Hari and Lena. Both betweens work!"
- Correct (round 7): "All five clues hold — including the tricky 'NOT next to Deepa'!"

- Wrong (round 2): "Oh no! That's not right — check who sits on the same side."
- Wrong (round 4): "Oh no! That's not right — remember 'left of' means screen-left."
- Wrong (round 6): "Oh no! That's not right — one character in the pool shouldn't be seated at all."

**Animations:**

| Animation | Trigger | CSS class | Duration |
|---|---|---|---|
| Chip lift on pickup | pointerdown | `.chip-lift` | 120ms ease |
| Seat hover highlight | pointermove over seat | `.seat-hover` | — (hold) |
| Chip snap into seat | valid drop | `.chip-snap` | 150ms ease-out |
| Eviction to pool | swap on occupied seat | `.chip-evict` | 300ms ease-out |
| Seat success flash | CHECK pass | `.seat-success` (green) | 400ms |
| Seat conflict flash | CHECK fail | `.seat-conflict` (red) | 400ms repeat 2x (800ms total) |
| Solution reveal slide | `feedback_wrong`+1500ms | `.chip-solution-slide` | 800ms stagger 80ms/chip |
| CHECK→NEXT morph | CHECK fail | `.button-morph` | 250ms (bg + label crossfade) |
| Fade-in new round | `renderRound` | `.fade-in` | 350ms |

**Wrong Answer Handling:**

- Show correct arrangement: ALWAYS (after ≈1500ms, via slide animation) — this is the scaffold replacing the usual retry-once.
- Misconception-specific TTS: NO in v1 — generic "Oh no! That's not right!" per spec (matches source concept). Misconception tags are still captured in `recordAttempt.misconception` payload based on `violatedClueIds` + pool state, so analytics can distinguish "one clue off" from "random fill".
- No failure-recovery softening (no retry loop; advances regardless).

**Emotional Arc Notes:**

- L4 Analyze: tone is encouraging-but-matter-of-fact. Avoid over-celebrating single-clue satisfactions; only cheer on full-board correctness.
- Wrong feedback is brief (~1s SFX + subtitle) to avoid dragging out failure; solution reveal is the real teaching moment.
- Victory subtitle leans on "first-try solves" rather than percentage — matches spec's star thresholds and honours that wrong rounds still completed the game.

---

## 7. Platform Integration Checklist

- `ScreenLayout.inject('app', { slots: { previewScreen: true, transitionScreen: true, progressBar: true } })` called once at `setupGame()` start.
- `previewScreen.show()` called at end of `setupGame()` AFTER the Round 1 scaffold (clue panel + table + pool) is rendered in the background. `timerConfig: null, timerInstance: null`. `previewInstruction` and `previewAudioText` come from `fallbackContent` (spec §Content Structure).
- `endGame()` calls `previewScreen.destroy()` exactly once.
- `restartToRound1()` (from Motivation) does NOT re-call `previewScreen.show()` per canonical default.
- `VisibilityTracker` wired to `previewScreen.pause()` / `resume()`; the pause overlay is owned by VisibilityTracker's PopupComponent — never authored as a custom div (MEMORY.md: `feedback_pause_overlay`).
- `TimerComponent`: NOT used (`timer === null`). Do not mount `#timer-container`.
- `progressBar`: single instance mounted in the ScreenLayout progress-bar slot. Updated via `progressBar.update(roundsCompleted, 0)` as the FIRST action in the round-complete handler (MEMORY.md: `progress_bar_round_complete`).
- `FeedbackManager` handles ALL audio — no raw `new Audio()`. Preload `snap`, `soft_deselect`, `correct_sound_effect`, `incorrect_sound_effect`, `rounds_sound_effect`, `sound_game_victory`, `sound_stars_collected`, `sound_motivation` at `setupGame()`.
- `syncDOMState()` on every phase transition — `data-phase`, `data-round-index`, `data-stars` always reflect current state.
- **`recordAttempt` per CHECK** (once per round, regardless of pass/fail):
  - Correct: `{ pass: true, roundId: round, type, seats: seatMap, clueCount, droppedCount: dropLog.length, firstCheck: true }`
  - Wrong: `{ pass: false, roundId: round, type, seats: seatMap, violatedClueIds, conflictSeats, distractorSeated: bool, misconception: <tag> }`
  - `misconception` derived by: (a) if a distractor is seated → `seat-every-pool-char`; (b) elif only `between` clues violated → `between-*` subtag; (c) elif `not_next_to` in violated → `negation-as-positive`; (d) elif only `across_from` violated → `across-direction-error` / `swap-across-for-next-to`; (e) elif only `same_side` violated → `same-side-as-next-to`; (f) else → `arbitrary-fill` (round 1 specifically) / first violated clue's tag.
  - Tags come from each round's `misconception_tags` map in the spec.
- **`game_complete` fires exactly once** on transition to `results`, BEFORE victory audio, with schema:
  ```
  { score: firstCheckSolves, totalQuestions: 7, stars, accuracy: round((firstCheckSolves/7)*100), timeSpent: Date.now() - startTime, attempts, duration_data }
  ```
- **TransitionScreen usage** (`transitionScreen.show({...})` — exact contract per `default-transition-screens.md`):
  - **Round N intro** (custom, per canonical Round-N in default-flow): `{ title: 'Round N', subtitle: undefined, icons: [STICKER_ROUNDS_EMOJI_OR_ID], buttons: [], onMounted: () => FeedbackManager.sound.play('rounds_sound_effect', { sticker: STICKER_ROUNDS }), persist: false }`. Auto-advance via a timer in onMounted resolve.
  - **Victory**: `{ title: 'Victory 🎉', subtitle: \`You solved ${firstCheckSolves} of 7 on the first try!\`, stars: gameState.stars, buttons: (stars===3 ? [{text:'Claim Stars', type:'primary', action: showStarsCollected}] : [{text:'Play Again', type:'secondary', action: showMotivation},{text:'Claim Stars', type:'primary', action: showStarsCollected}]), persist: true, onMounted: () => FeedbackManager.sound.play('sound_game_victory', { sticker: STICKER_CELEBRATE }) }`. **Do NOT pass `icons` on Victory** (conflicts with `stars`, per default-transition-screens §Conflicts).
  - **Motivation**: `{ title: "Ready to improve your score? ⚡", buttons: [{text:"I'm ready! 🙌", type:'primary', action: restartToRound1}], persist: true, onMounted: () => FeedbackManager.sound.play('sound_motivation', { sticker: STICKER_MOTIVATE }) }`.
  - **Stars Collected**: `{ title: "Yay! 🎉\nStars collected!", duration: 2500, styles: { title: { whiteSpace: 'pre-line', lineHeight: '1.3' } }, onMounted: () => FeedbackManager.sound.play('sound_stars_collected', { sticker: STICKER_CELEBRATE } ) }`. On hide: `window.parent.postMessage({type:'game_exit'}, '*')`.
  - **Game Over**: NOT IMPLEMENTED (no lives).
- `data-testid` attributes required on: every seat (`seat-<id>`), every pool chip (`chip-<id>`), every seated chip (`seated-<seatId>-<chipId>`), CHECK button (`btn-check`), NEXT button (`btn-next`), progress segment (`progress-seg-<i>`), clue panel item (`clue-<id>`), Victory "Claim Stars" (`claim-stars`), Motivation "I'm ready!" (`im-ready`).

---

## 8. Screens (ASCII wireframes, 375x667 mobile)

### 8.1 PreviewScreen (data-phase="start", component state = preview)

```
+-------------------------------------+
|  [avatar]  Logic Seating Puzzle     |  <- persistent preview header
|                         0 / 7  ★ 0  |
+-------------------------------------+
|                                     |
|      ┌──────────────────────────┐   |
|      │  Seat everyone at the    │   |
|      │  table!                  │   |
|      │  Drag each character     │   |
|      │  into a seat so every    │   |
|      │  clue is true.           │   |
|      │  Tap CHECK when done.    │   |
|      └──────────────────────────┘   |
|                                     |
|            [ ▶ Skip ]               |
+-------------------------------------+
```

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Instruction HTML | center | `<p><b>Seat everyone at the table!</b><br>Drag each character into a seat so every clue is true. Tap <b>CHECK</b> when you are done.</p>` | no |
| Audio | (auto, onMounted) | previewAudioText | no |
| Skip CTA | bottom | "Skip" → `onComplete` | tap |

Entry: `DOMContentLoaded`. Exit: skip OR audio-end.

### 8.2 Round N intro (TransitionScreen, data-phase="round_intro")

```
+-------------------------------------+
|  [header] 0/7  ★ 0                  |
+-------------------------------------+
|  [progress: [0/7 filled=0]]         |
+-------------------------------------+
|                                     |
|              [🧠]                    |
|                                     |
|           Round N                   |
|                                     |
|        (auto-advance)               |
|                                     |
+-------------------------------------+
```

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | (N-1)/7 filled | no |
| Sticker / Icon | top-center | `STICKER_ROUNDS` | no |
| Title | center | "Round N" (N=1..7) | no |
| Audio | (auto, onMounted) | `rounds_sound_effect` + `STICKER_ROUNDS` | no |

Entry: before each round. Exit: SFX complete + ≈900ms → auto-advance to `gameplay`.

### 8.3 Gameplay (data-phase="gameplay")

(Round 3 shown — rect-5-head layout; other rounds differ in seat count + pool size.)

```
+-------------------------------------+
|  [header] Round 3/7  ★ 0            |
+-------------------------------------+
|  [progress: ▓▓░░░░░ 2/7]            |
+-------------------------------------+
|  ┌─── Clues ────────────────────┐   |
|  │ 1. Tara sits at the head.    │   |
|  │ 2. Veer is between Tara      │   |
|  │    and Ishan.                │   |
|  │ 3. Lila sits across from Veer│   |
|  └──────────────────────────────┘   |
|                                     |
|        ┌────── [1 head] ─────┐      |
|        │                     │      |
|   [2]──┤                     ├──[3] |
|        │     (table top-     │      |
|        │      down view)     │      |
|   [4]──┤                     ├──[5] |
|        └─────────────────────┘      |
|                                     |
|  Pool:  [Tara][Veer][Ishan][Lila]   |
|         [Omar]                      |
|                                     |
|        [  CHECK  (disabled)  ]      |
+-------------------------------------+
```

(Layout differs per round: rect-4 = 2+2 seats; rect-5-head = 1 head + 2+2; rect-6 = 3+3.)

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | `roundsCompleted/7` | no |
| Clue panel | upper third | 2–5 clue lines from `round.clues[*].text` | no |
| Table diagram | center | numbered seats per `round.seats` | drop target (every seat) |
| Pool area | below table | `poolChips` chips with avatar + name | drag source |
| CHECK button | bottom | "CHECK" (disabled until `isBoardFull`) | tap when enabled |
| NEXT button | bottom (morph of CHECK on wrong) | "NEXT" | tap |

Entry: Round N intro auto-complete. Exit: CHECK tap → validator → feedback.

### 8.4 Victory (data-phase="results", TransitionScreen)

```
+-------------------------------------+
|  [header] 7/7  ★ 3                  |
+-------------------------------------+
|  [progress: ▓▓▓▓▓▓▓ 7/7]            |
+-------------------------------------+
|                                     |
|         ★   ★   ★                   |
|                                     |
|         Victory 🎉                  |
|  You solved 7 of 7 on the first try!|
|                                     |
|   [ Play Again ]  [ Claim Stars ]   |  <- Play Again only if stars<3
|                                     |
+-------------------------------------+
```

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | 7/7 filled | no |
| Stars row | upper center | `gameState.stars` filled stars | no |
| Title | center | `"Victory 🎉"` | no |
| Subtitle | center | `"You solved X of 7 on the first try!"` | no |
| Audio | (auto, onMounted) | `sound_game_victory` + `STICKER_CELEBRATE` | no |
| CTA 1 (conditional) | bottom | `"Play Again"` → motivation (only if `stars < 3`) | tap |
| CTA 2 | bottom | `"Claim Stars"` → stars_collected | tap |

Entry: after Round 7 feedback. Exit: Claim Stars → Stars Collected; Play Again → Motivation.

### 8.5 Motivation (data-phase="results", TransitionScreen)

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Progress bar | below header | preserved (previous firstCheckSolves/7) | no |
| Title | center | `"Ready to improve your score? ⚡"` | no |
| Audio | (auto, onMounted) | `sound_motivation` + `STICKER_MOTIVATE` | no |
| CTA 1 | bottom | `"I'm ready! 🙌"` → `restartToRound1` | tap |

### 8.6 Stars Collected (data-phase="results", TransitionScreen)

| Element | Position | Content | Interactive? |
|---|---|---|---|
| Preview header | top, fixed | persistent fixture | no |
| Title | center | `"Yay! 🎉\nStars collected!"` (pre-line styles) | no |
| Audio | (auto, onMounted) | `sound_stars_collected` + `STICKER_CELEBRATE` | no |
| Duration | auto-hide | 2500ms | — |
| After hide | — | `window.parent.postMessage({type:'game_exit'}, '*')` | — |

### 8.7 Game Over

NOT USED in this game (lives = 0, no game-over branch per spec `## Flow` delta 1).

---

## 9. Round Presentation Sequence (within gameplay screen)

Every round follows:
1. **Question preview** — clue panel + table seats + pool chips render (fade-in 350ms). CHECK button disabled.
2. **Instructions** — NOT repeated on gameplay. The how-to-play copy is owned by PreviewScreen (`previewInstruction` + `previewAudioText`) and shown once before Round 1. A per-round prompt is NOT introduced because clues ARE the prompt. Round-type changes (Stage 1→2→3 seat-count jump, and distractor introduction at Round 6) are conveyed via the Round-N intro transition — NOT an injected banner.
3. **Media** — none.
4. **Gameplay reveal** — chips become draggable; input unblocks (`isProcessing = false`); dropLog begins.

---

## 10. Spec Ambiguities Resolved (sensible defaults, flagged)

The spec flags several DECISION-POINTs. Planner resolutions for unblocking generation (Education slot may override before approval):

| Ambiguity (spec) | Planner default | Rationale |
|---|---|---|
| Grade level (4–6) | Design for Class 5 median; keep L4 content | Spec already constrains clue count per stage; no code change needed |
| Round count (concept silent; 9 for MCQ, 3 for Board) | **7** (2+3+2) | Per spec; ≈12 min session |
| Lives & retry on wrong | **0 lives, CHECK→NEXT, no retry** | Matches source concept; diverges from L4 norm. Documented in §1 flow deltas + §6 feedback |
| Distractor placement | **Stage 3 only (R6–7)** | Matches spec content array; scaffolds difficulty |
| Left/right semantics (top-down view) | **Student's-left (screen-left)** | Per spec §Warnings; standardized across all rounds. Preview copy does NOT need to state this explicitly in v1 — clues are phrased to be unambiguous in context |
| Head-of-table "across" | **Seat 1 (head) has NO across partner** | No clue in spec uses `across_from` with seat 1; validator treats any such clue as unsatisfiable (defensive) |
| CHECK enablement | **All seats filled** | Per spec — no partial-submit telemetry v1 |
| Stage 2 chair shape | **Rectangular with head seat** (not round table) | Per spec DECISION-POINT resolution in §Rounds Stage 2 |
| Solution reveal duration after wrong CHECK | **≈1500ms pre-reveal delay, 800ms slide, NEXT interruptible** | Gives student time to register "wrong" before seeing answer |
| Auto-advance after wrong when NEXT not tapped | **≈3500ms total** | Spec says NEXT tappable "at any time"; fallback auto-advance prevents stuck screens |
| Pool chip order randomization | **Shuffle at round-start** per spec §Warnings | Tests use `chipId`, never pool index |

---

## 11. Cross-Validation (Step 7)

- Every screen in §1 has a wireframe in §8: PreviewScreen, Round-N intro, Gameplay, Victory, Motivation, Stars Collected. Game Over intentionally absent (no lives).
- Every feedback moment in §6 corresponds to a step in §4 phase transitions.
- `firstCheckSolves` is the single scoring source: incremented in `feedback_correct` handler; never touched in `feedback_wrong`. Stars map (§5) is a pure function of `firstCheckSolves`.
- `progressBar.update` is called FIRST in `round_complete` handler (§4, §5) — per MEMORY.md rule.
- `recordAttempt` fires exactly once per round, on CHECK, with pass/fail payload (§7) — matches spec §Feedback.
- `game_complete` fires exactly once, BEFORE victory audio, on transition to `results` (§4, §7) — matches default-flow canonical order.
- Transition screens (Victory / Motivation / Stars Collected) match the verbatim Elements tables from `reference/default-transition-screens.md`, with the single allowed override: Victory's game-specific subtitle.
