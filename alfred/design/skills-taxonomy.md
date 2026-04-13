# Pipeline Skills

What the pipeline must know how to do to reliably produce a working game every time.

---

## Derivation

A game is nine things. If you have all nine, you have a complete game. If any is missing, you have a bug class.

1. **Pattern** — the structural skeleton (how the game is organized)
2. **Interaction** — how the student acts (the verbs)
3. **Presentation** — what the student sees (the nouns)
4. **Platform** — how the game talks to the system (the wiring)
5. **Content** — what's being taught (the material)
6. **Device** — the hardware and browser it runs on
7. **Deployment** — how it reaches the student
8. **Experience** — how it feels to play (onboarding, motivation, emotional safety, language)
9. **Data** — what the system learns from each play session

Each of these has sub-skills. The sub-skills are exhaustive within their domain — proved by: if you follow all sub-skills, a working game MUST result for that domain; if any sub-skill is missing, there exists a game that breaks.

Review status: reviewed 2026-04-06 by 10 personas (Game Creator, Platform Engineer, QA, Student, Data Analyst, Systems Architect, CEO, Pedagogy Expert, Experience Designer, Game Designer). See `reviews/skills-review.md` for full findings.

---

## Creator Decision Defaults

When the creator's spec doesn't specify a decision, the pipeline must assume a default. Without defaults, output is a random function of LLM temperature.

| Decision | Default when unspecified | Validation |
|----------|------------------------|------------|
| Game structure | Rounds-based | Check spec for timer/lives/story keywords |
| Interaction type | MCQ (single) | Check spec for drag/type/match keywords |
| Scoring | +1 per correct, stars at 90/66/33% | Check if spec defines custom formula |
| Difficulty curve | 3 equal stages (easy/medium/hard) | Check if spec defines explicit stages |
| Rounds | 9 (3 per stage) | Check content set length |
| Lives | 3 (lives-based) or 0 (no-penalty learning) | Infer from Bloom level: L1-L2 = no penalty, L3+ = lives |
| Timer | None | Check spec for time/countdown keywords |
| Feedback style | playDynamicFeedback('correct'/'incorrect') | Always use FeedbackManager when PART-017=YES |
| Content | fallbackContent | Schema-validate injected content |
| Bloom level | L2 Understand | Check spec for Bloom keywords |
| Language | English | Check spec for language/Hindi keywords |
| Accessibility | Touch-only, 44px targets, contrast only | No further accessibility unless specified |
| Scaffolding | Show correct answer after wrong, auto-advance | Check spec for hint/retry keywords |

**Questions:**

- Are these defaults correct? Which need adjustment?
- Should the pipeline flag when it's using a default (so the creator knows)?
- Which defaults are dangerous (could produce a wrong game if the spec intended something else)?

---

## Skill Dependencies (DAG)

Skills have dependencies — some must succeed before others can begin. Without this ordering, the doc is a checklist not an architecture.

```
7.1 Upload/registration (CDN packages available)
 └→ 4.1 CDN package loading
     └→ 4.2 Initialization sequence
         ├→ 4.3 State management (gameState)
         │   ├→ 4.4 Communication protocol (postMessage)
         │   ├→ 4.5 Data capture (recordAttempt)
         │   └→ 1.2 Screen state machine (phase transitions)
         │       ├→ 1.3 Round progression
         │       │   └→ 1.4 End conditions
         │       │       └→ 1.5 Replay cleanup
         │       └→ 3.4 Screen transitions
         ├→ 4.7 Visibility tracking
         ├→ 4.8 Timer (if PART-006)
         └→ 3.3 Feedback presentation (FeedbackManager)

Independent (can be verified at any point):
 - 1.1 Game structure type (spec-time)
 - 1.6 Scaffolding (spec-time)
 - 2.1-2.3 Interaction (build-time)
 - 3.1-3.2 Layout and UI rules (build-time)
 - 5.1-5.4 Content (spec-time + build-time)
 - 6.1-6.4 Device (test-time)
 - 7.2-7.3 Health check, versioning (deploy-time)
 - 8.1-8.7 Experience (review-time)
 - 9.1-9.4 Data (build-time + test-time)
```

**Critical path:** 7.1 → 4.1 → 4.2 → 4.3 → 4.4 → game_complete. If any link fails, no data reaches the platform.

**Questions:**

- Is this DAG complete? Are there other dependency edges?
- Which skills can be parallelized? (e.g., content validation + CDN loading)
- Which dependency failures are recoverable vs fatal?

---

## 1. Pattern

The structural skeleton of the game. What kind of game is it, how is it organized, what ends it.

### 1.1 Game structure type

The pipeline must know which structure this game uses and generate the corresponding skeleton.

**Known structures:**

| Structure | Description | Examples |
|-----------|-------------|----------|
| Rounds-based | Fixed N rounds, sequential, score at end | Most games (9-round trig, 5-round stats) |
| Timed | Countdown clock, answer before time runs out | count-and-tap, rapid-challenge |
| Lives-based | Wrong answers cost lives, game over at 0 | find-triangle-side, right-triangle-area |
| Timed + lives | Both timer and lives | stats-mean-direct (45s timer + lives) |
| No-penalty learning | Wrong answers noted but no lives lost, no game-over | which-ratio, name-the-sides, geo-angle-id |
| Worked example | Example → faded → practice phases, not rounds | soh-cah-toa-worked-example |
| Story-only | Narrative, no validation, auto-completes (PART-029) | None approved yet |
| Exploration | No rounds, no timer, no lives, free interaction | None approved yet |
| Puzzle/board | Single state to solve, no sequential rounds — the whole board IS the round | queens-puzzle, math-cross-grid, expression-completer |
| Endless/speed-run | No fixed round count, keep going until timer expires or lives run out | addition-mcq-blitz (timed variant) |

**Questions:**

- Is this list complete? What structure would a new game use that doesn't fit any of these?
- Can structures combine? (e.g., rounds + timed + lives) What are the valid combinations?
- Does each structure imply a different screen set? (e.g., lives-based needs game_over screen, no-penalty doesn't)
- What is the default structure when the game description doesn't specify?
- For puzzle/board: how does the pipeline know the puzzle is "solved"? What's the screen state machine when there are no rounds?
- For endless: when does game_complete fire? On timer expiry? On lives exhausted? On voluntary quit?

### 1.2 Screen state machine

Every game is a set of screens with transitions. The pipeline must produce a state machine with no dead ends and no unreachable states.

**Universal screens:**

| Screen | Required? | Enters from | Exits to |
|--------|-----------|-------------|----------|
| start | Always | page load | gameplay |
| gameplay | Always | start, restart | results, game_over, next round |
| results | Always | final round complete | start (replay) |
| game_over | If lives-based | lives = 0 | start (replay) |
| transition | Optional | round end | next round |

**Questions:**

- Are there screens beyond these five that any game needs?
- What happens if the student refreshes mid-gameplay? Which screen do they land on?
- Can a game have conditional screens (e.g., "hint screen" that only appears sometimes)?
- What's the exact transition trigger for each edge? Tap? Timer? Auto-advance? How long?

### 1.3 Round progression

How the game moves through its content. Number of rounds, difficulty curve, what changes between rounds.

**Questions:**

- What determines the number of rounds — the spec? The content set? Both?
- What happens when the content set has fewer items than totalRounds?
- What are the valid difficulty curve shapes? (linear, stepped by stage, adaptive)
- What resets between rounds vs what carries over? (score carries, input resets, timer resets?)
- How are rounds grouped into stages? What changes at stage boundaries?

### 1.4 End conditions

What causes the game to end, and what happens when it does.

**Questions:**

- What are all the ways a game can end? (all rounds done, lives exhausted, timer expired, student quits)
- For each end condition, which screen does the student see?
- Is game_complete postMessage sent for ALL end conditions or only some?
- Can the game end mid-round (lives hit 0 during a round) or only at round boundaries?
- What gets cleaned up on end? (timers, intervals, event listeners, audio)

### 1.5 Replay cleanup

Everything that must happen when the student taps Play Again. This is a distinct skill from end conditions — ending the game is one thing, resetting it for another play is another.

**What must be reset:**

- gameState fields (score, lives, currentRound, attempts, events, startTime, isActive, gameEnded)
- DOM (clear gameplay content, re-render start or gameplay screen)
- Timers and intervals (clearInterval/clearTimeout for ALL active timers)
- Event listeners (remove before re-registering to prevent accumulation)
- SignalCollector (if used — reset or create new instance)
- FeedbackManager state (if any pending feedback, cancel it)
- duration_data (reset all timing arrays)

**Questions:**

- Is there a standard replay function signature all games must implement?
- Should replay go to start screen or directly into gameplay?
- Is a new game_start event tracked on replay?
- Are attempts from the previous play preserved or cleared?
- How do we test that replay is complete (no leaked state from previous play)?

### 1.6 Scaffolding and hints

What happens when the student is stuck — not wrong, but unable to proceed.

**Known patterns:**

- Show hint after N wrong attempts
- Allow retry on same question before moving on
- Show correct answer after max attempts
- Progressive hints (vague then specific)
- Lifeline button (use once per game)

**Questions:**

- What hint primitives can a spec invoke?
- How does hint usage affect scoring?
- How does a creator express "allow N retries per round before moving on"?
- What scaffolding patterns map to which Bloom levels? (L1 = show answer, L2 = guided hint, L3 = nudge only?)
- Is there a default scaffolding behavior when the spec doesn't specify?

---

## 2. Interaction

How the student acts. The input mechanism, validation, and response.

### 2.1 Input types

The pipeline must generate the correct input mechanism for the game type.

**Known input types:**

| Type | Student action | Implementation | Used in |
|------|---------------|----------------|---------|
| MCQ (single) | Tap one of 2-4 option buttons | Click handler on buttons | which-ratio, stats-identify-class, geo-* |
| MCQ (image) | Tap one of visual/diagram options | Click handler on image regions | name-the-sides |
| Number input | Type an integer (1-9, or larger) | `<input type="number">` + submit | find-triangle-side (step 2), scale-it-up |
| Text input | Type a word or phrase | `<input type="text">` + submit | None approved yet |
| Drag-and-drop | Drag items into slots/categories | Touch drag handlers (PART-033) | geo-triangle-sort |
| Click-to-select | Tap items in a grid, toggle selection | Click handler + selected state | math-cross-grid |
| Click-to-match | Tap two items to pair them | Pair selection state machine | match-the-cards, word-pairs, associations |
| Multi-step | Sequence of inputs within one round | State machine per round | find-triangle-side (MCQ then number) |
| Label assignment | Tap labels onto diagram positions | Position + click handlers | name-the-sides |
| Worked example steps | Tap to reveal next step, then fill blanks | Step-by-step reveal + input | soh-cah-toa-worked-example |
| Multi-selection | Tap multiple correct items from a set | Toggle selection + submit | stats-which-measure |
| Sequence ordering | Arrange items in correct order (smallest to largest, chronological) | Drag to reorder or tap-to-number | None approved yet (needed for fractions, number sense) |
| Construction | Build an expression/sequence from parts | Drag parts into slots or tap-to-add | expression-completer, sequence-builder |
| Estimation | Place value on a number line or slider | Drag handle or tap position | None approved yet (needed for number sense, measurement) |
| Transformation | Rotate, flip, or scale a shape | Drag rotation handle or tap transform buttons | None approved yet (needed for geometry) |

**Questions:**

- Is this list complete? What input would a new game need that isn't here?
- For each input type, what are the platform-specific concerns? (e.g., number input — does the native keyboard work on all target browsers? Does it work on iOS?)
- How does input type affect touch target size requirements?
- Can input types compose within a single round (e.g., drag THEN type)?
- What input types are planned for Tier 2/3 games? (free-text with LLM eval, drawing, voice?)
- For multi-selection: how does scoring work for partial correctness (3 of 4 correct)?
- For construction: what validation handles "student-built expression is mathematically equivalent to target"?
- For each input type, what are the visual states? (idle → focused → active → disabled → error)

### 2.2 Input validation

How the game decides if the student's input is correct.

**Known validation types (warehouse parts):**

| Type | PART | How it works |
|------|------|-------------|
| Fixed match | PART-013 | Exact comparison (string, number, or array) |
| Function-based | PART-014 | Custom validation function with try/catch |
| LLM subjective | PART-015 | `MathAIHelpers.SubjectiveEvaluation.evaluate()` |
| No validation | PART-029 | Story-only, auto-completes |

**Questions:**

- For fixed match — is comparison case-sensitive? Does "3" match "3.0"? Does " 3 " match "3"?
- For function-based — what guardrails prevent the function from being buggy?
- For LLM validation — what happens when the LLM call fails? Timeout? Retry? Fallback?
- How does partial credit work? Is it a thing?
- Who defines what's "correct" — the content set? The game logic? Both?

### 2.3 Input protection

Preventing double-submission, input during feedback, and other timing issues.

**Questions:**

- What is the standard guard pattern? (`isProcessing` flag? Disable buttons? Both?)
- When exactly does input get blocked — on submit? On correct? On wrong?
- When exactly does input get unblocked — after feedback ends? After next round renders?
- What happens if the student taps during a screen transition?
- What happens with rapid repeated taps on the same option?

---

## 3. Presentation

What the student sees. Screens, layout, visual design, feedback, and how things move.

### 3.1 Screen layout

How each screen is composed — what elements exist, where they sit, responsive behavior.

**Universal layout pattern (PART-021, PART-025):**

```
┌──────────────────────────┐
│  [ProgressBar slot]      │  ← PART-023: round counter + lives
│──────────────────────────│
│                          │
│  [Game content area]     │  ← #gameContent (created by ScreenLayout.inject)
│                          │
│──────────────────────────│
│  [TransitionScreen slot] │  ← PART-024: overlays for start/victory/gameover
└──────────────────────────┘
```

**Questions:**

- Does every game use ScreenLayout.inject()? Or can a game manage its own layout?
- What are the slot options? (progressBar, transitionScreen — others?)
- What's the maximum content height before scrolling is needed? Is scrolling ever OK?
- How does the layout adapt between 320px and 414px widths?
- Where do game-specific elements go relative to the universal slots?

### 3.2 Round presentation sequence

Within a round, the student sees content in a specific order BEFORE they interact. This is the "question preview" phase — distinct from feedback (after) and from the gameplay interaction itself.

**Sequence within a round:**

1. **Question preview** — the question/prompt appears (text, image, diagram). Some gameplay components may or may not be visible yet.
2. **Instructions** — if the round type differs from previous (e.g., "Now tap Same or Different"), instructions may display briefly or persistently.
3. **Media** — an audio clip may play (TTS reading the question) or a video/animation may show (visual context).
4. **Gameplay reveal** — interaction elements appear (buttons, input field, drag targets). This is when the student can act.

Not every round has all 4 phases. But the pipeline must know: what does the student see BEFORE they can act?

**Questions:**

- Which rounds have a preview phase vs which go straight to interaction?
- How long does the preview phase last? Timed? Until student taps? Until audio finishes?
- Should instructions persist on screen during gameplay or disappear?
- Can the student skip the preview (tap to skip audio/video)?
- Does the preview phase differ by round type within the same game? (e.g., Type A vs Type B in Scale It Up)
- How does the preview affect pacing? (Long previews feel slow; no previews feel rushed)

### 3.3 UI design rules

Visual consistency across all games.

**Known rules (PART-020):**

- CSS variables: `--mathai-*` system for colors, fonts, spacing, borders
- System fonts only: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- No external CDN for fonts, icons, or CSS frameworks
- Mobile-first: 375x667 target viewport
- Touch targets: minimum 44px
- Card border-radius: 12px

**Questions:**

- What is the complete `--mathai-*` variable set? (colors, gradients, spacing values)
- What are the typography rules? (min body font size, heading sizes, line heights)
- What are the button styles? (primary, secondary, danger — per PART-022)
- What are the color rules for feedback states? (green = correct, red = wrong, blue = selected, gray = disabled)
- What spacing/margin rules exist? Between elements? Between rounds?
- What animation patterns are standard? (fade in/out, slide, scale, bounce)
- What is the accessibility baseline? (contrast ratio, focus indicators, aria attributes)

### 3.3 Feedback presentation

How the game responds to student actions — audio, visual, text.

**FeedbackManager (PART-017):**

The game calls `playDynamicFeedback()`. FeedbackManager renders its own overlay (subtitle + sticker). The game does NOT build custom overlays.

**Questions:**

- What are the valid feedback types? (`correct`, `incorrect`, `victory`, `gameover` — complete list?)
- What parameters does `playDynamicFeedback` accept? (subtitle text, sticker type, duration?)
- Does the game need to await feedback completion or fire-and-forget?
- When PART-017 = NO (no FeedbackManager), what does the game do for feedback?
- Should wrong-answer feedback reveal the correct answer? Always? Sometimes?
- Should feedback be misconception-specific (e.g., "You picked the additive answer — try multiplying instead")?
- How long does each feedback type block input? Is it configurable?

### 3.4 Screen transitions

How the game moves between screens — animation, timing, what triggers it.

**Known patterns (PART-024):**

| Transition | Trigger | Animation | Duration |
|------------|---------|-----------|----------|
| start → gameplay | Tap start button | TransitionScreen hide | ~500ms |
| round → next round | Auto-advance after feedback | Fade content | ~300ms |
| round → game_over | Lives = 0 after feedback delay | TransitionScreen show | ~500ms |
| final round → results | Auto-advance after feedback | TransitionScreen show | ~500ms |
| results → start | Tap replay button | Full reset + TransitionScreen | ~500ms |

**Questions:**

- Are these transition patterns universal or game-specific?
- Can transitions be interrupted (student taps during transition)?
- What visual state is the game in during a transition? (old content? blank? loading?)
- How does auto-advance timing interact with feedback timing? (feedback ends → wait → advance?)

---

## 4. Platform

How the game talks to the system. CDN packages, state management, data capture, communication protocol.

This is where warehouse.parts lives. Every PART-NNN maps to a sub-skill here.

### 4.1 CDN package loading (PART-001, PART-002, PART-003)

Loading the platform's JavaScript packages in the correct order, waiting for them, handling failure.

**Package load order:**

1. `feedback-manager/index.js` (if PART-017 = YES)
2. `components/index.js` (always)
3. `helpers/index.js` (always)

**Globals provided:**

| Package | Globals | PART |
|---------|---------|------|
| feedback-manager | FeedbackManager, playDynamicFeedback | PART-017 |
| components | ScreenLayout, ProgressBarComponent, TransitionScreenComponent, SubtitleComponent | PART-025, PART-023, PART-024 |
| helpers | VisibilityTracker, SignalCollector, MathAIHelpers | PART-005, PART-042, PART-015 |

**Questions:**

- What is the complete list of globals each package provides?
- What happens when a package fails to load? Which packages are mandatory vs optional?
- What is the timeout for waitForPackages? What happens on timeout — error or graceful degradation?
- Can packages load out of order? Does order matter beyond feedback-manager first?
- How do we detect a CDN package version change that breaks games?

### 4.2 Initialization sequence (PART-004)

The exact order of operations when the game loads.

**Canonical sequence:**

```
DOMContentLoaded
  → waitForPackages()
  → FeedbackManager.init()        (if PART-017 = YES)
  → ScreenLayout.inject('app', { slots: {...} })
  → ProgressBarComponent.init()   (if PART-023)
  → VisibilityTracker.init()      (if PART-005)
  → TimerComponent init           (if PART-006)
  → register postMessage listener
  → send game_ready postMessage
  → setupGame() with fallbackContent
```

**Questions:**

- Is this sequence the same for every game or does it vary by PART flags?
- What breaks if the order changes? (e.g., ScreenLayout before FeedbackManager.init?)
- What breaks if a step is skipped?
- How does the game know which PART flags are active?
- What's the initialization sequence for games with PART-017 = NO?

### 4.3 State management (PART-007)

The gameState object — shape, required fields, lifecycle.

**Questions:**

- What is the canonical gameState shape? Which fields are required for every game?
- Which fields are game-specific?
- Where does gameState live? (`window.gameState` always?)
- What other window-exposed functions are required? (`endGame`, `restartGame`, `nextRound`, `debugGame`, `debugAudio`?)
- How does syncDOM work? What data-* attributes does it set on #app?
- What phase names are valid? (`start_screen`, `playing`, `results`, `gameover` — complete list?)

### 4.4 Communication protocol (PART-008)

How the game communicates with the parent platform.

**Inbound (platform → game):**

| Message type | What it carries | When sent |
|-------------|----------------|-----------|
| game_init | Content (rounds), config (signalConfig) | After game sends game_ready |

**Outbound (game → platform):**

| Message type | What it carries | When sent |
|-------------|----------------|-----------|
| game_ready | Nothing | After postMessage listener registered |
| game_complete | `data.metrics` (accuracy, time, stars, attempts, duration_data, totalLives, tries) + `data.completedAt` | On endGame |

**Questions:**

- Is the inbound message always `game_init` or are there other types?
- What happens if `game_init` arrives before the game is ready?
- What happens if `game_init` never arrives? (fallbackContent kicks in — but when?)
- Is `game_complete` the only outbound message or are there progress updates?
- What's the exact schema of `data.metrics`? Which fields are required vs recommended?
- What's in `duration_data`? Who consumes it?

### 4.5 Data capture (PART-009, PART-010)

Recording what the student did for analytics and the gauge step.

**recordAttempt (PART-009):**

Every answer → one attempt record with: `attempt_timestamp`, `time_since_start_of_game`, `input_of_user`, `attempt_number`, `correct`, `metadata`.

**trackEvent (PART-010):**

Key moments → event records: `game_start`, `game_end`, `answer_submitted`, `round_complete`, etc.

**Questions:**

- What MUST be in the `metadata` field for the gauge step to be useful?
- Should metadata include: misconception tag? Distractor chosen? Time to answer? Round difficulty? Stage?
- Is there a difference between "attempt" (one submission) and "try" (one round with retries)?
- What is the canonical list of events every game must track?
- Do we capture the student's wrong answer AND what the right answer was?
- How do we capture "the student hesitated" or "the student changed their mind"?

### 4.6 Signal collection (PART-042 SignalCollector)

Fine-grained event capture for analytics.

**Questions:**

- When is SignalCollector used vs not?
- What signals does it capture beyond trackEvent?
- What's the flush mechanism? When does seal() get called?
- What data goes into game_complete from SignalCollector? (`signal_event_count`, `signal_metadata`)

### 4.7 Visibility tracking (PART-005)

Detecting tab switches, pausing/resuming the game.

**Questions:**

- Does VisibilityTracker pause timers automatically or does the game manage that?
- What happens to game state when the tab is hidden? Does the game freeze?
- Does the student see a "welcome back" popup? Is that from the platform or the game?
- How does inactive time get recorded in duration_data?

### 4.8 Timer (PART-006)

Countdown or count-up timer for timed games.

**Questions:**

- When is TimerComponent used vs not?
- Does the timer pause on tab switch automatically (via VisibilityTracker)?
- What happens when the timer hits zero? Who calls endGame — the timer or the game?
- Can the timer be reset per round?

### 4.9 Error tracking (PART-030)

Sentry integration for runtime error reporting.

**Questions:**

- When is Sentry used vs not?
- What errors get reported — all? Only uncaught? Only game logic errors?
- What metadata is attached to error reports? (gameId, round, phase)
- Is Sentry a launch requirement or post-launch?

### 4.10 Debug functions (PART-012)

Developer/QA tools exposed on window.

**Canonical list:** `debugGame()`, `debugAudio()`, `testAudio()`, `testPause()`, `testResume()`, `testSentry()`, `verifySentry()`

**Questions:**

- Are all of these required for every game?
- What should each function do?
- Are these stripped in production or always present?

### 4.11 Anti-patterns (PART-026)

Known things the pipeline must NOT do.

**Documented anti-patterns:**

- Manual timers (`new Audio()` instead of FeedbackManager)
- Wrong load order
- Missing timeout in waitForPackages
- Hardcoded colors instead of CSS variables
- Custom feedback overlays instead of FeedbackManager
- Direct gameState mutation from outside game logic

**Questions:**

- Is this list complete? What anti-patterns are discovered but not documented?
- How are anti-patterns enforced — lint rules? Review? Both?

### 4.12 Analytics readiness

Ensuring the game produces data that is actually analyzable. Without this skill, games ship as analytics black boxes.

**What this skill validates:**

- Every wrong-answer distractor in fallback content has a `misconception_tag`
- recordAttempt includes `round_number`, `question_id`, `correct_answer`, `response_time_ms`
- game_complete metrics include per-round accuracy breakdown (not just aggregates)
- Incomplete sessions emit a `game_abandoned` event (via beforeunload)
- inputSchema requires misconception metadata in content sets

**Questions:**

- What is the minimum set of analytics fields that makes data useful for the gauge step?
- Who defines misconception tags — the spec? The content set? The game?
- How do we validate that misconception tags are real (not placeholder strings)?
- Should analytics readiness be a lint check or a test?

### 4.13 Results screen (PART-019)

Construction of the end-of-game results display.

**Questions:**

- What must the results screen show? (score, stars, replay button — anything else?)
- Is the results screen constructed by a platform component or by the game?
- How does the results screen differ between "completed all rounds" and "game over (lives exhausted)"?

### 4.14 Play area construction (PART-027)

How the game's main content area is built and managed.

**Questions:**

- What is the play area framework? (grid, options, input layouts, state management)
- How does it relate to ScreenLayout.inject()?
- What design process does it follow? (interpret, construct, simulate, verify)

### 4.15 Stories component (PART-016)

Narrative/story-based game flow, no validation, no feedback, auto-complete.

**Questions:**

- When is StoriesComponent used?
- How does it interact with the game state machine (no rounds, no scoring)?
- What does game_complete look like for a story-only game?

### 4.16 Interaction manager (PART-038)

Custom interaction logic beyond the standard input types.

**Questions:**

- How does InteractionManager relate to PART-033 (interaction patterns)?
- Are they redundant or complementary?
- What interaction types does InteractionManager support that PART-033 doesn't?

### 4.17 Analytics manager (PART-032)

Multi-platform analytics event tracking (Mixpanel, Amplitude, CleverTap).

**Questions:**

- How does AnalyticsManager relate to trackEvent (PART-010) and SignalCollector (PART-042)?
- Three overlapping data capture systems — when does a game use which?
- What are the 7 mandatory analytics events?
- Is AnalyticsManager required for all games or only some?

### 4.18 Known integration hazards

Critical integration patterns that cause build failures if violated. These are documented in prompts.js gen rules but must be explicit skills.

**Hazards:**

- **FeedbackManager.init() popup:** When PART-017=NO, calling FeedbackManager.init() shows a blocking audio permission popup causing 100% test failure. Pipeline must never generate this call when PART-017=NO.
- **ScreenLayout.inject() slots wrapper:** Must pass `{ slots: { progressBar: true } }` not `{ progressBar: true }`. Missing wrapper causes #gameContent to not be created (blank page).
- **TimerComponent late-load:** TimerComponent loads ~554ms after ScreenLayout. waitForPackages must check `typeof TimerComponent` when PART-006=YES, or game crashes with ReferenceError.
- **postMessage race:** Test harness calls waitForPhase('playing') immediately after game_init. The handler MUST set gameState.phase='playing' as its very first line.
- **CDN version pinning:** Games load packages by URL without version pinning. A breaking CDN update silently breaks all deployed games. No canary, no rollback.

**Questions:**

- Is this list complete? What other integration hazards exist?
- Should these be lint-time checks or runtime guards?
- How do we prevent new hazards from being introduced?

---

## 5. Content

What the game teaches. The educational material, its structure, and its correctness.

### 5.1 Fallback content

Built-in content the game uses when no content set is injected.

**Questions:**

- Must fallback content be a real lesson (educationally complete) or just functional (game doesn't crash)?
- How many rounds of fallback content are required?
- Must fallback content cover all difficulty levels in the spec?
- Does fallback content need misconception-targeted distractors?

### 5.2 Content set compatibility

The game correctly loads, validates, and uses externally-injected content.

**Input schema (PART-028, PART-034):**

Every game has an `inputSchema.json` — JSON Schema (draft-07) describing the exact shape of content the game accepts.

**Questions:**

- How does the game validate incoming content against the schema?
- What happens when content doesn't match — reject? Use fallback? Use what fits?
- Can a content set change game parameters (totalRounds, difficulty) or only questions?
- How do content sets interact with difficulty progression? Does content set order matter?

### 5.3 Educational correctness

Every question has a right answer. Every distractor is there for a pedagogical reason.

**Questions:**

- Who validates educational correctness — the creator? The pipeline? Both?
- Can the pipeline verify math correctness programmatically? (e.g., "2:1 scaled ×3 = 6:3" is true)
- How do we ensure distractors target real misconceptions, not random wrong answers?
- Should the pipeline flag content that seems educationally suspect?
- How do we map each distractor to a named misconception?
- Does feedback reference the specific misconception, or just say "wrong"?

### 5.4 Curriculum alignment

The game teaches the right concept at the right Bloom level for the right grade.

**Known Bloom levels in use:** L1 Remember, L2 Understand, L3 Apply, L4 Analyze

**Questions:**

- How does Bloom level affect game structure? (L1 = recognition, L2 = guided, L3 = computation, L4 = analysis)
- How does Bloom level affect feedback? (L1 = immediate, L2 = scaffolded, L3 = conditional)
- How does Bloom level affect scoring? (L1 = accuracy, L2 = first-attempt, L3 = error-count)
- Does the pipeline know about Bloom levels, or is that purely a creator concern?
- How do we verify a game actually operates at its claimed Bloom level?

---

## 6. Device

The game works on the student's actual device.

### 6.1 Mobile rendering

Game displays correctly on target devices.

**Questions:**

- What is the target viewport? Just 375x667 or a range of widths?
- What devices do our students actually use? Do we have data?
- Should games work in landscape?
- What happens on tablets (wider viewports)?
- Is scrolling ever acceptable within a screen?

### 6.2 Cross-browser

Game works on the browsers students actually use.

**Questions:**

- What browsers and versions must we support? (Chrome, Safari, Firefox, Samsung Internet, Android WebView?)
- What JS/CSS features are safe vs risky? Is there a banned-feature list?
- How do we test cross-browser? (BrowserStack? Real devices? CI?)
- What are the known browser-specific failure patterns from Sammit's testing?

### 6.3 Performance

Game loads fast and runs smoothly on low-end devices.

**Questions:**

- What is the target load time? On what network? (4G? 3G?)
- What is the maximum acceptable HTML file size?
- Are there expensive operations to avoid? (heavy animations, large DOM, frequent reflows)
- How do we measure performance — synthetic (Lighthouse) or field (real user monitoring)?

### 6.4 Offline / network resilience

What happens when the network is unreliable.

**Questions:**

- What happens if CDN scripts fail to load? (timeout → fallback? or hard fail?)
- What happens if the student loses network mid-game?
- Is any data cached locally in case postMessage to parent fails?
- Do we need service worker / offline support?

---

## 7. Deployment

The game is reachable and stays reachable.

### 7.1 Upload and registration

Game HTML uploaded to GCP, registered with Core API, content sets created.

**Questions:**

- What is the deployment target? (GCP bucket → CDN URL?)
- What does Core API registration include? (game metadata, inputSchema, artifactContent)
- How are content sets created and linked to a game?
- What is the game URL format? (`https://learn.mathai.ai/game/<gameId>/<contentSetId>`)

### 7.2 Health check

Verifying the deployed game actually works.

**Questions:**

- Is there a post-deploy health check?
- What does the health check verify — page loads? No JS errors? game_ready fires?
- How do we detect a regression after a CDN package update?
- Who gets notified when a health check fails?

### 7.3 Versioning and updates

What happens when a game is updated.

**Questions:**

- Does updating a game create a new URL or replace the existing one?
- What happens to students mid-session on the old version?
- Is there a rollback mechanism?
- How do we track what changed between versions?

---

## 8. Experience

How it feels to play. A game that doesn't crash but feels bad is a failed game.

### 8.1 Onboarding

The first 5 seconds. Does the student know what to do without reading instructions?

**Questions:**

- Can a new student understand what to do within 5 seconds?
- Does the start screen communicate: what game, what topic, how long, what to do?
- Is there a loading state while CDN scripts load (not a white screen)?
- Should there be a tutorial round or is the first round self-explanatory?

### 8.2 Emotional safety

The game never makes the student feel stupid.

**Questions:**

- What language is used on the game-over screen? ("Game Over" vs "Let's try again")
- Does feedback tone differ by Bloom level? (L1 encouraging, L3 matter-of-fact?)
- How does the game handle streaks of wrong answers? (escalating frustration)
- Is there a "give up" option that doesn't feel like failure?
- Does the scoring system punish or encourage? (losing points vs not gaining them)

### 8.3 Learning from mistakes

The student understands WHY their answer was wrong, not just THAT it was wrong.

**Questions:**

- Should the correct answer always be revealed after a wrong answer?
- Should the explanation be misconception-specific? ("You added instead of multiplying")
- How long is the explanation shown before advancing?
- Does the student have a way to review their mistakes at the end?

### 8.4 Motivation and retention

The student has a reason to play again.

**Questions:**

- Should scores persist across sessions?
- Is there a personal best / streak system?
- Can students compare scores with peers?
- Is there a progression system across games (not just within)?
- What makes a student open this game a second time?

### 8.5 Language and readability

The game text matches the student's language and reading level.

**Questions:**

- What is the reading level of game text? Does it match students' English proficiency?
- How do we handle math terms students know in Hindi but not English?
- Is localization (Hindi, other regional languages) in scope?
- What is the string externalization mechanism for future localization?

### 8.6 Sound independence

The game works fully with sound muted (classroom, no headphones, cracked speaker).

**Questions:**

- Does the game function without audio? (FeedbackManager audio is supplementary, not required?)
- Are there interactions that depend on audio cues with no visual equivalent?
- Is there a mute button?

### 8.7 Session continuity

What happens across sessions, across games, and when the student leaves and comes back.

**Questions:**

- If the student closes the browser mid-game, is all progress lost?
- Can a game resume from where the student left off?
- How does a creator express a sequence of games as a learning unit (warm-up → practice → assessment)?
- Are there prerequisite dependencies between games?
- Does progress persist across sessions (personal best, cumulative score)?
- Is there spaced repetition across sessions?

### 8.8 Accessibility

The game is usable by students with disabilities.

**Questions:**

- What WCAG level is the target?
- Is keyboard-only play required?
- Which assistive technologies must work? (screen readers, switch access)
- Are there color-blind safe palettes?
- Is reduced motion preference respected?
- Are there games where accessibility is fundamentally harder? (drag-and-drop, canvas)

### 8.9 Game feel

The moment-to-moment sensation of playing. The difference between a game students play once and one they replay.

**Sub-skills:**

- **Juice:** Micro-animations that make interactions feel alive (bounce on correct, shake on wrong, confetti on victory, score counter animate-up). Not cosmetic — juice is what makes a tap feel like it DID something.
- **Pacing:** The rhythm cycle: question appears (beat) → student thinks (tension) → answer submitted (release) → feedback (reward) → next round (reset). The timing of this cycle determines "snappy" vs "sluggish."
- **Stakes:** What makes the student care about getting it right — beyond lives. Streak bonuses, near-miss feedback ("so close!"), loss aversion, personal best tracking.
- **Surprise:** Randomized encouragement messages, unexpected bonus rounds, visual variety between rounds, Easter eggs for perfect scores. Prevents monotony.

**Questions:**

- What is the minimum set of micro-animations every game should have by default?
- What is the target time-per-round for each game archetype?
- Should correct answers always trigger a visual celebration beyond FeedbackManager's overlay?
- What is the failure recovery pattern after 3+ consecutive wrong answers? (easier next question? encouragement? hint auto-trigger?)
- How does pacing differ by Bloom level? (L1 fast drill vs L4 slow analysis)

### 8.10 Mobile-specific UX

Physical constraints of the device the student is using.

**Known gaps:**

- **Thumb zone:** Interactive elements must sit within one-handed thumb reach (lower 60% of screen). Submit buttons at top are unreachable.
- **Keyboard viewport:** When number input gains focus, the keyboard must not cover the question. Use `visualViewport` API or CSS `env(keyboard-inset-*)`.
- **Orientation lock:** Games should lock to portrait. Rotation mid-game is undefined.
- **Safe areas:** Modern phones have notches, dynamic islands, rounded corners, gesture bars. Layout must use `env(safe-area-inset-*)`.
- **Browser gesture suppression:** Downward swipe triggers pull-to-refresh in Chrome, reloading the game mid-round. Must be suppressed via `overscroll-behavior: none`.
- **System interruptions:** Phone calls and notifications may not trigger `visibilitychange` on mobile but still obscure the game.

**Questions:**

- What percentage of our students' devices have notches or gesture bars? Do we have data?
- Should we use `overscroll-behavior: none` on all games by default?
- How do we test thumb zone compliance? (lint rule? visual review?)
- Should the pipeline enforce portrait orientation lock via `<meta>` or CSS?

---

## Game Archetype Profiles

10 validated profiles based on shipped games. Each profile is a coherent combination of structure + interaction + scoring + feedback. The pipeline should map each spec to one of these profiles and generate the matching skeleton.

| # | Profile | Structure | Interaction | Scoring | Examples |
|---|---------|-----------|-------------|---------|----------|
| 1 | MCQ Quiz | Rounds | MCQ single | +1/correct, stars | which-ratio, geo-angle-id |
| 2 | Speed Blitz | Timed | MCQ single | +1/correct, time bonus | addition-mcq-blitz, rapid-challenge |
| 3 | Lives Challenge | Lives + rounds | MCQ or number input | +1/correct, 3 lives | find-triangle-side |
| 4 | Sort/Classify | Rounds | Drag-and-drop | Per-item scoring | geo-triangle-sort |
| 5 | Memory Match | Rounds | Click-to-match | Pairs cleared | match-the-cards, word-pairs |
| 6 | Board Puzzle | Puzzle | Click-to-select | Solve state | queens-puzzle, math-cross-grid |
| 7 | Construction | Rounds | Build-from-parts | Correct construction | expression-completer, sequence-builder |
| 8 | Worked Example | Example/faded/practice | Step reveal + input | Per-step scoring | soh-cah-toa-worked-example |
| 9 | No-Penalty Explorer | No-penalty rounds | MCQ | Encouragement only | name-the-sides, geo-angle-id |
| 10 | Tracking/Attention | Timed rounds | Click-to-select | Timed accuracy | keep-track, total-in-flash |

**Questions:**

- Is this list complete? Does every shipped game fit one of these profiles?
- Should the pipeline auto-detect the profile from the spec, or should the creator explicitly choose?
- Can profiles compose (e.g., "Lives Challenge with Construction interaction")?
- What PART flags does each profile require?

---

## 9. Data

What the system learns from each play session. Without this domain, the gauge step is blind.

### 9.1 Attempt schema

Every student answer is recorded with enough context to answer "why did they fail?"

**Required fields in recordAttempt:**

| Field | Type | Why |
|-------|------|-----|
| attempt_timestamp | number | When they answered |
| time_since_start_of_game | number | Session context |
| input_of_user | any | What they chose |
| correct | boolean | Right or wrong |
| round_number | number | Which round this was |
| question_id | string | Links to specific question across sessions |
| correct_answer | any | What the right answer was |
| response_time_ms | number | Time from question display to submission |
| misconception_tag | string or null | Which misconception the wrong answer maps to (null if correct) |
| difficulty_level | number | The difficulty/stage of this round |
| is_retry | boolean | Was this a second attempt on the same question |
| metadata | object | Game-specific additional context |

**Questions:**

- Is this schema the canonical standard, or can games extend it?
- Who defines misconception_tag — the content set? The game? The spec?
- How do we validate that games actually populate all required fields?

### 9.2 Session-level data

Data about the full play session, not just individual attempts.

**Required in game_complete metrics:**

| Field | Why |
|-------|-----|
| accuracy (0-100) | Overall performance |
| time (seconds) | Total duration |
| stars (0-3) | Rating |
| attempts (array) | Full attempt history |
| duration_data | Timing breakdown |
| totalLives | Lives remaining |
| tries (array) | Per-round attempt counts |
| per_round_accuracy | Array of correct/incorrect per round — identifies difficulty spikes |

**Questions:**

- Should game_complete include per-round breakdown or is that derivable from attempts?
- What concept/topic tags should be in game_complete for cross-game analysis?
- Should there be a student_id or session_id passthrough from the platform?

### 9.3 Abandonment tracking

Students who quit before finishing are currently invisible.

**Questions:**

- Should the game emit a game_abandoned event via beforeunload?
- What data is sent on abandonment? (current round, score so far, time spent)
- How do we distinguish "quit because bored" from "app crashed" from "network lost"?
- What percentage of students abandon, and at which round? (Can't answer without this skill)

### 9.4 Cross-game analytics

Comparing performance across games on the same concept.

**Questions:**

- How do we tag games with concept/topic identifiers?
- Can the same student's performance be tracked across games? (requires student_id passthrough)
- How do we compare effectiveness of two games teaching the same concept?
- What is the standard concept taxonomy? (Tied to curriculum alignment in 5.4)

---

## Proof of Exhaustiveness

**Claim:** These 9 skill domains cover everything required for a working game that students want to play and that the team can learn from.

**Proof by tracing the student journey:**

1. Student opens URL → **Deployment** (7) ensures it's reachable
2. Page loads → **Platform** (4.1-4.2) loads CDN, initializes
3. Student sees start screen → **Experience** (8.1) ensures they understand what to do
4. Student taps Start → **Pattern** (1.2) transitions, **Presentation** (3.4) animates
5. Student sees question → **Content** (5) provides material, **Presentation** (3.1) renders it
6. Student is stuck → **Pattern** (1.6) provides scaffolding/hints
7. Student answers → **Interaction** (2.1) captures input, (2.2) validates, (2.3) guards against double-tap
8. Game responds → **Presentation** (3.3) plays feedback, **Experience** (8.3) explains the mistake, **Data** (9.1) records attempt with misconception tag
9. Student gets it wrong → **Experience** (8.2) keeps them encouraged, not defeated
10. Next round → **Pattern** (1.3) progresses, **Presentation** (3.4) transitions
11. Game ends → **Pattern** (1.4) triggers end, **Platform** (4.4) sends game_complete, **Data** (9.2) includes per-round breakdown
12. Student replays → **Pattern** (1.5) cleans up everything, **Experience** (8.4) gives them a reason to come back
13. Student quits mid-game → **Data** (9.3) captures abandonment
14. Creator reviews data → **Data** (9.1-9.4) answers "why did they fail?" and "what should I change?"

**At every step, on one device** → **Device** (6) ensures it works.
**In one language the student understands** → **Experience** (8.5).
**With or without sound** → **Experience** (8.6).
**Including students with disabilities** → **Experience** (8.7).

**Proof by contradiction (updated):**

- "Game doesn't load" → 4.1 (CDN) or 7.1 (deployment) or 6.2 (browser)
- "Student can't answer" → 2.1 (input type) or 2.3 (input protection) or 6.1 (touch targets)
- "Wrong answer counted as right" → 2.2 (validation)
- "Game gets stuck" → 1.2 (state machine) or 1.4 (end conditions)
- "No feedback on answer" → 3.3 (feedback) or 4.1 (CDN failed)
- "Score is wrong" → 1.3 (progression)
- "Data not captured" → 9.1 (attempt schema) or 4.5 (data capture)
- "Game breaks on Safari" → 6.2 (cross-browser)
- "Wrong math" → 5.3 (educational correctness)
- "Looks broken on phone" → 6.1 (mobile) or 3.1 (layout)
- "Can't reach the URL" → 7.1 (upload) or 7.2 (health check)
- "Student doesn't understand what to do" → 8.1 (onboarding)
- "Student feels stupid after losing" → 8.2 (emotional safety)
- "Student doesn't know why they were wrong" → 8.3 (learning from mistakes)
- "Student never plays again" → 8.4 (motivation)
- "Student can't read the English" → 8.5 (language)
- "Game is useless without sound" → 8.6 (sound independence)
- "Can't use without a mouse" → 8.7 (accessibility)
- "We don't know why students fail" → 9.1 (misconception tag missing)
- "Students who quit are invisible" → 9.3 (abandonment)
- "Can't compare games on same concept" → 9.4 (cross-game analytics)
- "Replay leaks memory / doubles event listeners" → 1.5 (replay cleanup)
- "Student is stuck with no help" → 1.6 (scaffolding)
- "FeedbackManager.init() called when PART-017=NO" → 4.18 (integration hazards)

---

## Skill Index

| Domain | # | Skill | Warehouse PARTs |
|--------|---|-------|-----------------|
| Pattern | 1.1 | Game structure type | PART-029 (story-only) |
| Pattern | 1.2 | Screen state machine | PART-024, PART-025 |
| Pattern | 1.3 | Round progression | — |
| Pattern | 1.4 | End conditions | PART-011 |
| Pattern | 1.5 | Replay cleanup | — |
| Pattern | 1.6 | Scaffolding and hints | — |
| Interaction | 2.1 | Input types | PART-033, PART-038 |
| Interaction | 2.2 | Input validation | PART-013, PART-014, PART-015 |
| Interaction | 2.3 | Input protection | — |
| Presentation | 3.1 | Screen layout | PART-019, PART-021, PART-023, PART-025, PART-027 |
| Presentation | 3.2 | Round presentation sequence (preview → instructions → media → gameplay reveal) | — |
| Presentation | 3.3 | UI design rules | PART-020, PART-022 |
| Presentation | 3.4 | Feedback presentation | PART-017 |
| Presentation | 3.5 | Screen transitions | PART-024 |
| Platform | 4.1 | CDN package loading | PART-001, PART-002, PART-003 |
| Platform | 4.2 | Initialization sequence | PART-004 |
| Platform | 4.3 | State management | PART-007 |
| Platform | 4.4 | Communication protocol | PART-008 |
| Platform | 4.5 | Data capture | PART-009, PART-010 |
| Platform | 4.6 | Signal collection | PART-042 (SignalCollector) |
| Platform | 4.7 | Visibility tracking | PART-005 |
| Platform | 4.8 | Timer | PART-006 |
| Platform | 4.9 | Error tracking | PART-030 |
| Platform | 4.10 | Debug functions | PART-012 |
| Platform | 4.11 | Anti-patterns | PART-026 |
| Platform | 4.12 | Analytics readiness | PART-032 |
| Platform | 4.13 | Results screen | PART-019 |
| Platform | 4.14 | Play area construction | PART-027 |
| Platform | 4.15 | Stories component | PART-016 |
| Platform | 4.16 | Interaction manager | PART-038 |
| Platform | 4.17 | Analytics manager | PART-032 |
| Platform | 4.18 | Integration hazards | Cross-PART |
| Content | 5.1 | Fallback content | — |
| Content | 5.2 | Content set compatibility | PART-028, PART-034 |
| Content | 5.3 | Educational correctness | — |
| Content | 5.4 | Curriculum alignment | — |
| Device | 6.1 | Mobile rendering | PART-021 |
| Device | 6.2 | Cross-browser | — |
| Device | 6.3 | Performance | — |
| Device | 6.4 | Offline / network resilience | — |
| Deployment | 7.1 | Upload and registration | PART-031, PART-034 |
| Deployment | 7.2 | Health check | — |
| Deployment | 7.3 | Versioning and updates | — |
| Experience | 8.1 | Onboarding | — |
| Experience | 8.2 | Emotional safety | — |
| Experience | 8.3 | Learning from mistakes | — |
| Experience | 8.4 | Motivation and retention | — |
| Experience | 8.5 | Language and readability | — |
| Experience | 8.6 | Sound independence | — |
| Experience | 8.7 | Session continuity | — |
| Experience | 8.8 | Accessibility | — |
| Experience | 8.9 | Game feel (juice, pacing, stakes, surprise) | — |
| Experience | 8.10 | Mobile-specific UX (thumb zone, keyboard, safe area, orientation) | — |
| Data | 9.1 | Attempt schema | PART-009 |
| Data | 9.2 | Session-level data | PART-011 |
| Data | 9.3 | Abandonment tracking | — |
| Data | 9.4 | Cross-game analytics | — |
