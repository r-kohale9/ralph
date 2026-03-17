# PART-021: Screen Layout

**Category:** MANDATORY | **Condition:** Every game | **Dependencies:** PART-002

---

## Design Principles

- **Mobile-first:** max-width 480px, width 100vw
- **Centered horizontally** with white space on sides
- **Vertical stacking** with 10px gaps between blocks
- **Vertical scrolling** allowed if content overflows
- **100dvh** preferred over 100vh (mobile safe-areas)

## HTML Structure

```html
<div class="page-center">
  <section class="game-wrapper">
    <div class="content-fill">
      <div class="game-stack">

        <!-- Game blocks go here -->
        <div class="game-block" id="{{block-id}}">
          <!-- content -->
        </div>

      </div>
    </div>
  </section>
</div>
```

## CSS

```css
:root {
  --game-max-width: 480px;
  --stack-gap: 10px;
}

html, body {
  height: 100%;
  margin: 0;
  background: #f6f6f6;
  font-family: var(--mathai-font-family, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif);
}

.page-center {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100dvh;
  box-sizing: border-box;
}

.game-wrapper {
  width: 100vw;
  max-width: var(--game-max-width);
  box-sizing: border-box;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-height: 100dvh;
  padding-top: 54px;
  position: relative;  /* anchor for progress bar absolute positioning */
}

.game-stack {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  padding: 0 10px 20px 10px;
  box-sizing: border-box;
  width: 100%;
  overflow-x: hidden;
}

.game-block {
  padding: var(--stack-gap);
  margin-bottom: var(--stack-gap);
  background: transparent;
  border-radius: 8px;
  box-sizing: border-box;
}

.content-fill {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: calc(100dvh - 54px);
  box-sizing: border-box;
}

/* Progress bar must be at absolute top (y=0), not pushed down by padding-top */
#mathai-progress-slot,
.mathai-progress-slot {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
}

@media (min-width: 520px) {
  .game-wrapper { width: 100%; }
}
```

## Layout Dimensions

| Element | Value | Notes |
|---------|-------|-------|
| Max width | 480px | Game wrapper |
| Stack gap | 10px | Between game blocks |
| Block padding | 10px | Inside each game block |
| Block border-radius | 8px | Rounded corners |
| Wrapper padding-top | 54px | Top offset |
| Page background | #f6f6f6 | Visible on sides |
| Content background | #ffffff | White game area |

## Accessibility

- Use `role="main"` on `.page-center`
- Use `aria-label="Game area"` on `.game-wrapper`
- Use `aria-live="polite"` on `.game-stack` for dynamic updates
- Use `role="region"` with `aria-label` on each `.game-block`
- Prefer `100dvh` over `100vh` for mobile safe-areas

## Verification

- [ ] `.page-center` centers content horizontally
- [ ] `.game-wrapper` has `max-width: 480px`
- [ ] `.game-stack` uses vertical flexbox with `gap: 10px`
- [ ] Content blocks use `.game-block` class
- [ ] ARIA attributes present on main containers
- [ ] Uses `100dvh` not `100vh`
