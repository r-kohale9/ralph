# P7 Required Input Behaviors

Companion to `p07-text-input.md`. Every **Text/Number Input** game must implement these two UX behaviors in addition to the base P7 pattern.

## When to use

Every P7 game. These are **mandatory**, not optional. The base P7 pattern covers Enter/Submit, keyboard dismissal, and `visualViewport`; this file covers:

1. **Auto-focus + scroll-into-view on tap** — the user should never have to manually scroll to type, and the input should never sit under the virtual keyboard.
2. **Auto-growing width** — the input starts compact and grows with content up to a hard cap. Without this, a fixed-width input either looks empty (too wide for "7") or truncates ("1234567").

---

## Behavior 1 — Auto-focus + Scroll-Into-View

### Required UX

| Trigger | Behavior |
|---------|----------|
| Click/tap the input | Input receives focus **and** scrolls into view per the **adaptive block** rule below |
| Programmatic `focus()` (e.g. round transition) | Same adaptive scroll-into-view |
| `visualViewport` resize (keyboard opens) | Re-scroll input into view, **only if the user is not actively scrolling** |

### Adaptive `block:` rule (NEW — required for tall-question games)

The `scrollIntoView({ block })` argument is no longer a fixed `'center'`. It depends on the question's height vs the available viewport above the input:

```javascript
function pickScrollBlock() {
  var question = document.getElementById('question-block')         // primary id
              || document.querySelector('.question-block, .question, .game-question, [data-role="question"]');
  if (!question) return 'center';                                  // fallback

  var vv = window.visualViewport;
  var viewportH = vv ? vv.height : window.innerHeight;
  // Half the viewport (above the centered input) is the budget for the question.
  // If the question itself is taller than that budget, centering would push the
  // top of the question above the viewport and the player can't read it.
  var qH = question.getBoundingClientRect().height;
  return (qH > viewportH * 0.5) ? 'end' : 'center';
}
```

`block: 'center'` puts the input in the vertical middle of the viewport — fine when the question fits in the half-screen above it. `block: 'end'` puts the input at the *bottom* of the viewport (just above the virtual keyboard), leaving the *full* upper half-viewport free for the question. The validator's tall-question rule below requires this branch.

### `visualViewport.resize` re-scroll guard (NEW)

The keyboard-open re-scroll must NOT fight a user-initiated scroll. Track whether the user has scrolled in the last ~600ms and skip the re-scroll if so:

```javascript
var userScrolledAt = 0;
window.addEventListener('scroll', function() { userScrolledAt = Date.now(); }, { passive: true });

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function() {
    if (document.activeElement !== input) return;
    // Skip re-scroll if user scrolled in the last 600ms — they're trying to read the question
    if (Date.now() - userScrolledAt < 600) return;
    setTimeout(function() {
      inputWrap.scrollIntoView({ behavior: 'smooth', block: pickScrollBlock() });
    }, 50);
  });
}
```

Without this guard, the keyboard-resize handler yanks the player back to the input every time they try to scroll up to read a tall question — a real failure shipped (mind-your-numbers 2026-Q2: 3-cluster SVG question, half-viewport budget exceeded, user could not scroll up).

### Implementation (full)

```javascript
var input = document.getElementById('answer-input');
var inputWrap = input.parentElement;
var userScrolledAt = 0;

window.addEventListener('scroll', function() { userScrolledAt = Date.now(); }, { passive: true });

function pickScrollBlock() {
  var question = document.getElementById('question-block')
              || document.querySelector('.question-block, .question, .game-question, [data-role="question"]');
  if (!question) return 'center';
  var vv = window.visualViewport;
  var viewportH = vv ? vv.height : window.innerHeight;
  var qH = question.getBoundingClientRect().height;
  return (qH > viewportH * 0.5) ? 'end' : 'center';
}

function focusAndScroll() {
  input.focus({ preventScroll: true });
  setTimeout(function() {
    inputWrap.scrollIntoView({ behavior: 'smooth', block: pickScrollBlock() });
  }, 50);
}

input.addEventListener('click', focusAndScroll);
input.addEventListener('focus', function() {
  setTimeout(function() {
    inputWrap.scrollIntoView({ behavior: 'smooth', block: pickScrollBlock() });
  }, 50);
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', function() {
    if (document.activeElement !== input) return;
    if (Date.now() - userScrolledAt < 600) return;
    setTimeout(function() {
      inputWrap.scrollIntoView({ behavior: 'smooth', block: pickScrollBlock() });
    }, 50);
  });
}
```

### Required CSS (UPDATED — accommodates tall questions)

```css
.input-wrap {
  scroll-margin-top: 24px;       /* breathing room above the input on block:'end' */
  scroll-margin-bottom: 280px;   /* room below for keyboard on block:'center' */
}

body {
  padding-top: 16px;             /* ensures top of question never sits behind status bar */
  padding-bottom: 320px;         /* ensures input can reach center / end on the last screen */
  min-height: 100vh;
}

#question-block,
.question-block {
  /* If the question can grow tall, allow it to scroll independently rather than
     stretching the layout — but keep `overflow: visible` if the layout already
     has body-level scroll. Pick one strategy per game and stick to it. */
}
```

### Why wrap the input

Always call `scrollIntoView` on a **wrapper span/div** around the input (not the input itself). On iOS Safari, `input.scrollIntoView()` sometimes triggers the browser's own caret-scroll, which conflicts with `smooth` behavior. Scrolling the wrapper is reliable across browsers.

### Anti-patterns

1. Calling `scrollIntoView({ block: 'start' })` — puts the input flush with the top, leaving no breathing room for the question above it.
2. Calling `scrollIntoView({ block: 'center' })` *unconditionally* on tall-question games — pushes the question top off-screen and the user can't scroll up to read it because the keyboard-resize handler yanks them back. Use `pickScrollBlock()`.
3. Calling `focus()` without `preventScroll: true` — causes a double-scroll (browser default + our smooth scroll).
4. Omitting the `setTimeout` — scrollIntoView fires before the virtual keyboard has resized the viewport, and the input ends up hidden behind the keyboard again.
5. Calling `scrollIntoView` on the `<input>` directly — unreliable on iOS.
6. `visualViewport.resize` re-scroll without the user-scroll guard — fights player attempts to scroll up to a tall question. Always include the `Date.now() - userScrolledAt < 600` skip.
7. Putting the question element inside a parent with `overflow: hidden` and no scroll affordance — the user has nowhere to go to read the rest. Either let the body scroll, or give the question its own scroll container with visible affordance.

---

## Behavior 2 — Auto-Growing Width

### Required UX

| State | Width |
|-------|-------|
| Empty | `MIN_W` (the "compact" size, fits 1 digit) |
| 1–N chars (short answer) | Grows proportionally with content |
| Typed beyond the visible cap | Clamped at `MAX_W` |
| User deletes chars | Shrinks back toward `MIN_W` |

**Default values:** `MIN_W = 72px`, `MAX_W = 300px`, `CHAR_W ≈ 22px` per digit at 28px bold tabular-nums font. Recalibrate `CHAR_W` if the font size or family changes.

### Implementation

```javascript
var MIN_W = 72;
var MAX_W = 300;
var CHAR_W = 22;         // visual width per digit at the input's font size
var BASE_PADDING = 28;   // horizontal padding + border (measured, not guessed)

function updateInputWidth() {
  var len = input.value.length;
  var target = len === 0
    ? MIN_W
    : Math.min(MAX_W, Math.max(MIN_W, len * CHAR_W + BASE_PADDING));
  input.style.width = target + 'px';
}

input.addEventListener('input', function() {
  // Numeric filter — mobile keyboards sometimes send other characters
  var cleaned = input.value.replace(/[^0-9-]/g, '');
  if (cleaned !== input.value) input.value = cleaned;
  updateInputWidth();
  // Clear transient feedback colors while editing
  input.classList.remove('input-correct', 'input-wrong');
});
```

### Required CSS

```css
#answer-input {
  width: 72px;          /* initial MIN_W */
  min-width: 72px;
  max-width: 300px;     /* belt-and-suspenders with the JS cap */
  font-size: 16px;      /* required anyway to prevent iOS zoom */
  font-variant-numeric: tabular-nums;  /* equal-width digits so CHAR_W is predictable */
  transition: width 140ms ease-out;    /* smooth resize */
}
```

### Measuring `CHAR_W` for a non-default font

If the input uses a font other than the system default at 28px bold, recalibrate:

1. Render the input with 5 digits: `<input value="12345">`.
2. Measure the input's rendered width minus `BASE_PADDING`.
3. Divide by 5. That is your `CHAR_W`.

Don't assume — a 5px miscalibration accumulates quickly and the input either clips digits or has a lopsided right gap.

### Anti-patterns

1. **Using `ch` units** (`width: calc(${len}ch + 2rem)`) — `ch` is the width of the "0" character in the font, which is unreliable for proportional fonts and for `font-variant-numeric` that the browser applies late. Pixel math against calibrated `CHAR_W` is more predictable.
2. **Using a hidden `<span>` mirror + `offsetWidth`** — works, but requires keeping the span's padding and font in sync with the input. Overkill for monospaced-digit inputs.
3. **Forgetting `font-variant-numeric: tabular-nums`** — with proportional digits, "1111" is much narrower than "8888"; `CHAR_W` becomes meaningless.
4. **No `transition`** — the input snaps width on every keystroke, which reads as a glitch.
5. **Growing but never shrinking** — looks broken when the user backspaces: the empty input still displays at 300px width.

---

## Combined Verification Checklist

When building a P7 game, verify ALL of:

- [ ] Clicking the input focuses it **and** scrolls it into view
- [ ] On mobile (simulated visualViewport), the input sits above the virtual keyboard when focused
- [ ] **Tall question (height > 50% of viewport): input scrolls to `block: 'end'`, NOT `block: 'center'`** — the entire question remains visible above the input
- [ ] **`pickScrollBlock()` (or equivalent inline branch) is implemented** — no unconditional `block: 'center'` calls
- [ ] **`visualViewport.resize` re-scroll is gated by a recent-user-scroll guard** (`Date.now() - userScrolledAt < 600` or equivalent)
- [ ] Manual scroll-up succeeds when the question is tall (re-scroll handler does NOT yank the user back)
- [ ] Initial input width equals `MIN_W`
- [ ] Width is non-decreasing as characters are typed (from `MIN_W` upward)
- [ ] Width never exceeds `MAX_W`, even when content overflows
- [ ] Width shrinks when characters are deleted
- [ ] Non-numeric characters filtered out (numeric games only)
- [ ] `font-variant-numeric: tabular-nums` present on the input
- [ ] `transition: width 140ms ease-out` present on the input
- [ ] `scroll-margin-top` and `scroll-margin-bottom` set on the wrapper
- [ ] Body has `padding-bottom` large enough to scroll the input to center / end even on the last screen
- [ ] `visualViewport` resize re-scrolls when keyboard opens (subject to the user-scroll guard)

---

## Reference Implementation

`games/sum-quiz/index.html` implements both behaviors with 19/19 passing Playwright tests covering:

- Initial width 72px
- Click auto-focuses
- Scrolled into view (top ≥ 0, bottom ≤ viewportH)
- Width non-decreasing on type
- Widths in [72, 300]
- Caps at 300px
- Shrinks on delete
- Non-numeric filtered

Use this as the known-good baseline when adding P7 to a new game.
