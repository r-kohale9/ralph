# Odd One Out — Game Spec

## Identity
- Game ID: odd-one-out
- Title: Odd One Out
- Class/Grade: Class 1-3 (ages 6-8)
- Math Domain: Classification & Logical Reasoning
- Topic: Category reasoning, identifying properties, set membership
- Bloom Level: L2 Understand (classify, distinguish, interpret)
- Archetype: Lives Challenge (#3)
- Language: English
- Accessibility: Touch-only, 44px+ targets, sufficient contrast
- Scaffolding: Show correct answer after wrong, auto-advance to next round (no retry)

## One-Line Concept
Student sees 4 items and taps the one that does not belong to the group, building classification and category reasoning skills.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Classification | Identify which item does not share a common property with the other three | All rounds |
| Category reasoning | Recognize why 3 items belong together and 1 does not | Stage 2-3 |
| Visual discrimination | Spot differences in shape, color, or size among visually similar items | Stage 1 |

## Core Mechanic
Type A: "Tap the Odd One Out"
1. Student sees a 2x2 grid of 4 large tappable cards (images, icons, or text labels). Prompt: "Which one doesn't belong?"
2. Student taps one card (P1 Tap-Select Single). One tap = one evaluation = round complete.
3. Correct = tapping the item that does NOT share the common property.
4. Feedback:
   - Correct: green highlight, awaited correct SFX + sticker, awaited TTS explaining category
   - Wrong: red flash (~600ms), correct answer revealed green, awaited wrong SFX + sticker, awaited TTS explaining group property, lose 1 life
   - Wrong on last life: skip wrong SFX, transition to game over immediately

## Game Parameters
- Rounds: 10
- Timer: None
- Lives: 3 (wrong = -1 life, 0 lives = game over)
- Star rating: 3★ = 9-10, 2★ = 6-8, 1★ = 1-5
- Input: P1 Tap-Select Single (click on 2x2 grid)
- Feedback: Awaited SFX → awaited TTS per round
- Wrong answer behavior: Advance to next round (NO RETRY). Override of feedback Case 7 default. Rationale: showing the correct answer and category explanation makes retry pointless — the student already knows the answer. The life penalty provides consequence.

## Retry Override

Wrong answer advances to next round (no retry). This is an intentional override of the feedback skill Case 7 default. Rationale: In a classification game, showing the correct answer and explanation makes retry pointless — the student already knows the answer. The life penalty provides consequence.

## Rounds & Progression

### Stage 1: Visual Categories (Rounds 1-3)
- Categories based on visual properties: color, shape, size
- Odd item is visually distinct (low distractor similarity)
- Items shown as: colored shapes or simple icons

### Stage 2: Conceptual Categories (Rounds 4-7)
- Categories based on meaning: animals vs objects, fruits vs vegetables, odd vs even numbers
- Odd item may visually resemble the group (medium distractor similarity)
- Items shown as: mix of labeled images and numbers

### Stage 3: Tricky Categories (Rounds 8-10)
- Multiple plausible categories — student must find primary grouping
- Odd item shares surface traits with group (high distractor similarity)
- Items shown as: numbers or text labels

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Category type | Visual (color/shape/size) | Conceptual (meaning/class) | Multi-attribute |
| Distractor similarity | Low | Medium | High |
| Items shown as | Shapes/icons | Images + numbers | Numbers/text |
| Cognitive demand | Perception | Recall + classification | Analysis |

## Interaction Pattern: P1 Tap-Select Single
- Event: `click` on each of 4 option cards
- Guards: `isActive`, `isProcessing`, `gameEnded` — all must pass
- One tap = one evaluation = round complete
- Visual states: default, selected-correct (green), selected-wrong (red flash ~600ms), correct (revealed green)
- Undo: None. Tap is final.
- Input blocking: `pointer-events: none` on all cards during `isProcessing`

## Mobile Requirements
- Viewport: `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`
- Game wrapper: `max-width: 480px`
- Touch targets: 44px+ per card (2x2 grid in 480px = ~200px per card)
- Spacing: 8px gap between cards (CSS grid)
- `touch-action: manipulation` on all cards
- `overflow-x: hidden` on html/body
- `overscroll-behavior: none`
- Font sizes: 14px+ minimum, 16px+ for cards, 18px+ for prompt
- Colors via `--mathai-*` CSS variables
- Portrait only with landscape overlay
- No banned APIs: no `?.`, no `??`, no `Array.at()`, no flexbox `gap`
- Safe areas: `env(safe-area-inset-*)` padding

## Data Contract

### gameState shape
```js
window.gameState = {
  gameId: 'odd-one-out',
  phase: 'preview',
  currentRound: 0,
  totalRounds: 10,
  score: 0,
  lives: 3,
  totalLives: 3,
  attempts: [],
  events: [],
  startTime: null,
  isActive: false,
  isProcessing: false,
  gameEnded: false,
  content: null,
  duration_data: [],
  roundStartTime: null,
  correctAnswer: null
};
```

### recordAttempt (12 fields, every round)
```js
{
  attempt_timestamp: Date.now(),
  time_since_start_of_game: Date.now() - gameState.startTime,
  input_of_user: 'Chair',
  correct: false,
  round_number: 4,
  question_id: 'r4',
  correct_answer: 'Chair',
  response_time_ms: Date.now() - gameState.roundStartTime,
  misconception_tag: 'surface-similarity',
  difficulty_level: 2,
  is_retry: false,
  metadata: { stage: 2, category: 'animals', items: ['Dog', 'Cat', 'Fish', 'Chair'] }
}
```

### game_complete
Sent on Victory and Game Over, BEFORE end-game audio. Nested `data` with: accuracy (0-100), time (ms), stars (0-3), attempts, duration_data, totalLives, tries.

### syncDOM
On `#app`: `data-phase`, `data-score`, `data-lives`, `data-round`

## Content Structure

The `fallbackContent` object contains:

| Field | Type | Description |
|-------|------|-------------|
| `previewInstruction` | string (HTML) | Rich-text instruction shown on preview screen |
| `previewAudioText` | string | Plain-text version of instruction for TTS |
| `previewAudio` | string or null | URL to pre-recorded preview audio (null = use TTS) |
| `showGameOnPreview` | boolean | Whether to show the game board during preview |
| `rounds` | array | Array of 10 round objects |

Each round object contains:

| Field | Type | Description |
|-------|------|-------------|
| `round` | number | Round number (1-10) |
| `stage` | number | Difficulty stage (1-3) |
| `type` | string | Mechanic type ('A') |
| `prompt` | string | Question text shown to student |
| `category` | string | The shared property of the 3 correct items |
| `categoryExplanation` | string | Brief explanation of why 3 belong and 1 does not |
| `items` | array | 4 item objects with `label`, `value`, `isOdd` |
| `correctAnswer` | string | Label of the odd item |
| `correctTTS` | string | TTS text on correct answer |
| `wrongTTS` | string | TTS text on wrong answer |
| `misconception_tags` | object | Map of wrong-choice value to misconception tag |

## Content (fallbackContent)

```js
var fallbackContent = {
  previewInstruction: '<p>Look at the four items. <b>Three belong together</b>, but one is different. Tap the <b>odd one out</b>!</p>',
  previewAudioText: 'Look at the four items. Three of them belong together, but one is different. Tap the odd one out!',
  previewAudio: null,
  showGameOnPreview: false,
  rounds: [
    {
      round: 1, stage: 1, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'red things',
      categoryExplanation: 'Three of these are red, but one is blue.',
      items: [
        { label: 'Red Apple', value: 'red-apple', isOdd: false },
        { label: 'Red Car', value: 'red-car', isOdd: false },
        { label: 'Blue Star', value: 'blue-star', isOdd: true },
        { label: 'Red Heart', value: 'red-heart', isOdd: false }
      ],
      correctAnswer: 'Blue Star',
      correctTTS: 'The apple, car, and heart are all red. The blue star is not red!',
      wrongTTS: 'Not quite! The apple, car, and heart are all red. The blue star is the odd one out.',
      misconception_tags: { 'Red Apple': 'ignored-shared-property', 'Red Car': 'ignored-shared-property', 'Red Heart': 'ignored-shared-property' }
    },
    {
      round: 2, stage: 1, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'circles',
      categoryExplanation: 'Three are circles, but one is a triangle.',
      items: [
        { label: 'Orange Circle', value: 'orange-circle', isOdd: false },
        { label: 'Blue Circle', value: 'blue-circle', isOdd: false },
        { label: 'Green Circle', value: 'green-circle', isOdd: false },
        { label: 'Red Triangle', value: 'red-triangle', isOdd: true }
      ],
      correctAnswer: 'Red Triangle',
      correctTTS: 'The other three are all circles. A triangle is not a circle!',
      wrongTTS: 'Not quite! The orange, blue, and green shapes are all circles. The red triangle is the odd one out.',
      misconception_tags: { 'Orange Circle': 'color-distraction', 'Blue Circle': 'color-distraction', 'Green Circle': 'color-distraction' }
    },
    {
      round: 3, stage: 1, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'big things',
      categoryExplanation: 'Three are big, but one is small.',
      items: [
        { label: 'Big Elephant', value: 'big-elephant', isOdd: false },
        { label: 'Big House', value: 'big-house', isOdd: false },
        { label: 'Small Ant', value: 'small-ant', isOdd: true },
        { label: 'Big Tree', value: 'big-tree', isOdd: false }
      ],
      correctAnswer: 'Small Ant',
      correctTTS: 'An elephant, house, and tree are all big things. An ant is very small!',
      wrongTTS: 'Not quite! The elephant, house, and tree are all big. The small ant is the odd one out.',
      misconception_tags: { 'Big Elephant': 'category-member-chosen', 'Big House': 'category-member-chosen', 'Big Tree': 'category-member-chosen' }
    },
    {
      round: 4, stage: 2, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'animals',
      categoryExplanation: 'Three are animals, but one is furniture.',
      items: [
        { label: 'Dog', value: 'dog', isOdd: false },
        { label: 'Cat', value: 'cat', isOdd: false },
        { label: 'Fish', value: 'fish', isOdd: false },
        { label: 'Chair', value: 'chair', isOdd: true }
      ],
      correctAnswer: 'Chair',
      correctTTS: 'A dog, cat, and fish are all animals. A chair is not an animal!',
      wrongTTS: 'Not quite! The dog, cat, and fish are all animals. The chair is the odd one out.',
      misconception_tags: { 'Dog': 'surface-similarity', 'Cat': 'surface-similarity', 'Fish': 'habitat-confusion' }
    },
    {
      round: 5, stage: 2, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'fruits',
      categoryExplanation: 'Three are fruits, but one is a vegetable.',
      items: [
        { label: 'Apple', value: 'apple', isOdd: false },
        { label: 'Banana', value: 'banana', isOdd: false },
        { label: 'Carrot', value: 'carrot', isOdd: true },
        { label: 'Grapes', value: 'grapes', isOdd: false }
      ],
      correctAnswer: 'Carrot',
      correctTTS: 'An apple, banana, and grapes are all fruits. A carrot is a vegetable!',
      wrongTTS: 'Not quite! The apple, banana, and grapes are all fruits. The carrot is the odd one out.',
      misconception_tags: { 'Apple': 'food-category-conflation', 'Banana': 'food-category-conflation', 'Grapes': 'food-category-conflation' }
    },
    {
      round: 6, stage: 2, type: 'A',
      prompt: "Which number doesn't belong?",
      category: 'even numbers',
      categoryExplanation: 'Three are even numbers, but one is odd.',
      items: [
        { label: '2', value: '2', isOdd: false },
        { label: '4', value: '4', isOdd: false },
        { label: '6', value: '6', isOdd: false },
        { label: '9', value: '9', isOdd: true }
      ],
      correctAnswer: '9',
      correctTTS: '2, 4, and 6 are all even numbers. 9 is an odd number!',
      wrongTTS: 'Not quite! 2, 4, and 6 are all even. 9 is odd and the odd one out.',
      misconception_tags: { '2': 'parity-confusion', '4': 'parity-confusion', '6': 'parity-confusion' }
    },
    {
      round: 7, stage: 2, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'things that fly',
      categoryExplanation: 'Three can fly, but one cannot.',
      items: [
        { label: 'Bird', value: 'bird', isOdd: false },
        { label: 'Airplane', value: 'airplane', isOdd: false },
        { label: 'Butterfly', value: 'butterfly', isOdd: false },
        { label: 'Bicycle', value: 'bicycle', isOdd: true }
      ],
      correctAnswer: 'Bicycle',
      correctTTS: 'A bird, airplane, and butterfly can all fly. A bicycle cannot fly!',
      wrongTTS: 'Not quite! The bird, airplane, and butterfly can all fly. The bicycle is the odd one out.',
      misconception_tags: { 'Bird': 'transport-confusion', 'Airplane': 'transport-confusion', 'Butterfly': 'living-vs-nonliving-distraction' }
    },
    {
      round: 8, stage: 3, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'fruits (not sports equipment)',
      categoryExplanation: 'Three are fruits. One is sports equipment, even though it is also round.',
      items: [
        { label: 'Apple', value: 'apple', isOdd: false },
        { label: 'Orange', value: 'orange', isOdd: false },
        { label: 'Banana', value: 'banana', isOdd: false },
        { label: 'Basketball', value: 'basketball', isOdd: true }
      ],
      correctAnswer: 'Basketball',
      correctTTS: 'Apple, orange, and banana are all fruits. A basketball is not a fruit, even though it is round like an orange!',
      wrongTTS: 'Not quite! Apple, orange, and banana are all fruits. The basketball is the odd one out.',
      misconception_tags: { 'Apple': 'shape-over-category', 'Orange': 'shape-over-category', 'Banana': 'shape-exception-distraction' }
    },
    {
      round: 9, stage: 3, type: 'A',
      prompt: "Which number doesn't belong?",
      category: 'multiples of 3',
      categoryExplanation: 'Three are multiples of 3, but one is not.',
      items: [
        { label: '12', value: '12', isOdd: false },
        { label: '15', value: '15', isOdd: false },
        { label: '18', value: '18', isOdd: false },
        { label: '22', value: '22', isOdd: true }
      ],
      correctAnswer: '22',
      correctTTS: '12, 15, and 18 are all multiples of 3. 22 is not a multiple of 3!',
      wrongTTS: 'Not quite! 12, 15, and 18 are all multiples of 3. 22 is not divisible by 3.',
      misconception_tags: { '12': 'even-number-distraction', '15': 'odd-number-distraction', '18': 'even-number-distraction' }
    },
    {
      round: 10, stage: 3, type: 'A',
      prompt: "Which one doesn't belong?",
      category: 'things with wheels',
      categoryExplanation: 'Three have wheels. One does not, even though it is also used for travel.',
      items: [
        { label: 'Car', value: 'car', isOdd: false },
        { label: 'Bicycle', value: 'bicycle', isOdd: false },
        { label: 'Boat', value: 'boat', isOdd: true },
        { label: 'Bus', value: 'bus', isOdd: false }
      ],
      correctAnswer: 'Boat',
      correctTTS: 'A car, bicycle, and bus all have wheels. A boat does not have wheels!',
      wrongTTS: 'Not quite! The car, bicycle, and bus all have wheels. The boat is the odd one out.',
      misconception_tags: { 'Car': 'transport-overgeneralization', 'Bicycle': 'size-distraction', 'Bus': 'transport-overgeneralization' }
    }
  ]
};
```

## Edge Cases
1. **Double-tap prevention:** All 4 cards get `pointer-events: none` + `isProcessing = true` on first tap
2. **Lives = 0:** Skip wrong SFX, transition to game over immediately
3. **Last round correct:** Transition to victory/results
4. **Audio failure:** try/catch around all FeedbackManager calls, never blocks input
5. **CTA interruption:** Tapping CTA stops all audio and proceeds
6. **Visibility hidden:** Audio pauses, "Game Paused" overlay, resume on visibility restored
7. **No retry:** Wrong answer shows correct answer, loses life, auto-advances to next round
