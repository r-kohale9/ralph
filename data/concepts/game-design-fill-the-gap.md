# Game Design: Fill the Gap

## One-Line Concept

Kid sees an equation with a missing number and types the answer — tests mental arithmetic with direct numeric input.

---

## Interaction Pattern

**P7 — Text/Number Input** only. Type a number, press Enter or Submit button.

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Mental addition | Compute sums up to 20 without aids | 1-2 |
| Mental subtraction | Compute differences with numbers up to 20 | 1-2 |
| Missing number | Find the unknown in a + ? = b format | 2-3 |
| Number sense | Estimate whether an answer is reasonable | 1-3 |

---

## Core Mechanic

1. Kid sees an equation displayed large on screen with ONE number replaced by a blank: `5 + ___ = 12`
2. Below the equation is a **text input field** (numeric keyboard on mobile, `inputmode="numeric"`)
3. Kid types the missing number and presses **Submit** (or Enter key)
4. Correct: green flash on input + awaited SFX + TTS ("Five plus seven equals twelve, great job!")
5. Wrong: red flash on input + awaited wrong SFX + TTS with the correct answer + move to next round

---

## 10 Rounds Across 3 Stages

### Stage 1: Simple addition (Rounds 1-4)
- Format: `a + ___ = c` where a and c are single digits, answer is 1-9
- Round 1: `3 + ___ = 5` (answer: 2)
- Round 2: `___ + 4 = 7` (answer: 3)
- Round 3: `6 + ___ = 9` (answer: 3)
- Round 4: `___ + 2 = 8` (answer: 6)
- All sums ≤ 10

### Stage 2: Addition + subtraction (Rounds 5-7)
- Mixed operations, sums up to 15
- Round 5: `8 + ___ = 13` (answer: 5)
- Round 6: `___ - 3 = 4` (answer: 7)
- Round 7: `12 - ___ = 5` (answer: 7)
- Missing number can be in any position

### Stage 3: Larger numbers + two-step (Rounds 8-10)
- Numbers up to 20, some two-digit answers
- Round 8: `___ + 9 = 17` (answer: 8)
- Round 9: `15 - ___ = 6` (answer: 9)
- Round 10: `___ - 8 = 12` (answer: 20)

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Operations | Addition only | Addition + subtraction | Mixed |
| Number range | 1-9 | 1-15 | 1-20 |
| Missing position | After operator | Any position | Any position |
| Answer digits | 1 digit | 1 digit | 1-2 digits |

---

## Input Behavior

| Behavior | Spec |
|----------|------|
| Input type | `<input type="text" inputmode="numeric" pattern="[0-9]*">` |
| Font size | 16px minimum (prevents iOS zoom) |
| Validation | Accept integers only, strip whitespace |
| Submit trigger | Enter key OR Submit button tap |
| After submit | Input blurs (dismiss keyboard), disable during feedback |
| Between rounds | Input clears, re-focuses for next round |
| Paste | Disabled (`paste` event prevented) |

---

## Game Parameters

- **Rounds:** 10
- **Timer:** None
- **Lives:** 3 (wrong answer = lose a life, 0 lives = game over)
- **Star rating:** 3 stars = 9-10 correct, 2 stars = 6-8, 1 star = 1-5
- **Input:** Text input only (P7 — numeric keyboard + Submit)
- **Feedback:** Correct/wrong SFX + sticker + TTS voice-over with the full equation
- **Layout:** Large equation text centered on screen. Input field below with Submit button.
