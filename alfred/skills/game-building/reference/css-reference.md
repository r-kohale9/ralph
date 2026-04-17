# CSS Reference

Complete CSS patterns required in every game, including variables, layout, touch targets, animations, and utility classes.

## 1. `--mathai-*` Variables

Every visual value MUST come from the `--mathai-*` system. Complete reference from mobile.md Section 10:

```css
:root {
  /* Layout */
  --mathai-game-max-width: 480px;
  --mathai-stack-gap: 10px;
  --mathai-game-padding-top: 54px;

  /* Brand colors */
  --mathai-primary: #270f36;
  --mathai-level-text: #270F63;
  --mathai-purple: #9B51E0;

  /* Action colors */
  --mathai-green: #219653;
  --mathai-blue: #667eea;
  --mathai-red: #E35757;
  --mathai-orange: #F2994A;
  --mathai-yellow: #FFDE49;

  /* Neutrals */
  --mathai-white: #ffffff;
  --mathai-gray: #666666;
  --mathai-light-gray: #f5f5f5;
  --mathai-disabled-gray: #E0E0E0;
  --mathai-text-primary: #4a4a4a;
  --mathai-border-gray: #e0e0e0;

  /* Gameplay feedback */
  --mathai-cell-bg-green: #D9F8D9;
  --mathai-cell-bg-yellow: #FCF6D7;
  --mathai-cell-bg-red: #FFD9D9;
  --mathai-cell-bg-grey: #E0E0E0;
  --mathai-cell-border-green: #27ae60;
  --mathai-cell-border-red: #e74c3c;

  /* Typography */
  --mathai-font-family: 'Epilogue', -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mathai-font-size-title: 32px;
  --mathai-font-size-subtitle: 18px;
  --mathai-font-size-button: 16px;
  --mathai-font-size-body: 16px;
  --mathai-font-size-small: 14px;
  --mathai-font-size-large: 24px;

  /* Spacing */
  --mathai-padding-large: 56px 40px;
  --mathai-padding-medium: 16px 24px;
  --mathai-padding-small: 10px;
  --mathai-border-radius: 24px;
  --mathai-border-radius-small: 8px;
  --mathai-border-radius-button: 10px;
  --mathai-border-radius-card: 12px;
}
```

**Rule:** If a value exists as a `--mathai-*` variable, use the variable. Hardcoded equivalents (even if numerically identical) are banned.

## 2. Mobile Viewport and Layout

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  overflow-x: hidden;
  margin: 0;
  padding: 0;
  overscroll-behavior: none;
}

body {
  font-family: var(--mathai-font-family);
  background: var(--mathai-white);
  color: var(--mathai-text-primary);
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
  line-height: 1.5;
}

#app {
  width: 100%;
  max-width: var(--mathai-game-max-width);
  min-height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  position: relative;
  /* Do NOT use `overflow: hidden` on #app. This is the full-page game
     container. On short viewports (e.g. 375x667 mobile) the sum of
     preview screen + play area + piece bank + results easily exceeds
     100dvh, and `overflow: hidden` here silently clips that overflow
     so the user can neither swipe-scroll (mobile) nor wheel-scroll
     (desktop) to reach it. Horizontal overflow is already handled by
     `overflow-x: hidden` on html/body. Absolute- and fixed-position
     overlays (dragging piece, popups) are not affected by #app's box,
     so there is nothing to clip here. */
  overflow-x: clip; /* belt-and-braces against accidental horizontal scroll */
  padding-top: env(safe-area-inset-top, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}

/* Preview-wrapper scroll compatibility.
   Until every deployed components bundle includes the preview-body fix,
   emit this block in every previewScreen:true game so gameplay can scroll
   from grids, banks, and other large touch surfaces. */
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

/* dvh fallback for older browsers */
@supports not (min-height: 100dvh) {
  #app { min-height: 100vh; }
}
```

## 3. Touch Targets

```css
button,
.option-btn,
.grid-cell,
[role="button"],
input[type="submit"] {
  min-height: 44px;
  min-width: 44px;
  touch-action: manipulation;
}
```

- Minimum 44x44px, no exceptions
- Minimum 8px spacing between adjacent targets
- Interactive elements in the lower 60% of screen (thumb zone)
- `touch-action: manipulation` on all interactive elements (disables double-tap zoom + 300ms delay)

## 4. Gesture Suppression

```css
.game-wrapper,
#app {
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Re-enable on inputs */
input, textarea {
  -webkit-user-select: text;
  user-select: text;
}
```

## 5. Landscape Lock Overlay

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
  }
}
```

## 6. Required Micro-Animations

Every game ships with these keyframes (from feedback.md Section 7):

```css
@keyframes scoreBounce {
  0% { transform: scale(1); }
  40% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes starPop {
  0% { transform: scale(0); }
  60% { transform: scale(1.3); }
  100% { transform: scale(1); }
}

@keyframes heartBreak {
  0% { transform: scale(1); opacity: 1; }
  30% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.5); opacity: 0; color: var(--mathai-red); }
}

@keyframes streakGlow {
  0% { box-shadow: 0 0 0 rgba(255, 193, 7, 0); }
  50% { box-shadow: 0 0 16px rgba(255, 193, 7, 0.5); }
  100% { box-shadow: 0 0 0 rgba(255, 193, 7, 0); }
}

@keyframes confettiFall {
  0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
  100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
}

.score-bounce { animation: scoreBounce 0.4s ease; }
.shake-wrong { animation: shake 0.5s ease; }
.heart-break { animation: heartBreak 0.6s ease forwards; }
.star-earned { animation: starPop 0.4s ease forwards; }
.streak-glow { animation: streakGlow 0.6s ease; }
.fade-in { animation: fadeIn 0.35s ease; }
```

## 7. Wrong-Answer Visual Feedback

```css
.selected-wrong {
  background: var(--mathai-cell-bg-red);
  border-color: var(--mathai-red);
  color: var(--mathai-red);
}

.selected-correct {
  background: var(--mathai-cell-bg-green);
  border-color: var(--mathai-green);
  color: var(--mathai-green);
}

.correct-reveal {
  font-size: 15px;
  font-weight: 600;
  color: var(--mathai-green);
  text-align: center;
  margin-top: 8px;
  animation: fadeIn 0.35s ease;
}

.correct-reveal.hidden {
  display: none;
}
```

## 8. Disabled State

```css
.option-btn:disabled,
.option-btn.disabled {
  opacity: 0.6;
  pointer-events: none;
  cursor: not-allowed;
}
```
