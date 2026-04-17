# Game Design: Sort the Shapes

## Identity
- **Game ID:** sort-the-shapes
- **Title:** Sort the Shapes
- **Class/Grade:** Class 2-4 (Grade 2-4)
- **Math Domain:** Geometry
- **Topic:** 2D shape classification by type, number of sides, and geometric properties
- **Bloom Level:** L2 Understand
- **Archetype:** Sort/Classify (#4)
- **NCERT Alignment:** Class 3 Math "Give and Take" / "Shapes and Designs" (2D shape recognition); Class 4 Math "Tick-Tick-Tick" / "Play with Patterns" (property-based classification).

## One-Line Concept
Students drag shape cards from a bank into labeled category buckets to classify 2D shapes by type, number of sides, or geometric property, building fluency in visual discrimination and property reasoning.

## Target Skills
| Skill | Description | Round Type |
|-------|-------------|------------|
| Shape recognition | Name and sort basic 2D shapes (circle, square, triangle, rectangle) into clearly distinct buckets. | Type A (Stage 1) |
| Fine visual discrimination | Distinguish confusable shapes (square vs rectangle, rhombus vs parallelogram, regular vs irregular) across three category buckets. | Type B (Stage 2) |
| Property-based reasoning | Classify shapes using a rule — "all sides equal", "has a right angle" — not by shape name. | Type C (Stage 3) |

## Core Mechanic
This is a single-interaction game (drag-and-drop), but the rules change across stages. Each round presents:
- A **card bank** at the top: 3–5 shape cards, each rendered as inline SVG with a text label underneath the shape.
- Two or three **buckets** below, each labeled with the category name (Stage 1–2) or a geometric property (Stage 3).
- A **progress bar / round indicator** at the very top, and a **lives indicator** (3 hearts) below it.

### Type A: "Obvious sort" (Stage 1)
1. **Student sees:** 3–4 shape cards in the bank; 2 buckets with visually and conceptually distinct labels (e.g., "Circles" vs "Squares").
2. **Student does:** Touch a card, drag it, release over a bucket. On release, the card snaps into the bucket if correct or snaps back to the bank if wrong.
3. **Correct criterion:** The card's `category` field matches the bucket's `id`.
4. **Feedback:** On a correct drop, the card sits inside the bucket (green flash on bucket, +1 point); correct-SFX + sticker fire-and-forget (multi-step rule). When all cards in the round are placed correctly, a round-complete SFX plays (awaited). On a wrong drop, card flashes red, snaps back, a life is lost, and wrong-SFX + sad sticker fire-and-forget. The round ends only when all bank cards are placed correctly OR lives reach 0.

### Type B: "Three-way discrimination" (Stage 2)
1. **Student sees:** 5 cards in the bank; 3 buckets. Buckets are named by shape category (e.g., "Squares", "Rectangles", "Rhombuses"). The bank mixes confusable pairs.
2. **Student does:** Same drag interaction as Type A.
3. **Correct criterion:** Card's `category` matches the bucket's `id`, with stricter discrimination required (e.g., a rectangle must not be dropped in the "Squares" bucket even though both have 4 right angles).
4. **Feedback:** Same as Type A. Wrong-drop TTS is suppressed (multi-step rule); correction is visual + tag-aware via end-of-round review (see Feedback section).

### Type C: "Property rule" (Stage 3)
1. **Student sees:** 5 cards in the bank; 2 buckets labeled by property (e.g., "All sides equal" vs "Not all sides equal"). Card labels show only the shape name; the student must reason about the shape.
2. **Student does:** Same drag interaction.
3. **Correct criterion:** Card's `property_<rule>` boolean matches the bucket's rule.
4. **Feedback:** Same as Type A/B. Because the rule is non-obvious, the round-complete transition shows each card's correct bucket highlighted for 2 seconds before advancing.

## Rounds & Progression

### Stage 1: Two Obvious Buckets (Rounds 1–3)
- Round type: Type A.
- Buckets: 2. Labels use category names.
- Cards per round: 3 in Round 1, 4 in Rounds 2–3.
- Cognitive demand: **Recognition** — the student identifies prototypical shapes and sorts by name.
- Contexts: curved vs straight; triangles vs non-triangles; polygons vs circles.

### Stage 2: Three Buckets + Confusables (Rounds 4–6)
- Round type: Type B.
- Buckets: 3. Labels use category names.
- Cards per round: 5.
- Cognitive demand: **Discrimination** — the student distinguishes visually similar shapes and resists the most common misclassification (rectangle-as-square, rhombus-as-square).
- Contexts: quadrilaterals by type; triangles by side-count analogy (equilateral / isosceles / scalene — all still just "triangle" for Class 2–4, so we keep quadrilateral families here).

### Stage 3: Property-Based Sorting (Rounds 7–8)
- Round type: Type C.
- Buckets: 2. Labels use geometric properties, not shape names.
- Cards per round: 5.
- Cognitive demand: **Property inference** — the student looks past the shape's name and checks the named property.
- Contexts: side equality (Round 7), right angles (Round 8).

### Summary Table

| Dimension | Stage 1 (R1–3) | Stage 2 (R4–6) | Stage 3 (R7–8) |
|-----------|----------------|----------------|-----------------|
| Round type | A | B | C |
| Buckets per round | 2 | 3 | 2 |
| Cards per round | 3–4 | 5 | 5 |
| Bucket label style | Category name | Category name | Geometric property |
| Cognitive demand | Recognition | Discrimination | Property inference |
| Target first-attempt rate | 85–90% | 70–80% | 65–75% |

## Game Parameters
- **Rounds:** 8
- **Timer:** None
- **Lives:** 3 (lost on each wrong drop; at 0 → Game Over)
- **Star rating:**
  - 3 stars = 7–8 rounds completed without ever running out of lives
  - 2 stars = 5–6 rounds completed
  - 1 star = 1–4 rounds completed
  - 0 stars = 0 rounds completed (fresh game-over on Round 1)
- **Input:** Drag-and-drop (touch + mouse). Drag source = card in bank; drop target = bucket.
- **Feedback:** Per-drop visual (green/red flash on bucket) + multi-step fire-and-forget SFX. Round-complete SFX awaited. FeedbackManager handles all audio.

## Scoring
- **Points:** +1 per card placed correctly on first attempt within a round. A round with all cards correct awards "round complete".
- **Stars:** Based on rounds fully completed without a game-over (thresholds above).
- **Lives:** 3 total across the whole game (NOT per round). A wrong drop costs 1 life. At 0 lives → `game_over` screen.
- **Partial credit:** None for the round (a round is either completed or the game ends). Individual correct placements within the round are still counted in the data record.

## Flow

**Shape:** Multi-round (default)
**Changes from default:** None.

```
[Preview Screen (PART-039)]
        |
        v
[Level/Welcome Screen]
        |
        v
[Round N Transition: "Round N"]
        |
        v
[Gameplay: Drag all cards to correct buckets]
        |
        +--> (wrong drop) --> life lost --> if lives>0 return to gameplay
        |                                  if lives==0 -> Game Over
        |
        +--> (all placed) --> Round Complete feedback
                  |
                  v
         [If N < 8: Round N+1 Transition]
         [If N == 8: Victory / Results]
                  |
                  v
          [Stars / Try Again]
```

## Feedback
| Event | Behavior |
|-------|----------|
| Card drag start | Card visually lifts (scale 1.05, drop shadow); other cards dim slightly. No audio. |
| Card drag over valid bucket | Bucket border highlights (primary color); no audio. |
| Correct drop | Bucket flashes green (200ms); card snaps inside bucket and locks. Correct-SFX + celebration sticker, fire-and-forget (multi-step). |
| Wrong drop | Bucket flashes red (300ms); card animates back to bank. Wrong-SFX + sad sticker, fire-and-forget. Life lost (heart disappears with a pop). **Misconception-aware subtitle** ("Rectangles have 4 sides too, but not all equal!") briefly appears below the lives bar for 1.8s — uses the misconception tag from `misconception_tags[card_id][bucket_id]`. |
| All cards placed in round | Round-complete SFX + sticker (awaited). Subtitle: "Round N complete!" Then auto-advance to next round transition after 1.2s. |
| Lose last life | Skip wrong-answer SFX (Case 8). Transition to `game_over` screen. Game-Over screen renders first; then game-over SFX → VO sequence (awaited, CTA interruptible). Message: "Good effort! Let's try again." |
| Complete all 8 rounds | Results screen renders first; `game_complete` postMessage sent; then victory SFX + VO (awaited, CTA interruptible). |
| Try again / replay | Stop all audio; reset state; return to Level/Welcome Screen. |
| Visibility hidden | Pause audio; show Paused overlay with Resume CTA. |

## Content Structure (fallbackContent)

```js
const fallbackContent = {
  previewInstruction: '<p><b>Sort the Shapes!</b><br>Drag each shape into the correct bucket. Watch out — some shapes look alike!</p>',
  previewAudioText: 'Drag each shape into the correct bucket. Some shapes look alike, so look carefully at their sides and corners!',
  previewAudio: null,            // patched in at deploy time by TTS pipeline
  showGameOnPreview: false,
  rounds: [
    {
      round: 1,
      stage: 1,
      type: "A",
      buckets: [
        { id: "circles", label: "Circles" },
        { id: "squares", label: "Squares" }
      ],
      cards: [
        { id: "c1", name: "Circle",  svg: "circle",  category: "circles" },
        { id: "c2", name: "Square",  svg: "square",  category: "squares" },
        { id: "c3", name: "Circle",  svg: "circle",  category: "circles" }
      ],
      misconception_tags: {
        "c1": { "squares": "curve-straight-confusion" },
        "c2": { "circles": "curve-straight-confusion" },
        "c3": { "squares": "curve-straight-confusion" }
      }
    },
    {
      round: 2,
      stage: 1,
      type: "A",
      buckets: [
        { id: "triangles",  label: "Triangles" },
        { id: "rectangles", label: "Rectangles" }
      ],
      cards: [
        { id: "c1", name: "Triangle",  svg: "triangle_equilateral", category: "triangles"  },
        { id: "c2", name: "Rectangle", svg: "rectangle_wide",       category: "rectangles" },
        { id: "c3", name: "Triangle",  svg: "triangle_right",       category: "triangles"  },
        { id: "c4", name: "Rectangle", svg: "rectangle_tall",       category: "rectangles" }
      ],
      misconception_tags: {
        "c1": { "rectangles": "side-count-confusion" },
        "c2": { "triangles":  "side-count-confusion" },
        "c3": { "rectangles": "side-count-confusion" },
        "c4": { "triangles":  "side-count-confusion" }
      }
    },
    {
      round: 3,
      stage: 1,
      type: "A",
      buckets: [
        { id: "curved",   label: "Curved edges" },
        { id: "straight", label: "Straight edges only" }
      ],
      cards: [
        { id: "c1", name: "Oval",     svg: "oval",      category: "curved"   },
        { id: "c2", name: "Pentagon", svg: "pentagon",  category: "straight" },
        { id: "c3", name: "Circle",   svg: "circle",    category: "curved"   },
        { id: "c4", name: "Hexagon",  svg: "hexagon",   category: "straight" }
      ],
      misconception_tags: {
        "c1": { "straight": "curve-straight-confusion" },
        "c2": { "curved":   "polygon-as-curved" },
        "c3": { "straight": "curve-straight-confusion" },
        "c4": { "curved":   "polygon-as-curved" }
      }
    },
    {
      round: 4,
      stage: 2,
      type: "B",
      buckets: [
        { id: "squares",    label: "Squares" },
        { id: "rectangles", label: "Rectangles" },
        { id: "rhombuses",  label: "Rhombuses" }
      ],
      cards: [
        { id: "c1", name: "Square",    svg: "square",            category: "squares"    },
        { id: "c2", name: "Rectangle", svg: "rectangle_wide",    category: "rectangles" },
        { id: "c3", name: "Rhombus",   svg: "rhombus_tilted",    category: "rhombuses"  },
        { id: "c4", name: "Rectangle", svg: "rectangle_tall",    category: "rectangles" },
        { id: "c5", name: "Square",    svg: "square_tilted_45",  category: "squares"    }
      ],
      misconception_tags: {
        "c1": { "rectangles": "square-as-rectangle-overgen", "rhombuses": "tilt-as-rhombus" },
        "c2": { "squares":    "rectangle-as-square",         "rhombuses": "quadrilateral-blur" },
        "c3": { "squares":    "rhombus-as-square",           "rectangles": "rhombus-as-rectangle" },
        "c4": { "squares":    "rectangle-as-square",         "rhombuses": "quadrilateral-blur" },
        "c5": { "rectangles": "square-as-rectangle-overgen", "rhombuses": "tilt-as-rhombus" }
      }
    },
    {
      round: 5,
      stage: 2,
      type: "B",
      buckets: [
        { id: "triangles",     label: "Triangles" },
        { id: "quadrilaterals", label: "4 sides" },
        { id: "other_polygons", label: "5+ sides" }
      ],
      cards: [
        { id: "c1", name: "Triangle",  svg: "triangle_scalene",    category: "triangles"      },
        { id: "c2", name: "Square",    svg: "square",              category: "quadrilaterals" },
        { id: "c3", name: "Pentagon",  svg: "pentagon",            category: "other_polygons" },
        { id: "c4", name: "Trapezoid", svg: "trapezoid",           category: "quadrilaterals" },
        { id: "c5", name: "Hexagon",   svg: "hexagon",             category: "other_polygons" }
      ],
      misconception_tags: {
        "c1": { "quadrilaterals": "triangle-as-quad-miscount", "other_polygons": "triangle-as-polygon-overcount" },
        "c2": { "triangles":      "quadrilateral-as-triangle", "other_polygons": "square-as-polygon-overcount" },
        "c3": { "triangles":      "pentagon-as-triangle-undercount", "quadrilaterals": "pentagon-as-quad-undercount" },
        "c4": { "triangles":      "trapezoid-as-triangle-miscount", "other_polygons": "trapezoid-side-count" },
        "c5": { "triangles":      "hexagon-as-triangle-undercount", "quadrilaterals": "hexagon-as-quad" }
      }
    },
    {
      round: 6,
      stage: 2,
      type: "B",
      buckets: [
        { id: "regular",   label: "Regular" },
        { id: "irregular", label: "Irregular" },
        { id: "not_closed", label: "Not a closed shape" }
      ],
      cards: [
        { id: "c1", name: "Regular Pentagon", svg: "pentagon",           category: "regular"    },
        { id: "c2", name: "Irregular Quad",   svg: "quad_irregular",     category: "irregular"  },
        { id: "c3", name: "Open L-shape",     svg: "open_l",             category: "not_closed" },
        { id: "c4", name: "Equilateral Tri",  svg: "triangle_equilateral", category: "regular"  },
        { id: "c5", name: "Scalene Tri",      svg: "triangle_scalene",   category: "irregular"  }
      ],
      misconception_tags: {
        "c1": { "irregular":  "regular-irregular-confusion", "not_closed": "closed-open-confusion" },
        "c2": { "regular":    "irregular-as-regular",        "not_closed": "closed-open-confusion" },
        "c3": { "regular":    "open-as-regular",              "irregular":  "open-as-irregular" },
        "c4": { "irregular":  "regular-irregular-confusion", "not_closed": "closed-open-confusion" },
        "c5": { "regular":    "irregular-as-regular",        "not_closed": "closed-open-confusion" }
      }
    },
    {
      round: 7,
      stage: 3,
      type: "C",
      buckets: [
        { id: "all_equal",     label: "All sides equal" },
        { id: "not_all_equal", label: "Not all sides equal" }
      ],
      cards: [
        { id: "c1", name: "Square",           svg: "square",              category: "all_equal"     },
        { id: "c2", name: "Rectangle",        svg: "rectangle_wide",      category: "not_all_equal" },
        { id: "c3", name: "Rhombus",          svg: "rhombus_tilted",      category: "all_equal"     },
        { id: "c4", name: "Equilateral Tri",  svg: "triangle_equilateral", category: "all_equal"    },
        { id: "c5", name: "Scalene Triangle", svg: "triangle_scalene",    category: "not_all_equal" }
      ],
      misconception_tags: {
        "c1": { "not_all_equal": "right-angle-confusion-for-sides" },
        "c2": { "all_equal":     "all-quads-equal-sides" },
        "c3": { "not_all_equal": "rhombus-sides-not-equal" },
        "c4": { "not_all_equal": "triangle-sides-assumption" },
        "c5": { "all_equal":     "all-triangles-equal-sides" }
      }
    },
    {
      round: 8,
      stage: 3,
      type: "C",
      buckets: [
        { id: "has_right_angle", label: "Has a right angle" },
        { id: "no_right_angle",  label: "No right angle" }
      ],
      cards: [
        { id: "c1", name: "Square",          svg: "square",               category: "has_right_angle" },
        { id: "c2", name: "Rhombus",         svg: "rhombus_tilted",       category: "no_right_angle"  },
        { id: "c3", name: "Right Triangle",  svg: "triangle_right",       category: "has_right_angle" },
        { id: "c4", name: "Equilateral Tri", svg: "triangle_equilateral", category: "no_right_angle"  },
        { id: "c5", name: "Rectangle",       svg: "rectangle_wide",       category: "has_right_angle" }
      ],
      misconception_tags: {
        "c1": { "no_right_angle":  "square-no-right-angle-denial" },
        "c2": { "has_right_angle": "rhombus-as-right-angled" },
        "c3": { "no_right_angle":  "right-triangle-denial" },
        "c4": { "has_right_angle": "all-triangles-right-angled" },
        "c5": { "no_right_angle":  "rectangle-no-right-angle-denial" }
      }
    }
  ]
};
```

### Misconception glossary (used above)
- `curve-straight-confusion` — treating curved-edge shapes as straight or vice versa.
- `side-count-confusion` — not distinguishing shapes by number of sides.
- `polygon-as-curved` — thinking any many-sided shape has "curved" feel.
- `square-as-rectangle-overgen` — correct mathematically, but at Class 2–4 we teach them as distinct categories; sorting a square into "Rectangle" bucket in a bucket-named round is wrong for this game.
- `rectangle-as-square` — treating rectangles as squares.
- `rhombus-as-square` / `rhombus-as-rectangle` — ignoring tilt and equal-side properties.
- `tilt-as-rhombus` — calling any tilted quadrilateral a rhombus.
- `quadrilateral-blur` — collapsing all 4-sided shapes into one category.
- `side-count-miscount` — arithmetic/visual miscount of sides.
- `quadrilateral-as-triangle`, `hexagon-as-quad`, `trapezoid-side-count` — specific side-count errors.
- `triangle-as-quad-miscount` — counting a triangle as having 4 sides.
- `triangle-as-polygon-overcount` — counting a triangle as having 5+ sides.
- `square-as-polygon-overcount` — counting a square as having 5+ sides.
- `pentagon-as-triangle-undercount` — counting a pentagon as having 3 sides.
- `pentagon-as-quad-undercount` — counting a pentagon as having only 4 sides.
- `trapezoid-as-triangle-miscount` — counting a trapezoid as having 3 sides.
- `hexagon-as-triangle-undercount` — counting a hexagon as having only 3 sides.
- `regular-irregular-confusion` — ignoring whether sides/angles are equal.
- `irregular-as-regular` — assuming any named shape is "regular".
- `open-as-closed` / `closed-open-confusion` — missing the gap in the outline.
- `open-as-regular` — mistaking an open shape as a closed regular polygon.
- `open-as-irregular` — mistaking an open shape as a closed irregular polygon.
- `all-quads-equal-sides` / `all-triangles-equal-sides` — overgeneralizing equal-sides to all quads/triangles.
- `right-angle-confusion-for-sides` — conflating right angles with side equality.
- `rhombus-sides-not-equal` — wrong belief that rhombus sides differ.
- `triangle-sides-assumption` — assuming all triangles have equal sides.
- `square-no-right-angle-denial`, `rectangle-no-right-angle-denial` — denying right angles in squares/rectangles.
- `rhombus-as-right-angled` — assuming rhombuses have right angles.
- `right-triangle-denial` — not recognizing the right angle in a right triangle.
- `all-triangles-right-angled` — overgeneralizing right-triangle property.

## Visual & Theme Direction
- **Rendering approach:** All shapes are **inline SVG** (not images, not emoji). The generator should define a small SVG library keyed by the `svg` field (`circle`, `square`, `rectangle_wide`, `rectangle_tall`, `triangle_equilateral`, `triangle_right`, `triangle_scalene`, `rhombus_tilted`, `square_tilted_45`, `oval`, `pentagon`, `hexagon`, `trapezoid`, `quad_irregular`, `open_l`). Each SVG is solid-filled in a primary accent color with a dark stroke.
- **Palette:** Use the `--mathai-*` variable system (per mobile rule 37). Card fill = `--mathai-accent-1`; card stroke = `--mathai-text-primary`; bucket background = `--mathai-surface`; correct flash = `--mathai-success`; wrong flash = `--mathai-danger`.
- **Mood:** Bright, friendly, "sunny classroom" feel. Rounded corners on cards (`--mathai-radius-md`). Soft drop shadows on drag. No continuous animations during gameplay (mobile rule 30).
- **Typography:** `var(--mathai-font-family)`. Card labels 16px. Bucket labels 16–18px, bold.
- **Buckets:** Large (min 120px tall × 40% width on 375px viewport), dashed border when empty, solid when a card is inside.

## Mobile Considerations
Target viewport **375×667** (mobile rule default). Every rule in `mobile/SKILL.md` applies; the game-specific callouts:
- **Touch targets:** Every shape card ≥ 56×56 CSS px (exceeds 44px minimum, rule 9). Buckets even larger.
- **Drag-and-drop on touch:** Implement via pointer events (`pointerdown` / `pointermove` / `pointerup`) — NOT HTML5 `dragstart` (iOS Safari support is unreliable). On `pointerdown` on a card, capture pointer, track delta, move card; on `pointerup`, hit-test bucket geometry. `touch-action: none` goes on the **cards only** (rule 22) — never on buckets, since buckets cover most of the viewport and disabling touch-action there kills page scroll. Active-drag scroll suppression uses a document-level `touchmove` listener keyed on drag state. `user-select: none` on both cards and buckets is fine (that only affects text selection, not scroll).
- **Thumb zone:** Buckets live in the lower 60% of the viewport (rule 11). Card bank is in the top third but the student lifts cards *into* the thumb zone — initial tap is in the top, but travel goes downward, which is the natural direction.
- **Scroll:** `overflow-x: hidden` on html/body/.game-stack (rule 4). Vertical scroll disabled during active drag.
- **Overscroll / pull-to-refresh:** `overscroll-behavior: none` on html and body (rule 18, CRITICAL). A drag gesture at the top of the page MUST NOT trigger browser refresh.
- **Viewport meta:** `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no` (rule 1, CRITICAL).
- **Dynamic viewport:** `100dvh` everywhere with `@supports` fallback (rule 3).
- **Safe-area insets:** Bottom bucket row respects `env(safe-area-inset-bottom)` so the gesture bar does not cover the drop zone (rule 7).
- **Landscape:** Show a "rotate to portrait" overlay (rule 8).
- **No banned features:** No `aspect-ratio`, no `:has()`, no `color-mix()`, no optional chaining, no `?.` / `??`, no `Array.at()` (rules 24–26).
- **No flexbox `gap`** — use margins (rule 23, CRITICAL). Grid `gap` is OK for the bucket row.

## Accessibility
- **Color contrast:** All card/bucket text ≥ 4.5:1 against background. Correct/wrong flash are NOT the only cue — a checkmark icon appears on correct and a ✕ icon on wrong.
- **Non-color cues:** Correct drop = green flash + card locks into bucket with a checkmark badge. Wrong drop = red flash + ✕ badge + card animates back + haptic shake animation on the card. Life-loss is shown as a heart disappearing (visual shape change, not color alone).
- **Reduced motion:** Respect `prefers-reduced-motion: reduce`; replace drag-bounce / shake with instant snaps.
- **Screen-reader labels:** Each card SVG has `aria-label="<shape name>"`. Each bucket has `aria-label="<bucket label> bucket"`. Live region announces round number and wrong/correct events.
- **Text size:** Nothing under 14px (mobile rule 35); labels at 16–18px.
- **Dyslexia-friendly:** Use system font stack via `--mathai-font-family` (mobile rule 34).

## Platform Integrations (expected)
All integrations are sourced from the read skill files; nothing invented:

| Integration | Source skill | Purpose |
|-------------|--------------|---------|
| `recordAttempt(...)` | feedback/SKILL.md "Cross-Cutting Rules" + constraint 5 | Log every drop with `correct: bool`, `misconception_tag` (if wrong), `card_id`, `bucket_id`. Called BEFORE FeedbackManager plays. |
| `game_complete` postMessage | feedback/SKILL.md CASE 11/12 + constraint 6 | Sent to parent BEFORE end-game audio; includes stars, rounds completed, score. |
| `FeedbackManager` (PART-017) | feedback/SKILL.md "Reads" + Constraint 1 | Owns all audio (SFX, VO, TTS) and overlay layer; drives correct/wrong/round-complete/victory/game-over sequences per CASE 4–12. |
| `PreviewScreen` (PART-039) | spec-creation/SKILL.md fallbackContent fields | Renders the preview instruction + narration before first level. Fields: `previewInstruction`, `previewAudioText`, `previewAudio` (null, patched at deploy), `showGameOnPreview: false`. |
| `TransitionScreen` (round intro) | feedback/SKILL.md CASE 2 + archetype profile | Auto-advance Variant A: SFX → VO sequential, awaited. |
| `ProgressBar` (PART-023) | archetype profile "Sort/Classify" PART flags | Shows current round / total rounds AND remaining lives. |
| `playDynamicFeedback('correct' / 'incorrect')` | feedback/SKILL.md CASE 4/5/7 | Used fire-and-forget for per-card drops (multi-step rule). Used awaited for round-complete. |
| CSS variables (`--mathai-*`) | mobile/SKILL.md rules 34–38 | All colors, spacing, radii, font family via variables. |
| PART-033 (drag interaction) | archetype profile "Sort/Classify" PART flags | Required; pointer-event-based drag handlers. |

Screens required by Sort/Classify archetype (from game-archetypes/SKILL.md): `start` → `gameplay` (loop) → `results`. No `game_over` screen by default — BUT because this spec ADDS lives (3), we explicitly add a `game_over` screen (anti-pattern #3 in archetypes skill) in addition to `results`.

## Success Criteria / Done Definition
The build is considered done when ALL of the following hold:
- [ ] All 8 rounds render with the exact cards and buckets in `fallbackContent`.
- [ ] Drag-and-drop works via pointer events on touch and mouse; cards snap into bucket on correct drop and back to bank on wrong drop.
- [ ] Lives counter decrements on every wrong drop and resets to 3 on restart.
- [ ] At 0 lives, game transitions to `game_over` screen with the "Good effort!" message; `game_complete` fires before game-over audio.
- [ ] Completing all 8 rounds shows the Results screen with the correct star count based on rounds completed.
- [ ] Every drop calls `recordAttempt` with the misconception tag (if wrong) BEFORE FeedbackManager audio.
- [ ] PreviewScreen renders on first load with the stated instruction and narration.
- [ ] Round transitions show "Round N" with awaited SFX → VO sequence.
- [ ] Mobile: viewport 375×667 renders without horizontal scroll; no pull-to-refresh on drag; all touch targets ≥ 44px; landscape shows rotate overlay.
- [ ] Accessibility: checkmark/✕ icons appear on correct/wrong (non-color cues); `aria-label`s present; `prefers-reduced-motion` respected.
- [ ] All banned CSS/JS features absent (mobile rules 23–26).
- [ ] Every wrong drop has a named misconception tag (no `"other"`, no `"wrong"`).
- [ ] `game_complete` postMessage payload includes `{ gameId: "sort-the-shapes", score, stars, roundsCompleted, totalRounds: 8 }`.

## Defaults Applied
- **Bloom Level:** defaulted to L2 Understand (starter spec specified this; retained).
- **Timer:** defaulted to None (starter specified None; matches Sort/Classify archetype default).
- **Lives:** set to 3 (starter specified 3; note that Sort/Classify's archetype default is 0 — see Warnings).
- **Star thresholds:** defaulted to 7–8 / 5–6 / 1–4 rounds (starter specified this split; retained).
- **Difficulty curve:** 3 stages (Rounds 1–3, 4–6, 7–8), unequal round counts per stage (3/3/2) per starter spec.
- **Interaction:** drag-and-drop (starter said "drags"; matches Sort/Classify archetype).
- **Feedback style:** FeedbackManager with multi-step rule (fire-and-forget per drop, awaited for round-complete) — defaulted per feedback/SKILL.md Default Feedback by Game Type.
- **Language:** English (platform default).
- **Scaffolding:** on wrong drop, misconception-aware subtitle shown for 1.8s — defaulted from pedagogy/SKILL.md L2 row ("After 1 wrong: hint").
- **Accessibility:** touch-only, 44px targets, non-color cues (✓/✕ icons) — defaulted.
- **Visual rendering:** inline SVG for shapes — defaulted (most robust across mobile browsers, no CDN dependency).
- **Game-over language:** "Good effort! Let's try again." — defaulted from pedagogy/SKILL.md L2 row.
- **PreviewScreen:** enabled (default `previewScreen: true`).
- **NCERT alignment:** Class 3 Shapes & Designs / Class 4 Play with Patterns — defaulted; creator did not name a chapter.

## Warnings
- **WARNING — Lives at L2:** pedagogy/SKILL.md Constraints §2 says "Never use lives at L1 or L2 by default." This spec uses 3 lives at L2. Justification: the starter spec explicitly requested lives, and the drag-and-drop interaction at Class 2–4 benefits from a stakes signal to discourage thrash-dragging. Retained per spec-creation Constraint 5 ("never override creator choices"). Kept low (3) to remain gentle.
- **WARNING — Archetype adds a screen:** Sort/Classify defaults to `lives: 0` and therefore NO `game_over` screen. Because this spec uses lives=3, a `game_over` screen MUST be added. Archetype anti-pattern #3 calls this out as the most common build failure; builder MUST implement both `game_over` and `results` screens.
- **WARNING — Non-standard round count (8):** Sort/Classify default is 6; starter specifies 8. 8 is within the normal 6–12 window for Bloom L2, so no fatigue concern, but flagged for completeness.
- **WARNING — Stage 2 "Squares vs Rectangles" separation:** Mathematically, every square IS a rectangle, but this game teaches them as distinct categories for Class 2–4 per NCERT treatment. The misconception tag `square-as-rectangle-overgen` acknowledges this; engineers should NOT "fix" it toward formal geometry. Flag for Education slot review if pedagogy shifts to inclusive definitions in later versions.
- **WARNING — Drag-and-drop on touch:** HTML5 `dragstart` is unreliable on iOS Safari. Builder MUST use pointer events (mobile rule 22 + archetype PART-033). If the pipeline's default drag helper uses HTML5 DnD, this will fail — local verification on a touch device is required before queueing.

---

## Appendix: Original Starter

```markdown
# Game Design: Sort the Shapes

## Identity
- **Game ID:** sort-the-shapes
- **Title:** Sort the Shapes
- **Class/Grade:** Class 2-4 (Grade 2-4)
- **Math Domain:** Geometry
- **Topic:** Shape classification by type, sides, and properties
- **Bloom Level:** L2 Understand

## One-Line Concept
Kid drags shape cards into labeled category buckets to practice classifying 2D shapes by type, number of sides, and geometric properties.

## Target Skills
| Skill | Description |
|-------|-------------|
| Shape classification | Sort shapes by type or number of sides into correct buckets |
| Property recognition | Identify properties like "all sides equal" or "has right angles" |
| Spatial reasoning | Distinguish visually similar shapes (rhombus vs rectangle, square vs rectangle) |

## Core Mechanic
- A bank of 3-5 shape cards at the top, and 2-3 labeled category buckets below.
- Student drags each shape card from the bank into the correct bucket.
- Correct: card is dropped into the bucket whose label matches the shape's category for that round.
- Wrong drop costs a life; card snaps back to the bank.

## Rounds & Progression
8 rounds across 3 stages of increasing difficulty:

### Stage 1: Two Obvious Buckets (Rounds 1-3)
- 2 buckets with clearly distinct categories
- 3-4 cards per round
- Basic shapes: circles vs squares, curved vs straight edges, triangles vs rectangles

### Stage 2: Three Buckets + Similar Shapes (Rounds 4-6)
- 3 buckets, requiring finer discrimination
- 5 cards per round
- Confusable pairs: square vs rectangle, rhombus vs parallelogram, regular vs irregular

### Stage 3: Property-Based Sorting (Rounds 7-8)
- 2 buckets labeled by geometric properties (not shape names)
- 5 cards per round
- Requires analyzing properties: side equality, right angles

| Dimension | Stage 1 | Stage 2 | Stage 3 |
|-----------|---------|---------|---------|
| Buckets | 2 | 3 | 2 (property-based) |
| Cards per round | 3-4 | 5 | 5 |
| Cognitive demand | Recognition | Discrimination | Property inference |

## Game Parameters
- **Rounds:** 8
- **Timer:** None
- **Lives:** 3
- **Star rating:** 3★ = 7-8 rounds, 2★ = 5-6 rounds, 1★ = 1-4 rounds
```
