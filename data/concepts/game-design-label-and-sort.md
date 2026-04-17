# Game Design: Label & Sort

## One-Line Concept

Kid first taps a category label, then drags word cards into the matching bucket — tests vocabulary classification with two-phase interaction.

---

## Interaction Pattern

**P1 (Tap-Select)** + **P6 (Drag-and-Drop)** combination.

- **Phase 1 (Tap):** Tap a category button to select the active sorting rule
- **Phase 2 (Drag):** Drag word cards into the bucket that matches the selected category

---

## Target Skills

| Skill | Description | Grade |
|-------|-------------|-------|
| Word classification | Group words by part of speech (noun, verb, adjective) | 3-5 |
| Category reasoning | Identify which group a word belongs to | 2-4 |
| Vocabulary building | Recognize word meanings and roles in a sentence | 3-5 |

---

## Core Mechanic

### Per-Round Flow

1. Kid sees a **sentence** at the top: "The quick brown fox jumps over the lazy dog"
2. Below the sentence: **category buttons** (tap targets): `Noun`, `Verb`, `Adjective`
3. Below the buttons: **word cards** extracted from the sentence (e.g., "quick", "fox", "jumps", "lazy", "dog")
4. Below the cards: **3 labeled buckets** matching the categories

### Interaction Sequence

1. Kid **taps** a category button (e.g., "Noun") — it highlights blue (active)
2. Kid **drags** a word card (e.g., "fox") into the "Noun" bucket
3. System validates:
   - If "fox" IS a noun → card snaps into Noun bucket, correct SFX
   - If "fox" is NOT a noun → card bounces back, wrong SFX, life lost
4. Kid can tap a different category before dragging the next card (or keep the same one)
5. When all cards are correctly placed → round complete, awaited SFX + TTS

### Key Rule: Category must be selected before dragging

If no category is tapped, dragging a card does nothing (card bounces back with a hint: "First tap a category!"). This enforces the two-phase interaction.

---

## 6 Rounds Across 3 Stages

### Stage 1: Two categories, short sentences (Rounds 1-2)
- 2 categories only: Noun vs Verb
- Round 1: "Dogs run fast" → cards: "Dogs", "run", "fast" → buckets: Noun, Verb (+ "fast" is a trick — it's an adjective but there's no adjective bucket, so it goes to... actually, keep it clean)
- Round 1: "Cats sleep" → cards: "Cats", "sleep" → Noun, Verb
- Round 2: "Birds fly high" → cards: "Birds", "fly" → Noun, Verb (ignore "high" — not a card)
- 2-3 cards per round, only unambiguous words

### Stage 2: Three categories (Rounds 3-4)
- 3 categories: Noun, Verb, Adjective
- Round 3: "Big dogs run" → cards: "Big", "dogs", "run" → Adjective, Noun, Verb
- Round 4: "The small cat ate fresh fish" → cards: "small", "cat", "ate", "fresh", "fish"
- 3-5 cards per round

### Stage 3: Tricky words (Rounds 5-6)
- Words that can be multiple parts of speech depending on context
- Round 5: "She light the bright light" → "light" appears twice — verb and noun!
- Round 6: "The fast train runs fast" → "fast" as adjective and adverb
- 4-5 cards per round

---

## DnD Behavior Requirements

| Behavior | Spec |
|----------|------|
| Pick up | Pointer down on word card, card lifts (scale 1.05x, shadow) |
| Drag | Card follows pointer, opacity 0.8 |
| Drop zone highlight | Active-category bucket glows when card is nearby |
| Correct drop | Card snaps into bucket, shrinks into list |
| Wrong drop | Card bounces back to word bank, red flash |
| No category selected | Card bounces back with toast hint |
| Bucket interaction | Cards in buckets are final (no re-drag) |

---

## Progression & Difficulty

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Categories | 2 (Noun, Verb) | 3 (+ Adjective) | 3 (with ambiguity) |
| Cards per round | 2-3 | 3-5 | 4-5 |
| Word ambiguity | None | None | High (same word, different roles) |
| Sentence complexity | 2-3 words | 4-6 words | 5-7 words |

---

## Game Parameters

- **Rounds:** 6
- **Timer:** None
- **Lives:** 3 (each wrong card drop = lose a life)
- **Star rating:** 3 stars = 5-6 correct rounds, 2 stars = 3-4, 1 star = 1-2
- **Input:** Tap (P1) to select category + Drag-and-Drop (P6) to place word cards
- **Feedback:** Fire-and-forget SFX per card. Awaited SFX + TTS on round complete.
- **Layout:** Sentence at top. Category buttons in a row below. Word card bank below that. Buckets at bottom (side by side).
