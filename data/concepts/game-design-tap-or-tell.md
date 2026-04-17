# Game Design: Tap or Tell

## One-Line Concept

Kid answers a math question by either tapping an MCQ button OR speaking the answer — both input modes accepted, testing flexible response.

---

## Interaction Pattern

**P1 (Tap-Select Single)** + **P17 (Voice Input)** combination.

- **Mode A (Tap):** 4 MCQ option buttons — tap one to answer
- **Mode B (Voice):** VoiceInput component — speak or type the answer
- Kid can use EITHER mode per round. Both are visible simultaneously.

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Mental arithmetic | Solve addition/subtraction problems | 2-4 |
| Number recognition | Match spoken number to written option | 2-3 |
| Multi-modal fluency | Choose the most comfortable input method | 2-5 |

---

## Core Mechanic

### Screen Layout

```
┌──────────────────────────┐
│     What is 7 + 5?       │  ← Question
│                          │
│  ┌──────┐  ┌──────┐     │
│  │  10  │  │  12  │     │  ← MCQ options (P1)
│  └──────┘  └──────┘     │
│  ┌──────┐  ┌──────┐     │
│  │  13  │  │  11  │     │
│  └──────┘  └──────┘     │
│                          │
│  ── OR speak below ──    │  ← Divider
│                          │
│  ┌──────────────────┐    │
│  │  [voice input]   │    │  ← VoiceInput component (P17)
│  │  🎤  ⌨️  ↺       │    │
│  └──────────────────┘    │
│      [Submit Voice]      │  ← Submit button for voice answer
└──────────────────────────┘
```

### Interaction Flow

**Path A — Tap:**
1. Kid taps one of the 4 MCQ buttons
2. All buttons + VoiceInput immediately disable
3. Evaluate: is tapped option correct?
4. Correct/wrong feedback (SFX + TTS)
5. Next round

**Path B — Voice:**
1. Kid taps mic icon on VoiceInput → drawer opens → speaks answer → stops recording
2. Transcription appears in textarea
3. Kid taps "Submit Voice" button
4. All buttons + VoiceInput immediately disable
5. Evaluate: does transcribed text match the correct answer? (numeric or word form)
6. Correct/wrong feedback (SFX + TTS)
7. Next round

**Mutual exclusion:** Once one mode produces a submission, the other is locked for that round. If kid taps an MCQ button, VoiceInput is disabled. If kid submits via voice, MCQ buttons are disabled.

---

## 8 Rounds Across 3 Stages

### Stage 1: Simple addition, clear options (Rounds 1-3)
- Single-digit addition, sum ≤ 10
- MCQ options are spread apart (e.g., 5, 7, 8, 9 for "3+4=?")
- Voice answer is a single digit word ("seven")
- Round 1: 3 + 4 = ? → options: 5, 6, 7, 8
- Round 2: 2 + 5 = ? → options: 6, 7, 8, 9
- Round 3: 1 + 6 = ? → options: 5, 6, 7, 8

### Stage 2: Crossing 10, closer distractors (Rounds 4-6)
- Sums 10-15, MCQ options are closer together
- Voice answers include teen numbers (harder transcription)
- Round 4: 8 + 5 = ? → options: 11, 12, 13, 14
- Round 5: 7 + 6 = ? → options: 11, 12, 13, 14
- Round 6: 9 + 4 = ? → options: 12, 13, 14, 15

### Stage 3: Subtraction + larger numbers (Rounds 7-8)
- Mixed operations, numbers up to 20
- Round 7: 15 - 8 = ? → options: 5, 6, 7, 8
- Round 8: 12 + 7 = ? → options: 17, 18, 19, 20

---

## Answer Matching (Voice Mode)

| Correct answer | Accepted voice inputs |
|---------------|----------------------|
| 7 | "7", "seven" |
| 12 | "12", "twelve" |
| 13 | "13", "thirteen" |
| 19 | "19", "nineteen" |

**Pre-processing:** lowercase, trim whitespace, strip trailing punctuation.

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Operations | Addition | Addition | Addition + subtraction |
| Number range | 1-5 | 5-9 | 1-20 |
| MCQ distractor gap | Wide (±2-3) | Narrow (±1) | Mixed |
| Voice difficulty | Single-digit words | Teen numbers | Mixed |

---

## Implementation Notes

### Mutual Exclusion Logic

```javascript
// When MCQ button is tapped
function onMCQTap(selectedOption) {
  if (locked) return;
  locked = true;
  voiceInput.disable();
  disableAllMCQButtons();
  evaluate(selectedOption);
}

// When Voice Submit is tapped
function onVoiceSubmit() {
  var answer = voiceInput.value.trim();
  if (!answer || locked) return;
  locked = true;
  disableAllMCQButtons();
  voiceInput.disable();
  evaluate(answer);
}

// Reset for next round
function nextRound() {
  locked = false;
  enableAllMCQButtons();
  voiceInput.clearMark();
  voiceInput.clear();
  voiceInput.enable();
}
```

---

## Game Parameters

- **Rounds:** 8
- **Timer:** None
- **Lives:** 3 (wrong answer = lose a life, 0 lives = game over)
- **Star rating:** 3 stars = 7-8 correct, 2 stars = 5-6, 1 star = 1-4
- **Input:** Tap (P1 — 4 MCQ buttons) OR Voice (P17 — VoiceInput + Submit)
- **Feedback:** Correct/wrong SFX + sticker + TTS voice-over
- **Layout:** Question top, MCQ 2x2 grid middle, divider, VoiceInput + Submit bottom
- **VoiceInput config:** `tools: ["mic", "keyboard", "reset"]`, `defaultTool: "mic"`, `placeholder: "say the answer"`
