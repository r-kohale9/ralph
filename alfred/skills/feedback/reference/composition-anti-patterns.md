# Composition Anti-Patterns

Concrete Wrong / Right snippets for the most common feedback-composition mistakes. Each entry names the validator rule that catches it (some validator rules are being added in Track B and are noted "to be added").

**See also:**
- [feedback/SKILL.md § Composition with screen primitives](../SKILL.md#composition-with-screen-primitives) — the canonical moment → primitive mapping table
- [game-building/reference/flow-implementation.md](../../game-building/reference/flow-implementation.md) — TransitionScreen + FloatingButton lifecycle

---

### 1. Custom feedback dialogue

**Wrong:**

```html
<div id="failDialogue" class="fail-dialogue hidden">
  <h2 id="failTitle">Not quite</h2>
  <p id="failMessage">Try again next time.</p>
  <button id="failContinueBtn">Continue</button>
</div>
<script>
  failTitle.textContent = 'Not quite';
  failMessage.textContent = msg;
  failDialogue.classList.remove('hidden');
  failContinueBtn.onclick = () => { failDialogue.classList.add('hidden'); endGame(); };
</script>
```

**Right:**

```js
await transitionScreen.show({
  title: 'Not quite',
  subtitle: msg,
  sticker: GAMEOVER_STICKER,
  persist: true,
  buttons: [{ text: 'Try Again', action: () => { transitionScreen.hide(); restartGame(); } }],
});
```

**Caught by:** `GEN-FEEDBACK-CUSTOM-DIALOGUE` (to be added in Track B).

**Why:** TransitionScreen is the single screen primitive for any "stop the game and show a dialogue" moment. A hand-rolled `<div>` duplicates layout, sticker, and lifecycle logic, ignores the `persist` semantics, and bypasses the FloatingButton coordination so two CTAs can stack.

---

### 2. Inline advance CTA when FloatingButton exists

**Wrong:**

```html
<!-- FloatingButton already instantiated as #mathai-floating-button-slot -->
<div class="round-feedback">
  <p class="msg">Great job!</p>
  <button id="continueBtn" onclick="nextRound()">Next</button>
</div>
```

**Right:**

```js
// FloatingButton is the single advance CTA. After feedback resolves:
floatingBtn.setMode('next');
floatingBtn.on('next', () => { /* tear-down or nextRound() */ });
// No inline button is rendered in #gameContent.
```

**Caught by:** `GEN-INLINE-CTA-WITH-FLOATING-BUTTON` (to be added in Track B); `5e0-FLOATING-BUTTON-DUP` (existing).

**Why:** The FloatingButton owns the advance affordance. An inline `Next` / `Continue` button gives the student two CTAs to choose from, drifts state (one path teardowns floating, the other doesn't), and is the failure mode `5e0-FLOATING-BUTTON-DUP` was meant to catch.

---

### 3. CTA-rename workaround

**Wrong:**

```html
<!-- FloatingButton mode is 'next'. Inline button renamed to dodge the duplicate-CTA validator. -->
<button id="moveOnBtn" onclick="endGame()">Move on</button>
<!-- Other variants seen in regressions: "Onward", "Got it", "Proceed". -->
```

**Right:**

```js
// Remove the inline button entirely. Drive advance through FloatingButton:
floatingBtn.setMode('next');
floatingBtn.on('next', () => endGame());
```

**Caught by:** `GEN-INLINE-CTA-WITH-FLOATING-BUTTON` (to be added in Track B). The validator must match by *role*, not by literal "Next" / "Continue" — renaming an inline advance CTA to "Move on" / "Onward" / "Got it" / "Proceed" is precisely the failure mode the rule exists to prevent. Solving the lint by renaming, instead of removing, defeats the lint.

**Why:** This is the cross-logic regression class. The validator must match by role, not by literal text. If an inline button advances the game while a FloatingButton is mounted, it is a duplicate CTA regardless of label.

---

### 4. Custom subtitle render

**Wrong:**

```html
<div class="subtitle" id="feedbackSubtitle"></div>
<script>
  feedbackSubtitle.textContent = msg;
  feedbackSubtitle.classList.add('show');
  await FeedbackManager.playDynamicFeedback({ audio_content: msg, subtitle: msg, sticker });
</script>
```

**Right:**

```js
// FeedbackManager renders the subtitle natively in its overlay.
// Pass `subtitle` to playDynamicFeedback and render no custom node.
await FeedbackManager.playDynamicFeedback({
  audio_content: msg,
  subtitle: msg,
  sticker,
});
```

**Caught by:** `GEN-CUSTOM-SUBTITLE-RENDER` (to be added in Track B).

**Why:** FeedbackManager already paints the subtitle inside its overlay. A second `<div class="subtitle">` double-renders the same text (sometimes mis-aligned, sometimes lingering after `stopAll()`), and is one of the leftover-DOM sources that violate Cross-Cutting Rule 10.

---

### 5. Custom pause overlay

**Wrong:**

```html
<div id="pauseOverlay" class="pause-overlay hidden">
  <h2>Paused</h2>
  <p>Tap to resume.</p>
  <button id="resumeBtn">Resume</button>
</div>
<script>
  visibilityTracker = new VisibilityTracker({
    autoShowPopup: false, // disable built-in so our overlay can take over
    onInactive: () => pauseOverlay.classList.remove('hidden'),
    onResume: () => pauseOverlay.classList.add('hidden'),
  });
</script>
```

**Right:**

```js
// VisibilityTracker auto-renders its own PopupComponent. Keep autoShowPopup
// at the default (true). Customize copy via popupProps if needed.
visibilityTracker = new VisibilityTracker({
  // autoShowPopup defaults to true — DO NOT set to false
  popupProps: {
    title: 'Paused',
    description: 'Tap to resume.',
    buttonText: 'Resume',
  },
  onInactive: () => { FeedbackManager.sound.pause(); FeedbackManager.stream.pauseAll(); timer.pause({fromVisibilityTracker:true}); },
  onResume:   () => { FeedbackManager.sound.resume(); FeedbackManager.stream.resumeAll(); timer.resume({fromVisibilityTracker:true}); },
});
```

**Caught by:** Cross-Cutting Rule 1 prose + CASE 14 anti-pattern note in feedback/SKILL.md (no dedicated validator yet — relies on review).

**Why:** VisibilityTracker already renders, shows, and hides the popup. A custom overlay either stacks on top of the built-in (two visible popups) or only works because someone disabled `autoShowPopup` — at which point any future code path that re-enables visibility default ships a broken pause UI.

---

### 6. Helper-chained end-of-game

**Wrong:**

```js
async function runFeedbackSequence(sfxId, ttsText) {
  await playSfxMinDuration(sfxId, 1500);
  finalizeAfterDwell(); // calls endGame() → posts game_complete + setMode('next')
  await FeedbackManager.playDynamicFeedback({ audio_content: ttsText, subtitle: ttsText, sticker });
}

function finalizeAfterDwell() {
  postGameComplete();
  floatingBtn.setMode('next'); // Next appears BEFORE TTS plays
}
```

**Right:**

```js
// Single 5-beat endGame() — owns the full sequence end-to-end.
async function endGame(correct) {
  // Beat 1
  await FeedbackManager.sound.play(correct ? 'sound_correct' : 'sound_incorrect', { sticker });
  // Beat 2 (SYNC)
  renderInlineFeedbackPanel(correct);
  postGameComplete();
  // Beat 3
  try {
    await FeedbackManager.playDynamicFeedback({ audio_content: ttsText, subtitle: ttsText, sticker });
  } catch (e) {}
  // Beat 4
  if (correct) window.postMessage({ type: 'show_star', data: { count: getStars(), variant: 'yellow' } }, '*');
  // Beat 5
  setTimeout(() => floatingBtn.setMode('next'), 1100);
}
```

**Caught by:** `GEN-ENDGAME-AFTER-TTS` (existing).

**Why:** Splitting `endGame` across `runFeedbackSequence` / `finalizeAfterDwell` fires `game_complete` and reveals Next BEFORE TTS plays, stacking the star animation on top of the audio (bodmas-blitz regression). The 5-beat block is a single orchestrator precisely because every previous attempt to factor it into helpers reordered the beats.

### 7. Disconnected generic subtitle (cross-logic 2026-04-29)

**Wrong:**

```js
// Build agent saw long per-round TTS + subtitle slot, defaulted to a short generic literal.
await FeedbackManager.playDynamicFeedback({
  audio_content: round.keyInferenceTTS,    // "Nice — since Arjun is from India and the Lion lover is from Japan, Maya must like the Lion."
  subtitle:      'Nice deduction!',        // ← disconnected from audio_content
  sticker:       STICKER_CORRECT
});

await FeedbackManager.playDynamicFeedback({
  audio_content: round.violatedClueTTS,    // "That breaks clue 2 — Arjun is from India. Which row still has Arjun checked against Japan?"
  subtitle:      'Check the clue again.',  // ← disconnected
  sticker:       STICKER_INCORRECT
});
```

**Right:**

```js
// audio_content and subtitle come from the same round object's paired *TTS / *Subtitle fields.
// Spec-creation authors both together (see spec-creation/SKILL.md § 5e-i); build inlines verbatim.
await FeedbackManager.playDynamicFeedback({
  audio_content: round.keyInferenceTTS,
  subtitle:      round.keyInferenceSubtitle,    // e.g. "Maya likes the Lion!" — paraphrases TTS, ≤60 chars
  sticker:       STICKER_CORRECT
});

await FeedbackManager.playDynamicFeedback({
  audio_content: round.violatedClueTTS,
  subtitle:      round.violatedClueSubtitle,    // e.g. "Clue 2 — Arjun is from India." — names the violated clue
  sticker:       STICKER_INCORRECT
});
```

**Caught by:** `GEN-FEEDBACK-SUBTITLE-LINKED-TO-AUDIO` (new); spec-review `Z7` (`SCOPE-CREEP-SUBTITLE-DISCONNECTED`).

**Why:** The `subtitle` parameter is the on-screen caption rendered while the TTS audio plays — for students who can't hear the audio (mute, slow TTS network, deaf/HoH), it is the ONLY surface that carries the lesson. When `audio_content` is creator-supplied per-round narration (long inference / violated-clue + ask-back), a generic literal subtitle disconnected from that content strands the silent-mode learner. The cross-logic 2026-04-29 build shipped 12 puzzles where every correct submit showed `'Nice deduction!'` on screen while the audio narrated puzzle-specific scaffolding — an L4 game where the visible scaffold was unreachable without speakers.

The build agent picked the disconnected literal because the dominant example shape in this skill (`audio_content: 'Round 3', subtitle: 'Round 3'`) trained the wrong instinct: subtitle as a SEPARATE short thing, not a derivation of audio_content. The fix lives at the spec layer — author both strings together, pair them by `<X>TTS` ↔ `<X>Subtitle` convention, build inlines both. See feedback-summary.md "Per-round long-audio + paired short-subtitle" worked example.
