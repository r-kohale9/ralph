# Game Design: Say the Answer

## One-Line Concept

Kid sees two numbers on screen and speaks (or types) their sum — tests mental arithmetic with voice-first input.

---

## Interaction Pattern

**P17 — Voice Input** only. Speak into microphone OR type in textarea. Uses `VoiceInput` CDN component (loaded via Components bundle).

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Mental addition | Compute sums mentally and articulate the result | 2-3 |
| Verbal math fluency | Express numeric answers out loud | 2-4 |
| Number-word mapping | Connect spoken number words to numeric values | 1-3 |

---

## Core Mechanic

1. Kid sees two numbers displayed large on screen: **7 + 5 = ?**
2. Below is a **VoiceInput component** (textarea + toolbar with mic/keyboard/reset)
3. Default mode is **mic** — drawer opens with big blue mic button, "Tap to speak"
4. Kid taps mic, says "twelve", taps stop
5. VoiceInput transcribes speech → text appears in textarea (e.g., "twelve" or "12")
6. Kid taps **Submit** button (separate from VoiceInput)
7. **Answer matching:** transcribed text is compared against accepted answers:
   - Numeric: "12"
   - Word: "twelve"
   - Common mis-transcriptions: "12.", "twelve."
8. Correct: `voiceInput.markCorrect()` + awaited SFX + TTS ("Seven plus five equals twelve!")
9. Wrong: `voiceInput.markWrong()` + wrong SFX + TTS with correct answer

**Keyboard fallback:** Kid can tap keyboard icon in toolbar, type "12", and submit — same evaluation.

---

## 8 Rounds Across 3 Stages

### Stage 1: Single digit sums (Rounds 1-3)
- Both numbers 1-5, sum ≤ 10
- Round 1: 2 + 3 = ? (answer: "5" or "five")
- Round 2: 4 + 1 = ? (answer: "5" or "five")
- Round 3: 3 + 4 = ? (answer: "7" or "seven")
- Easy transcription — short, clear number words

### Stage 2: Sums crossing 10 (Rounds 4-6)
- One number 5-9, sum 10-18
- Round 4: 7 + 5 = ? (answer: "12" or "twelve")
- Round 5: 8 + 6 = ? (answer: "14" or "fourteen")
- Round 6: 9 + 9 = ? (answer: "18" or "eighteen")
- Teen numbers are harder to transcribe ("thirteen" vs "thirty")

### Stage 3: Mixed operations (Rounds 7-8)
- Addition or subtraction, numbers up to 15
- Round 7: 15 - 7 = ? (answer: "8" or "eight")
- Round 8: 6 + 8 = ? (answer: "14" or "fourteen")

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Number range | 1-5 | 5-9 | 1-15 |
| Sum range | 2-10 | 10-18 | 1-18 |
| Operations | Addition only | Addition only | Addition + subtraction |
| Transcription difficulty | Easy (one-word numbers) | Medium (teen numbers) | Medium |

---

## VoiceInput Integration

```javascript
// Initialize
var voiceInput = new VoiceInput('answer-area');

// Listen for transcript completion
voiceInput.on('transcript', function(data) {
  // Optional: auto-submit after voice transcription
  // Or let user review and tap Submit
});

// On Submit button click
function handleSubmit() {
  var answer = voiceInput.value.trim().toLowerCase();
  if (!answer) return;

  voiceInput.disable(); // Block during evaluation

  var accepted = round.acceptedAnswers; // e.g., ["12", "twelve"]
  var isCorrect = accepted.indexOf(answer) !== -1;

  if (isCorrect) voiceInput.markCorrect();
  else voiceInput.markWrong();

  // ... SFX + TTS feedback ...

  // Next round
  voiceInput.clearMark();
  voiceInput.clear();
  voiceInput.enable();
}
```

## Answer Matching Rules

| Answer format | Example | Accepted? |
|---------------|---------|-----------|
| Numeric string | "12" | Yes |
| Number word | "twelve" | Yes |
| Number word with period | "twelve." | Yes (strip punctuation) |
| Spelled out with spaces | "one two" | No — must be "twelve" |
| Wrong number | "thirteen" | No |

**Pre-processing:** Strip leading/trailing whitespace, convert to lowercase, remove trailing punctuation (`.`, `,`, `!`).

---

## Game Parameters

- **Rounds:** 8
- **Timer:** None
- **Lives:** 3 (wrong answer = lose a life, 0 lives = game over)
- **Star rating:** 3 stars = 7-8 correct, 2 stars = 5-6, 1 star = 1-4
- **Input:** VoiceInput component (P17 — mic + keyboard hybrid, textarea + toolbar + drawer)
- **Feedback:** Correct/wrong SFX + sticker + TTS voice-over with the full equation
- **Layout:** Large equation centered on screen. VoiceInput component below. Submit button below VoiceInput.
- **VoiceInput config:** `tools: ["mic", "keyboard", "reset"]`, `defaultTool: "mic"`, `placeholder: "say or type the answer"`
