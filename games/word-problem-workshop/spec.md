# Game Design: Word Problem Workshop

## Identity

- **Game ID:** word-problem-workshop
- **Title:** Word Problem Workshop
- **Class/Grade:** Class 3-5
- **Math Domain:** Number Operations — Addition and Subtraction (+, −)
- **Topic:** Creating word problems from math expressions
- **Bloom Level:** L5 Create

## One-Line Concept

Student sees a math expression and must speak or type a real-world word problem that matches it. An AI rubric grades the response — the student is rewarded for open-ended, creative construction of meaning.

## Target Skills

| Skill                   | Description                                                                |
| ----------------------- | -------------------------------------------------------------------------- |
| Word problem creation   | Construct a meaningful real-world scenario that matches a given expression |
| Operation understanding | Demonstrate deep understanding of what + and − mean in context             |
| Multi-step reasoning    | Combine multiple operations into one coherent story (Rounds 2 and 3)       |

---

## Interactions Used

- **Voice input (primary).** Student taps a mic button and speaks their story. Transcribed text appears live in the input and remains fully editable before submit. Voice input is always available when the device mic is usable.
- **Submit button.** Student taps Submit when their story is ready. Exactly one evaluation runs per submit. Submit is disabled during evaluation and during feedback playback.
- **Subjective AI evaluation.** Because the answer is open-ended free text (not a fixed number, MCQ, keyword match, or rule-based check), every submission is graded by an AI rubric. The rubric returns one of three tiers — **correct / partial / incorrect** — plus a short natural-language explanation that powers the spoken and on-screen feedback.
- **Retry.** On the Game Over screen, a single Retry button restarts the whole game.
- **Play Again / Claim Stars.** On the Victory screen, Play Again is offered only if the student earned fewer than 3 stars; Claim Stars exits the game.

---

## Core Mechanic

1. **What the student sees on a round screen:**
   - A math expression card, large and prominent, with a stage label chip above it (e.g. "Round 1 · Single Operation").
   - A short prompt below the card ("Make up a story that matches this expression.").
   - A combined voice + text input.
   - A Submit button as the single primary action.
   - A progress bar showing round N/3 and remaining lives.

2. **What the student does:**
   - Speaks a story (tap mic, speak, tap to stop — transcript auto-fills the input) **or** types a story directly.
   - Optionally edits the transcript after voice input.
   - Taps Submit.

3. **How the answer is evaluated (subjective AI rubric):**
   - **Correct** — the story uses the numbers from the expression in the right roles, represents the right operation(s), and arrives at the stated total.
   - **Partial** — the story is close but has one specific thing off: wrong total, a number misused, an operation missing or reversed, or both halves of a compound expression present but unrelated.
   - **Incorrect** — the story does not match the expression, uses wrong numbers/operations, is off-topic, empty, or gibberish.

4. **What feedback plays (rubric-aware, warm, non-shaming):**
   - **Correct:** a short spoken praise that names what the student did well, plus a positive visual (e.g. check, confetti). The round advances.
   - **Partial:** spoken feedback that **concretely names the single thing that was off** — e.g. "Your story adds 10 and 5, but the total should be 12, not 15. Try including the −3 at the end." The student loses 1 life and retries the same round.
   - **Incorrect:** spoken feedback that **concretely names why the story does not match** the expression and points at the right approach — e.g. "The expression adds, but your story takes away. Try a situation where something is combined." The student loses 1 life and retries the same round.
   - **Lives reach 0:** the Game Over screen plays a soft non-shaming tone with a "Retry" button.
   - Feedback MUST never end on a vague cliffhanger ("try again", "almost there") without a concrete reason. Every partial/incorrect response must state **why**.

---

## Rounds & Progression

3 rounds total — one per stage — to keep the session tight (~3–6 minutes) while covering increasing complexity. The cognitive load per round is high, so the game is intentionally short.

### Stage 1 — Single Operation (Round 1)

- One operation, small whole numbers.
- Addition is canonical for Round 1 (widest range of familiar contexts: combining, joining, receiving).
- **Example expression:** `5 + 3 = 8`
- Example correct story: _"Aarav had 5 mangoes. His friend gave him 3 more. Now he has 8 mangoes."_
- Example partial: _"Aarav had 5 mangoes. His friend gave him 3 more. Now he has 7 mangoes."_ (right operation, wrong total)
- Example incorrect: _"Aarav had 5 mangoes. He ate 3. Now he has 2."_ (wrong operation — subtraction)

### Stage 2 — Two-Step Expression (Round 2)

- Two operations (+ and −) combined without parentheses.
- Student must weave both operations into one coherent story.
- **Example expression:** `10 + 5 − 3 = 12`
- Example correct story: _"Priya had 10 stickers. Her cousin gave her 5 more, making 15. She gave 3 to a friend. Now she has 12."_
- Example partial: _"Priya had 10 stickers and got 5 more, then gave 3 away."_ (both operations present, final total missing)
- Example incorrect: _"Priya had 10 stickers and gave 5 away."_ (only one operation represented)

### Stage 3 — Compound Expression (Round 3)

- A compound expression with grouping (only + and −) describing two sub-scenarios composed into one.
- Student must describe two related sub-problems inside a single unified scenario.
- **Example expression:** `(12 + 8) − (4 + 3) = 13`
- Example correct story: _"The class had 12 red balls and 8 blue balls — 20 in all. During recess, 4 rolled away and 3 were lost — 7 balls gone. 13 balls are left."_
- Example partial: _"The class had 12 red balls and 8 blue balls. 4 balls rolled away and 3 were lost."_ (both sub-sums implied but final total missing or wrong)
- Example incorrect: _"The class had 12 red balls."_ (only one group, grouping structure ignored)

| Dimension            | Stage 1 (R1)            | Stage 2 (R2)            | Stage 3 (R3)                       |
| -------------------- | ----------------------- | ----------------------- | ---------------------------------- |
| Operations per round | 1 (+)                   | 2 (+ and −)             | 3 (with grouping)                  |
| Number complexity    | Small (single-digit)    | Small–medium            | Medium, with grouping              |
| Cognitive demand     | Translate one operation | Sequence two operations | Compose two sub-scenarios into one |

---

## Game Parameters

- **Rounds:** 3
- **Timer:** None (this is a creative open-ended task — timers would be counterproductive)
- **Lives:** 3 (shared across all rounds; decrement only on partial or incorrect)
- **Input modes:** voice (primary) + text (always available)
- **Feedback:** warm, rubric-aware spoken feedback that concretely explains partial/incorrect and praises correct
- **Stars:** 3★ = all 3 rounds solved, 2★ = 2 solved, 1★ = 1 solved, 0★ = Game Over before any correct answer

## Scoring

- **Points:** +3 per correct answer. Partial and incorrect award 0 points.
- **Max total:** 9 points (3 rounds × 3).
- **Star thresholds:** 3★ = 9 pts, 2★ = 6 pts, 1★ = 3 pts, 0★ = 0 pts. Because only correct answers score, the final score is always a multiple of 3.
- **Lives:** start at 3. Both partial and incorrect cost 1 life; correct does not. Lives floor at 0; at 0 the game ends in Game Over.
- **No partial credit.** A partial answer earns 0 points but gives the student actionable, specific feedback and a retry.

---

## Round Flow (retry until correct)

The round loop is the heart of the game. On every Submit:

- **Correct** → play feedback → advance to the next round (or Victory if this was the last round).
- **Partial** → play feedback (with concrete "what was off") → deduct 1 life → clear the input → stay on the same round, ready for another attempt.
- **Incorrect** → play feedback (with concrete "why it does not match") → deduct 1 life → clear the input → stay on the same round, ready for another attempt.
- **Lives reach 0** (via partial or incorrect) → transition to Game Over → single Retry button → restart from Round 1 with lives = 3 and score = 0.
- **Last round solved correctly** → transition to Victory.

Rules that always apply:

- Audio-driven pacing: the game advances or clears the input **exactly when the feedback audio finishes**. No artificial wait timers are used.
- Submit is locked while evaluation + feedback are playing (prevents double-submits).
- The expression card and prompt stay visible across retries — only the input is cleared.

---

## Screen Inventory & Flow

High-level sequence (no lives diagram needed — retry loops are described above):

```
Preview → Welcome → Round 1 → (retry until correct) → Round 2 → (retry until correct) → Round 3 → (retry until correct) → Victory
                                   │                                  │                                  │
                                   └─── lives reach 0 ──────────────────────────────────── Game Over → Retry → back to Preview/Round 1
```

### Preview (onboarding)

- Shown first, before any gameplay. Short audio narration + written instruction explain the game in one paragraph.
- Student can skip ahead.
- After preview (tap or auto-advance): goes to Welcome.

### Welcome

- One short transition card with the game title and one tappable CTA ("Let's go!").
- After tap: goes to Round 1.

### Round intro

- A brief transition announcing the current round ("Round N") with a soft sound, then auto-advances to the round screen. No button to tap.

### Round screen (the main gameplay state)

- Expression card, prompt, voice+text input, Submit button, progress bar (round N/3, remaining lives).
- Submit triggers evaluation + feedback. After feedback the screen either advances (correct) or stays (partial / incorrect), with the input cleared in both retry cases.

### Feedback

- Renders inside the round screen while the audio plays and the subtitle is shown. No separate screen.
- On correct: green mark / positive cue. On partial: softer visual cue. On incorrect: neutral, never red/angry.

### Victory

- Shown when all 3 rounds have been solved correctly.
- Content: animated stars (1–3), final score (`X / 9`), a short congratulatory spoken message, and two possible buttons:
  - **Play Again** — shown only if stars < 3, restarts from Round 1 (skipping Preview + Welcome) with lives = 3, score = 0.
  - **Claim Stars** — always shown, exits the game with a brief star-collection celebration.

### Game Over

- Shown when lives reach 0.
- Content: "Game Over" title, current score (`X / 9`), a neutral (non-red, non-sad) sticker, and one button:
  - **Retry** — restarts from Round 1 with lives = 3 and score = 0.

---

## Feedback Behaviour

| Event                                 | Behaviour                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correct answer                        | Positive visual + warm spoken praise that names what worked. Advance to next round when audio finishes.                                                                                           |
| Partial answer                        | Soft visual cue + spoken feedback that **names exactly what was off** (e.g. "your total is 7, not 8") and gives a one-line fix. Lose 1 life. Clear input when audio finishes. Stay on same round. |
| Incorrect answer                      | Gentle spoken feedback that **names exactly why the story does not match** the expression, with a nudge on the right approach. Lose 1 life. Clear input when audio finishes. Stay on same round.  |
| Lives reach 0                         | Game Over screen with a neutral, non-shaming tone and a Retry button. Soft sound only.                                                                                                            |
| All rounds complete                   | Victory screen with 1–3 stars and a celebration sound.                                                                                                                                            |
| Submit with empty input               | Inline nudge: "Tell me your story first!" — no evaluation runs, no attempt recorded.                                                                                                              |
| Mic unavailable / denied              | Voice button hides silently; the text input continues to work. No error message shown.                                                                                                            |
| AI evaluation unavailable / times out | A generic "Couldn't evaluate — try once more" inline message; no attempt recorded, no life deducted, Submit re-enables.                                                                           |

---

## UX / Presentation Requirements

- **Mobile-first.** The game is designed for a 375×667 primary viewport, and must also render cleanly at 320 and 414 widths with no horizontal scroll.
- **Touch targets ≥ 44px.** Every button (Submit, mic, keyboard, reset, Let's go!, Retry, Play Again, Claim Stars) meets this minimum.
- **Typography & hierarchy.** The expression is the largest element on the round screen. The stage chip and prompt are secondary. The input and Submit button sit below, visually anchored to the bottom half of the screen.
- **Non-shaming visuals.** Incorrect answers never show a red cross, angry sticker, or shaming colour. The palette stays warm and neutral for wrong answers; celebratory for correct.
- **Body scrolls, containers don't.** The page scrolls naturally; internal containers are not height-capped with internal scroll bars.
- **Audio respects pacing.** No artificial delays or timeouts cap feedback audio — the game waits until spoken feedback finishes, then transitions.
- **Accessibility minimums.** Sufficient colour contrast for text, subtitles synced to spoken feedback, keyboard (text) path always available as a fallback to voice.

---

## Notes

- Feedback tone is always warm, encouraging, and non-shaming — this is an open-ended creative task, not a right/wrong quiz.
- With 3 lives and retry-until-correct, a stuck student can run out of lives on a single round. This is intentional difficulty calibration; if it proves too harsh for Class 3-5 in practice, lives can be bumped to 5, or partial can be changed to not cost a life.
- The concrete-feedback rule is central: vague encouragement without explanation would defeat the whole point of subjective AI evaluation here — the student should always walk away from a wrong attempt knowing _what_ to change.
