# Pre-Generation Plan: Word Problem Workshop

**Game ID:** `word-problem-workshop`
**Archetype:** Custom — No-Penalty Explorer + Subjective Evaluation variant
**Shape:** Multi-round (Shape 2) + customizations: lives branch removed, feedback duration extended (4-6s), per-round hint + example buttons, P17 voice input + P7 textarea fallback, LLM rubric evaluation with 3 tiers (correct / partial / incorrect)
**Rounds:** 3
**Lives:** None
**Star thresholds:** 3★ = 7-9 pts, 2★ = 4-6 pts, 1★ = 1-3 pts (max 9)

---

## 1. Screen Flow

The game session is wrapped in the persistent `PreviewScreenComponent` (PART-039). The wrapper header (avatar, score, star) is always visible; the wrapper itself is mounted ONCE and only `destroy()`'d in `endGame()`. All non-Preview screens render inside `#mathai-transition-slot` (transitions) or `#gameContent` (gameplay) below the persistent header.

| # | Screen | Component | Trigger in | Trigger out | Data shown |
|---|--------|-----------|-----------|-------------|------------|
| 1 | **Preview** | `PreviewScreenComponent` (state = `preview`) | DOMContentLoaded → `setupGame()` (after game DOM is rendered into `#gameContent`) | Tap "Skip & show options" OR audio finishes (or 5s silent timer) | `previewInstruction` HTML + `previewAudio` (TTS-rendered at deploy) |
| 2 | **Welcome** | `TransitionScreen` (variant: with-CTA) inside preview wrapper | After preview `onComplete` → `startGameAfterPreview()` | Tap "Let's go!" CTA OR full Welcome VO finishes (then waits for tap) | Title: "Word Problem Workshop", subtitle: "Tell stories that match the math!", CTA: "Let's go!" |
| 3 | **Round-N intro** (N = 1, 2, 3) | `TransitionScreen` (variant: auto-advancing, no buttons) | After Welcome CTA tap (R1) OR after previous round's Feedback auto-advance (R2, R3) | Auto, after Round-N SFX + VO sequence finishes | Title: "Round N", subtitle: stage label ("Single operation" / "Two-step expression" / "Compound expression") |
| 4 | **Game (round N)** | Custom `gameContent` (P17 voice input + P7 textarea fallback) | After Round-N intro auto-advance | Submit tapped → evaluation completes → Feedback panel renders inline | Expression card, prompt text, mic button, textarea, "Show hint" button, "Show example" button, Submit button |
| 5 | **Feedback (inline on Game screen)** | Inline feedback panel inside `gameContent` (NOT a separate `TransitionScreen`) + `FeedbackManager.playDynamicFeedback()` | Submit handler completes `validateAnswerLLM` | Auto-advance after 4-6s (timer measured from end of `playDynamicFeedback` await) | Tier color band (green/amber/grey), tier icon, written evaluation text, 1-line suggestion. Spoken feedback via TTS. |
| 6 | **Loop or Victory decision** | Logic only (no screen) | Feedback auto-advance fires | If `currentRound < 3` → goto Round-N+1 intro (screen 3). If `currentRound === 3` → goto Victory (screen 7). | — |
| 7 | **Victory** | `TransitionScreen` (status variant) inside preview wrapper | After last round's Feedback auto-advance | Tap "Play Again" (only if 1-2★) OR tap "Claim Stars" | Star count (1-3★), score X / 9, subtitle "Great storytelling!" / etc, buttons: "Play Again" (if <3★) and "Claim Stars" |
| 8a | **"Ready to improve your score?"** (Play Again path) | `TransitionScreen` (with-CTA) | Tap "Play Again" on Victory | Tap "I'm ready" CTA | Motivation VO; CTA: "I'm ready" |
| 8b | **"Yay, stars collected!"** (Claim Stars path) | `TransitionScreen` (auto-advancing, no buttons) | Tap "Claim Stars" on Victory | Auto, after stars-collected sound + ✨ animation finish | Star count + animation; auto-exits |
| 9a | **Restart from Round 1** | `restartGame()` resets state, then re-enters Round-1 intro (screen 3) | After "I'm ready" tap on screen 8a | — | Skips Preview + Welcome. PreviewScreenComponent stays in `game` state (auto-skip-to-game on second `show()` per PART-039). |
| 9b | **Exit** | postMessage `game_complete` to parent | After screen 8b auto-exits | — | — |

**No game-over screen.** No lives means the wrong-AND-lives-0 branch from default-flow.md is removed entirely.

---

## 2. Round-by-Round Breakdown

All three rounds share the same UI shape (Type A, P17 + P7). Per-round data lives in `gameState.content.rounds[N-1]`.

### Round 1 (Stage 1, single operation)

| Field | Value |
|-------|-------|
| Expression shown | `5 + 3 = 8` (large card, top of `#gameContent`, ~36px font) |
| Prompt text | "Make up a story that matches this expression." |
| Tappable elements | Mic button (P17 hold-to-record), textarea (always visible, editable transcript target), "Show hint" button, "Show example" button, Submit button |
| Rubric (passed verbatim to `evaluation_prompt`) | "A correct answer is a 1-3 sentence real-world story that (a) introduces a quantity of 5, (b) adds 3 more of the same kind of thing, and (c) arrives at a total of 8. Partial credit if the story uses addition with 5 and 3 but the final total is wrong or missing. Incorrect if the story uses the wrong operation (e.g., takes away), uses wrong numbers, is gibberish, or is empty." |
| Hint reveals | "Think about a situation where someone starts with something and then gets more of the same thing." (fades in below textarea) |
| Exemplar reveals | "Aarav had 5 mangoes. His friend gave him 3 more. Now he has 8 mangoes in total." (fades in below textarea, distinct from any sample evaluation) |
| Sample evaluations | **Correct (3 pts):** "I had 5 stickers and my sister gave me 3 more, now I have 8." → tier `correct`. **Partial (1 pt):** "I have 5 sweets and 3 more sweets." (no total stated) → tier `partial`. **Incorrect (0 pts):** "I had 8 candies and ate 3." (subtraction) → tier `incorrect`. |

### Round 2 (Stage 2, two-step expression)

| Field | Value |
|-------|-------|
| Expression shown | `3 × 4 + 2 = 14` |
| Prompt text | "Make up one story that matches this two-step expression." |
| Tappable elements | Same as R1 (mic, textarea, hint, example, submit) |
| Rubric | "A correct answer is a 2-4 sentence real-world story where (a) something is repeated or grouped 3 times in 4s (or 4 times in 3s), (b) 2 more of the same kind of thing are added on, and (c) the story arrives at a total of 14. Partial credit if multiplication and addition both appear but the story handles them as two disconnected scenarios instead of one, or the final total is wrong. Incorrect if only one operation is represented, operations are reversed, or the story is off-topic/empty." |
| Hint reveals | "Try a story where something is grouped or repeated (that is the ×), and then a few more of the same thing are added at the end (that is the +)." |
| Exemplar reveals | "There are 3 tables in a classroom and each has 4 chairs, so that is 12 chairs. Then the teacher brings 2 more chairs from the next room. Now there are 14 chairs in all." |
| Sample evaluations | **Correct:** "Three teams of 4 kids each played; then 2 extra kids joined. 14 kids in total." → `correct`. **Partial:** "I had 3 packs of 4 pencils. Then I bought 2 packs more." (totals never resolved into one number) → `partial`. **Incorrect:** "I have 3 cats and 4 dogs and they ran away." (only one operation, totals nonsense) → `incorrect`. |

### Round 3 (Stage 3, compound expression)

| Field | Value |
|-------|-------|
| Expression shown | `(4 × 5) + (3 × 2) = 26` |
| Prompt text | "Make up one story that matches this compound expression. Both groups should belong to the same scenario." |
| Tappable elements | Same as R1/R2 |
| Rubric | "A correct answer is a 2-5 sentence real-world story where (a) one sub-scenario produces 4 × 5 = 20 of something, (b) a second, related sub-scenario in the same story produces 3 × 2 = 6 of a comparable thing, and (c) the story combines them to a total of 26. Partial credit if both products appear but the story reads as two unrelated problems stapled together, or the final total is missing/wrong. Incorrect if only one product is represented, if the student ignores the grouping, or if the story is off-topic/empty." |
| Hint reveals | "Think of one scene where there are two kinds of groups — for example, big packs and small packs, or boys and girls in teams. Count each kind, then add both counts together." |
| Exemplar reveals | "At a stall, small packs hold 5 biscuits each and there are 4 small packs, so that is 20 biscuits. Next to them are 3 big packs holding 2 biscuits each, so that is 6 more biscuits. Altogether the stall has 26 biscuits." |
| Sample evaluations | **Correct:** "In our class library, 4 shelves each have 5 storybooks (20 books). 3 baskets each have 2 magazines (6 magazines). Together there are 26 things to read." → `correct`. **Partial:** "We have 4 packs of 5 markers and 3 packs of 2 erasers." (no total combining the two) → `partial`. **Incorrect:** "I have 4 friends and we played for 5 hours." (one product only, no grouping) → `incorrect`. |

---

## 3. Scoring + Stars Logic

```
gameState.score = 0  // initialized in setupGame()

// Per-round, after deriving tier from result.evaluation:
if (tier === 'correct')   gameState.score += 3
else if (tier === 'partial') gameState.score += 1
else /* 'incorrect' */    gameState.score += 0

// At end of last round (currentRound === 3, after feedback advance):
let stars
if (gameState.score >= 7) stars = 3      // 7, 8, 9
else if (gameState.score >= 4) stars = 2 // 4, 5, 6
else if (gameState.score >= 1) stars = 1 // 1, 2, 3
else stars = 0                           // 0 (special: replay only)
gameState.stars = stars
```

**No lives.** `gameState.lives` is not used; the wrong-answer branch never decrements anything. Submit button stays interactive across all 3 rounds regardless of tiers.

**No score floor / no negative.** Per feedback skill constraint 4.

**Score persistence on restart:** `restartGame()` resets `score`, `currentRound`, `stars`, `hintUsed`, `exampleUsed`, textarea + transcript state, but PreviewScreenComponent stays in `game` state (PART-039 restart rule).

---

## 4. Feedback Patterns Per Tier

All three tiers use `FeedbackManager.playDynamicFeedback({ audio_content, subtitle })` for the spoken evaluation, where the text comes directly from `result.feedback` returned by the LLM. The on-screen panel renders synchronously before audio.

| Tier | playDynamicFeedback payload | Visual state | Auto-advance |
|------|----------------------------|--------------|--------------|
| **Correct (3 pts)** | `{ audio_content: result.feedback, subtitle: result.feedback.slice(0, 60) }` (Note: subtitle truncated to ≤60 chars per feedback skill constraint 6.) Sticker: `celebration` (paired with the dynamic TTS via FeedbackManager). | Inline panel: green left band (`#22A06B`), checkmark icon, header "Great story!", body = `result.feedback`, written evaluation area shows `result.evaluation`. Confetti via existing `FeedbackManager` celebration sticker. | After `await playDynamicFeedback(...)` resolves, `setTimeout(advance, 4000)` (so total panel dwell ≥ 4s, ≤ 6s in practice — TTS is short). |
| **Partial (1 pt)** | Same shape as above. Sticker: `thinking` or neutral mascot. | Inline panel: amber left band (`#E8A317`), amber check icon, header "Almost!", body = `result.feedback`, written evaluation area shows `result.evaluation`. | Same timing rule (≥ 4s dwell after audio). |
| **Incorrect (0 pts)** | Same shape. **No sad sticker / no red cross** (per spec: gentle, non-shaming). Use `mascot_neutral` sticker. | Inline panel: soft grey left band (`#7A8088`), soft "info" circle icon, header "Let's try a different angle.", body = `result.feedback`, written evaluation area shows `result.evaluation` + a "Try the example?" link that opens the exemplar (if not already opened). | Same timing rule (≥ 4s dwell). Slightly longer (5-6s) acceptable to give the student time to read the suggestion. |

**Sequencing (per feedback skill constraints 8 + 9):** No SFX → TTS chain here. Single `await playDynamicFeedback(...)` call. Audio failure is non-blocking (`try { await ... } catch (e) {}`). NEVER use `Promise.race`.

**recordAttempt fires BEFORE `playDynamicFeedback`** (feedback skill constraint 5).

---

## 5. Voice-Input State Machine

```
            ┌────────────────── mic permission denied ──────────┐
            │                                                   │
            ▼                                                   │
       [text-only mode]                                         │
       (mic button hidden,                                      │
        textarea is the                                         │
        only input)                                             │
                                                                │
  ┌────────────────────────────────────────────────────────────┘
  │
  ▼
idle  ───tap-and-hold mic──▶  recording  ───release mic──▶  transcribing
                                                               │
                              ┌── transcript text appears ─────┘
                              ▼
                          editable  ◀──── student edits textarea ───┐
                              │                                     │
                              │ tap Submit (with non-empty text)    │
                              ▼                                     │
                          submitting  ──validateAnswerLLM()──▶  evaluating
                                                                    │
                                                                    ▼
                                                                feedback
                                                                    │
                                                                    │ 4-6s
                                                                    ▼
                                                                  next
                                                              (round N+1
                                                               OR victory)
```

| State | UI | Guards |
|-------|----|--------|
| `idle` | Mic button enabled (filled), textarea empty or post-edit content, Submit enabled iff textarea has non-whitespace content | `gameState.isActive && !gameState.isProcessing` |
| `recording` | Mic button shows pulsing red ring, "Listening…" label, P17 streams via `VoiceInput` CDN (`getUserMedia` opened on hold) | Recording stops on `pointerup`, `pointercancel`, or `pointerleave` |
| `transcribing` | Mic button disabled with spinner, "Transcribing…" label, textarea grayed | Until VoiceInput resolves transcript |
| `editable` | Transcript dropped into textarea, mic returns to idle, cursor in textarea, student can edit freely | Same guards as idle |
| `submitting` | Submit button shows spinner, btnText = "Evaluating…", textarea read-only, mic disabled, hint/example buttons disabled | `gameState.isProcessing = true` |
| `evaluating` | Same as submitting (loading text may switch to "Generating Audio…") | — |
| `feedback` | Submit re-enabled internally but visually the inline feedback panel covers the input area; auto-advance timer is running | `gameState.isProcessing = true` until advance fires |
| `next` | Render next Round-N intro OR Victory; reset to `idle` on round entry | — |

**Mic-denied fallback:** On first `getUserMedia` rejection (or if `navigator.mediaDevices` is undefined), set `gameState.micDenied = true`, hide the mic button, show inline tip: "You can type your story instead." Textarea becomes the only input. The state machine collapses to `idle → editable → submitting → evaluating → feedback → next`.

**Submit-double-tap guard:** Submit handler immediately sets `gameState.isProcessing = true` and `submitBtn.disabled = true` BEFORE the empty-input check. Re-entry returns early.

---

## 6. Subjective Evaluation Wiring

### `evaluate()` call shape

```javascript
async function validateAnswerLLM(userAnswer, question, rubric) {
  try {
    const result = await MathAIHelpers.SubjectiveEvaluation.evaluate({
      components: [{
        component_id: 'q_' + gameState.currentRound,
        evaluation_prompt:
          'Question: "' + question + '"\n' +
          'Student answer: "' + userAnswer + '"\n' +
          'Rubric: ' + rubric + '\n\n' +
          'Evaluate whether the student answer is correct, partial, or incorrect ' +
          'against the rubric. Begin your response with exactly one of these labels ' +
          'on the first line: "correct", "partial", or "incorrect". Then on the next ' +
          'line(s), explain in 1-2 short sentences what worked and (if applicable) ' +
          'one specific thing to improve. Be warm and encouraging — this is a ' +
          'creative open-ended task for a child in Class 3-5.',
        feedback_prompt:
          'Based on {{evaluation}}, write 1-2 short sentences (max ~30 words) of ' +
          'warm, encouraging spoken feedback for a Class 3-5 student. Do not ' +
          'repeat the labels "correct/partial/incorrect". Address the student ' +
          'directly. If something is off, name the one specific thing to fix.'
      }],
      timeout: 30000
    });

    const c = result.data[0];
    const evalText = (c.evaluation || '').trim();
    const evalLower = evalText.toLowerCase();

    // 3-tier derivation — explicit per spec WARNING.
    // Default helper returns binary correct/incorrect; we override.
    let tier;
    const firstLine = evalLower.split('\n')[0].trim();
    if (firstLine.startsWith('correct'))         tier = 'correct';
    else if (firstLine.startsWith('partial'))    tier = 'partial';
    else if (firstLine.startsWith('incorrect'))  tier = 'incorrect';
    else {
      // Fallback keyword scan if the LLM didn't follow the format.
      if (evalLower.includes('partial')) tier = 'partial';
      else if (evalLower.includes('incorrect') || evalLower.includes('not correct')) tier = 'incorrect';
      else if (evalLower.includes('correct')) tier = 'correct';
      else tier = 'incorrect';
    }

    return {
      tier: tier,
      correct: tier === 'correct',                  // for legacy fields
      evaluation: evalText,
      feedback: c.feedback || ''
    };
  } catch (error) {
    console.error('LLM validation error:', JSON.stringify({ error: error.message }));
    return {
      tier: null,                                    // null tier signals "do not score, do not advance"
      correct: false,
      evaluation: '',
      feedback: 'Couldn\'t evaluate — try once more.'
    };
  }
}
```

### Submit handler skeleton

```javascript
async function onSubmit() {
  if (!gameState.isActive || gameState.isProcessing) return;

  const answer = textarea.value.trim();
  if (answer === '') {
    showInlineMessage('Tell me your story first!');
    return;
  }

  gameState.isProcessing = true;
  submitBtn.disabled = true;
  btnText.textContent = 'Evaluating...';

  const round = gameState.content.rounds[gameState.currentRound - 1];
  const result = await validateAnswerLLM(
    answer,
    round.expression + ' — ' + round.prompt,
    round.rubric
  );

  // API failure path — no attempt recorded, button re-enabled, no advance.
  if (result.tier === null) {
    showInlineMessage(result.feedback);
    gameState.isProcessing = false;
    submitBtn.disabled = false;
    btnText.textContent = 'Submit';
    return;
  }

  // Score
  const pointsByTier = { correct: 3, partial: 1, incorrect: 0 };
  gameState.score += pointsByTier[result.tier];

  // Record attempt — BEFORE audio, per feedback skill constraint 5
  recordAttempt({
    userAnswer: answer,
    correct: result.correct,
    question: round.expression + ' — ' + round.prompt,
    correctAnswer: round.rubric,
    validationType: 'llm',
    evaluation: result.evaluation,
    feedback: result.feedback,
    metadata: {
      tier: result.tier,
      hintUsed: gameState.hintUsed === true,
      exampleUsed: gameState.exampleUsed === true,
      round: gameState.currentRound
    }
  });

  // Advance progress bar (any submit advances — no lives gate)
  progressBar.increment();

  // Render inline feedback panel
  renderFeedbackPanel(result.tier, result.evaluation, result.feedback);

  // Spoken feedback (non-blocking on error)
  btnText.textContent = 'Playing Feedback...';
  try {
    await FeedbackManager.playDynamicFeedback({
      audio_content: result.feedback,
      subtitle: (result.feedback || '').slice(0, 60)
    });
  } catch (e) { /* feedback skill constraint 8 */ }

  // 4-6s dwell on feedback panel after audio resolves
  await new Promise(r => setTimeout(r, 4000));

  // Advance: next round or victory
  if (gameState.currentRound < 3) {
    gameState.currentRound += 1;
    gameState.hintUsed = false;
    gameState.exampleUsed = false;
    gameState.isProcessing = false;
    submitBtn.disabled = false;
    btnText.textContent = 'Submit';
    showRoundIntro(gameState.currentRound);
  } else {
    showVictory();   // gameState.isProcessing stays true through victory
  }
}
```

**Constraints honored:** components-array shape (CRITICAL 1), `MathAIHelpers` namespace (CRITICAL 2), `validationType: 'llm'` (STANDARD 10), `{{evaluation}}` only in feedback_prompt (STANDARD 8), embed Q+A+rubric in evaluation_prompt (STANDARD 9), 30s timeout (STANDARD 7), empty-input guard before API call (CRITICAL 6), button always re-enables (CRITICAL 4), try/catch wraps `evaluate` (CRITICAL 5).

---

## 7. PreviewScreen Integration (PART-039)

### `ScreenLayout.inject` config

```javascript
ScreenLayout.inject('app', {
  slots: {
    previewScreen: true,        // PART-039 enabled (spec sets previewScreen: true)
    transitionScreen: true      // multi-round game uses transitions
  }
});
```

### Instantiation (in DOMContentLoaded)

```javascript
const previewScreen = new PreviewScreenComponent({ slotId: 'mathai-preview-slot' });
```

### `setupGame()` order (CRITICAL — PART-039 ordering rule)

1. Render game UI into `#gameContent` FIRST: expression card, prompt, mic + textarea, hint/example/submit buttons. All inputs cleared. `gameState.currentRound = 1`, `gameState.score = 0`.
2. THEN call `previewScreen.show({ … })`:

```javascript
previewScreen.show({
  instruction: gameState.content.previewInstruction || fallbackContent.previewInstruction,
  audioUrl:    gameState.content.previewAudio || fallbackContent.previewAudio || null,
  showGameOnPreview: false,                      // spec: false
  timerConfig: null,                             // game has no TimerComponent
  timerInstance: null,
  onComplete: function (previewData) { startGameAfterPreview(previewData); }
});
```

### `startGameAfterPreview()` per PART-039

- Sets `gameState.previewResult`, `gameState.duration_data.preview`, `gameState.startTime = Date.now()`, `gameState.isActive = true`, `gameState.duration_data.startTime`.
- Calls `trackEvent('game_start', 'game')`.
- Calls `signalCollector.recordViewEvent('screen_transition', { from: 'preview', to: 'game' })`.
- Then enters the Welcome `TransitionScreen` (NOT renderRound — Welcome comes first per the diagram in the spec).

### `endGame()`

Calls `previewScreen.destroy()` exactly once (PART-039 verification checklist).

### Restart

`restartGame()` does NOT call `previewScreen.show()` again. The component auto-skips on a second show (PART-039 restart rule). After resetting `score`, `currentRound`, `hintUsed`, `exampleUsed`, jumps directly to `showRoundIntro(1)` — skipping Preview AND Welcome (per spec retry path).

### VisibilityTracker

Wired to `previewScreen.pause()` / `previewScreen.resume()` per PART-039 (also pauses any in-flight `playDynamicFeedback` via FeedbackManager).

---

## 8. Progress Bar Lifecycle

- **Component:** `ProgressBarComponent` rendered below the persistent preview header (default Shape-2 position).
- **Steps:** 3 (one per round).
- **Initial state:** Empty / 0 of 3 on entry to Round-1 intro.
- **Increment trigger:** Inside `onSubmit()`, immediately AFTER `recordAttempt` and BEFORE `renderFeedbackPanel`. ANY submit advances — `correct`, `partial`, AND `incorrect` all count, since there is no lives gating and every submit consumes a round.
- **Animation:** Fill animation runs during the 4-6s feedback window (before auto-advance).
- **Reset:** On `restartGame()`, `progressBar.reset()` to 0 of 3 before re-entering Round-1 intro.
- **Persistence:** ProgressBar state is lost on `endGame()` (component destroyed with the page).
- **Visible on:** Welcome, Round-N intro, Game, Feedback, Victory. (Per default-flow.md: visible on every screen except Preview.)

---

## 9. Known Risks / Edge Cases

| # | Risk | Handling |
|---|------|----------|
| 1 | **Empty submit** (textarea blank or whitespace-only) | `if (answer === '') { showInlineMessage('Tell me your story first!'); return; }` BEFORE API call. No `recordAttempt`, no progress increment, no LLM call. |
| 2 | **Mic permission denied** | First `getUserMedia` rejection sets `gameState.micDenied = true`. Mic button hidden. Inline tip: "You can type your story instead." Textarea remains the only input for the rest of the session. Re-prompted on restart only if browser permission state changed. |
| 3 | **LLM timeout (>30s)** | `try/catch` returns `{ tier: null, feedback: "Couldn't evaluate — try once more." }`. Submit handler shows inline message, re-enables submit button, does NOT advance progress, does NOT record attempt. Student can edit + resubmit. |
| 4 | **Non-English speech input** | VoiceInput passes whatever transcript it returns; the LLM rubric is language-agnostic for the operation/number content but may evaluate semantic correctness poorly. Acceptable for MVP — log via `recordAttempt` so analytics can spot the pattern. Future: detect language and warn before submit. |
| 5 | **Student submits blank after opening hint** | Same as #1 — empty submit guard fires. `gameState.hintUsed` remains `true` and is logged on the eventual non-empty submit. |
| 6 | **Submit double-tap** | `gameState.isProcessing = true` and `submitBtn.disabled = true` are set as the FIRST two lines of `onSubmit()`. Re-entry returns at the guard. |
| 7 | **LLM returns malformed evaluation (no tier label)** | Fallback keyword scan in `validateAnswerLLM`: searches `evalLower` for "partial" → "incorrect" → "correct" → defaults to `incorrect`. Logged so we can refine the prompt. |
| 8 | **LLM returns empty `feedback` string** | `playDynamicFeedback` is wrapped in `try/catch`; if `result.feedback` is empty, skip the audio call entirely (`if (!result.feedback) { /* no audio */ }`) but still render the inline panel using `result.evaluation` as the body. |
| 9 | **Hint/example tapped during recording** | Hint/example buttons disabled while state machine is in `recording` / `transcribing` / `submitting` / `evaluating` / `feedback`. |
| 10 | **Visibility hidden mid-record / mid-evaluate** | VisibilityTracker pauses preview screen + FeedbackManager. In-flight `getUserMedia` is interrupted by browser; on resume, state machine returns to `idle` (transcript discarded). In-flight `evaluate()` continues — when it resolves, the resume path renders feedback normally. |
| 11 | **Audio permission popup blocks preview** | PART-039 already waits for audio permission before starting preview timer/audio. No special handling needed. |
| 12 | **0★ result (score === 0)** | Victory still renders with 0 stars + "Play Again" button (no Claim Stars button). Per spec: "0 pts → 0 stars (student can still replay)." |
