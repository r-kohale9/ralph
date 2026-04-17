# Layout and Viewport

Rules for viewport configuration, max-width constraints, dynamic viewport height, overflow control, safe areas, and orientation locking.

---

## 1. Viewport Meta Tag (CRITICAL)

Target device: 375x667 CSS pixels (iPhone SE / budget Android). Games MUST render correctly from 320px to 480px width.

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<!-- Why: maximum-scale=1.0 + user-scalable=no prevents pinch-zoom which breaks game layout on touch devices -->
```

- `maximum-scale=1.0, user-scalable=no` prevents pinch-zoom which breaks game layout.
- Never add `height=device-height` — it causes layout bugs on Android Chrome.

---

## 2. Max Width (STANDARD)

```css
.game-wrapper {
  width: 100vw;
  max-width: var(--mathai-game-max-width); /* 480px */
  box-sizing: border-box;
  /* Why: constrains game to phone-width even on tablet/desktop, preventing stretched layouts */
}
```

---

## 3. Dynamic Viewport Height (STANDARD)

```css
.page-center {
  min-height: 100dvh; /* Why: accounts for mobile browser chrome (URL bar) that 100vh ignores */
}

/* Fallback for older browsers that don't support dvh */
@supports not (min-height: 100dvh) {
  .page-center {
    min-height: 100vh;
  }
}
```

`100vh` on mobile Safari/Chrome includes the area behind the browser URL bar, causing content to be hidden. `100dvh` (dynamic viewport height) adjusts as the browser chrome appears/disappears.

---

## 4. Horizontal Scroll Prevention (CRITICAL)

```css
html, body {
  overflow-x: hidden; /* Why: any horizontal overflow breaks the single-column game layout and confuses students */
  margin: 0;
  padding: 0;
}

.game-stack {
  overflow-x: hidden;
  width: 100%;
  box-sizing: border-box;
}
```

If any element overflows horizontally, the game is broken. Common causes: images without `max-width: 100%`, pre-formatted text, fixed-width tables.

---

## 5. Vertical Scroll (STANDARD)

Acceptable ONLY when:
- Content genuinely exceeds one screen (e.g., a 12-item grid, results screen with many rounds)
- The question and current interactive element are both visible without scrolling
- Never during active gameplay interaction (the student should not scroll to find a button)

### Preview-wrapper mode (CRITICAL)

When the game uses PART-039 / `previewScreen: true`, the page must not rely on root-document scrolling. The single vertical scroll owner is `.mathai-preview-body`.

```css
#mathai-preview-slot {
  height: 100dvh;
  overflow: hidden;
}

#mathai-preview-slot .mathai-preview-body {
  height: 100dvh;
  box-sizing: border-box;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
}

html,
body,
.page-center {
  height: 100dvh;
  min-height: 100dvh;
  overflow-y: hidden;
}

.game-stack {
  overflow: visible;
  height: auto;
}
```

Why this matters: in preview-wrapper mode, touch gestures often begin on grids, banks, or drag/drop surfaces. If scrolling is delegated to the root page instead of `.mathai-preview-body`, those gestures can fail to pan the document at all, even though content is taller than the viewport.

Do NOT introduce a second vertical scroll container inside `.game-stack`. Nested scroll areas break momentum scrolling and cause layout jumps during drag interactions.

---

## 6. Safe Areas (STANDARD)

Modern phones have notches, rounded corners, and bottom gesture bars that overlap content. MUST handle all of them.

```css
.page-center {
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  /* Why: prevents content from being hidden behind notches, rounded corners, and gesture bars */
}
```

**Notch handling:** `env(safe-area-inset-top)` is non-zero on phones with notches (iPhone X+, many Android devices). The `padding-top: 54px` on `.game-wrapper` (from PART-021) already provides clearance for the progress bar, which acts as a natural notch buffer. Do not reduce this padding below 44px.

**Rounded display corners:** The 10px horizontal padding on `.game-stack` prevents corner clipping. Do NOT set `padding: 0` on `.game-stack`.

**Bottom gesture bar (iOS home indicator, Android gesture nav):**

The bottom gesture bar overlaps ~34px of screen space. Critical buttons MUST NOT sit at the absolute bottom:

```css
.btn-container {
  padding-bottom: max(20px, env(safe-area-inset-bottom, 20px));
  /* Why: iOS home indicator and Android gesture bar overlap ~34px; buttons placed flush at bottom are untappable */
}
```

```
 +-------------------+
 |  === notch        |  <- safe-area-inset-top
 |  progress bar     |  <- 54px padding provides clearance
 |                   |
 |  game content     |
 |                   |
 |  [Submit]         |  <- button must clear gesture bar
 |                   |  <- safe-area-inset-bottom (34px)
 +---- ==== --------+  <- gesture bar / home indicator
```

**Status bar:** The `padding-top: 54px` on `.game-wrapper` already clears it. Never position anything at `top: 0` in the game content area except the progress bar.

---

## 7. Orientation (STANDARD)

Portrait ONLY. Landscape is NOT supported.

**CSS lock — MUST include this media query:**

```css
@media screen and (orientation: landscape) and (max-height: 500px) {
  body::before {
    content: 'Please rotate your phone to portrait mode';
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--mathai-white, #ffffff);
    color: var(--mathai-primary, #270f36);
    font-family: var(--mathai-font-family, system-ui, -apple-system, sans-serif);
    font-size: var(--mathai-font-size-subtitle, 18px);
    text-align: center;
    padding: 24px;
    /* Why: phone landscape height is ~320-375px, game layout breaks; overlay covers game without destroying state */
  }
}
```

The `max-height: 500px` guard prevents triggering on tablets in landscape (which have enough height).

**JS lock (ADVISORY, optional reinforcement):**

```javascript
// Only if screen.orientation API is available (not Safari)
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('portrait').catch(function() {
    // Silently fail — CSS fallback handles it
  });
}
```

Works in Android Chrome WebView but not Safari. The CSS media query is the reliable fallback. Both MUST be present.

**What MUST NOT happen on rotation:**
- Game state lost
- Timers reset
- Score reset
- Audio stopping
- White screen

The CSS overlay simply covers the game. When the student rotates back to portrait, the overlay disappears and the game continues exactly where it was.
